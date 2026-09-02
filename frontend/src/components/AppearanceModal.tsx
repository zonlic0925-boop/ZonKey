/**
 * 外观选择弹层：主题 4 套（cream/paper/slate/dark）+ 背景纹理 4 档
 * （无/网格/波点/纸纹）。即点即换即存（ThemeProvider + localStorage），
 * 壳内同步 ui_prefs.json 供下次启动闪屏底色联动。
 * 入口：Header（桌面右上 + 手机顶栏）与首页导航页快捷入口。
 */
import React from 'react';
import { X, Palette, Check, Type } from 'lucide-react';
import { useI18n } from '../i18n';
import {
  FONT_SIZE_IDS,
  THEME_IDS,
  TEXTURE_IDS,
  type FontSizeId,
  type TextureId,
  type ThemeId,
} from '../lib/theme/themeCore';
import { useTheme } from '../lib/theme/ThemeProvider';

interface AppearanceModalProps {
  open: boolean;
  onClose: () => void;
}

/** 缩略预览：4 个色块模拟「页面底 + 卡底 + 描边/阴影」，纹理档位叠加网格示意 */
const themeThumb: Record<ThemeId, { page: string; card: string; ink: string }> = {
  cream: { page: '#FFF9F0', card: '#FFFFFF', ink: '#1A1A2E' },
  paper: { page: '#FAFAF8', card: '#FFFFFF', ink: '#1A1A2E' },
  slate: { page: '#E2E8F0', card: '#F1F5F9', ink: '#1E293B' },
  dark: { page: '#181826', card: '#232336', ink: '#E0E1EB' },
};

/** 字号档预览示意字重（A 字号随档位变化，直观展示缩放幅度） */
const fontSizePx: Record<FontSizeId, string> = { sm: '12px', md: '14px', lg: '16px', xl: '18px' };

export const AppearanceModal: React.FC<AppearanceModalProps> = ({ open, onClose }) => {
  const { t } = useI18n();
  const { theme, texture, fontSize, setTheme, setTexture, setFontSize } = useTheme();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-mem-ink/40 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t('appearance.title')}
    >
      <div
        className="memphis-card max-w-md w-full max-h-[88dvh] overflow-y-auto p-6 relative animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-mem-yellow/40 text-mem-ink/60"
          aria-label={t('appearance.close')}
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <Palette className="w-5 h-5 text-mem-coral" />
          <h2 className="font-brand text-xl brand-wordmark tracking-wider">{t('appearance.title')}</h2>
        </div>
        <p className="text-xs text-mem-ink/55 mb-4 leading-relaxed">{t('appearance.description')}</p>

        {/* 主题预设 */}
        <div className="grid grid-cols-2 gap-2.5">
          {THEME_IDS.map((id) => {
            const active = theme === id;
            const thumb = themeThumb[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTheme(id)}
                className={`relative rounded-xl border-2 p-2.5 text-left transition-all ${
                  active
                    ? 'border-mem-ink bg-mem-yellow/30 shadow-memphis-sm'
                    : 'border-mem-ink/25 bg-white hover:border-mem-ink/60'
                }`}
                aria-pressed={active}
              >
                {/* 迷你预览：页面底 + 卡块 + 描边 */}
                <span
                  className="block h-10 rounded-lg border-2 p-1.5"
                  style={{ background: thumb.page, borderColor: thumb.ink }}
                >
                  <span
                    className="block h-full rounded border-2"
                    style={{ background: thumb.card, borderColor: thumb.ink }}
                  />
                </span>
                <span className="mt-1.5 flex items-center justify-between text-xs font-bold text-mem-ink">
                  {t(`appearance.theme.${id}`)}
                  {active && <Check className="w-3.5 h-3.5" />}
                </span>
              </button>
            );
          })}
        </div>

        {/* 背景纹理（二级选项）：纯色/网格/波点/纸纹/流动 */}
        <div className="mt-5">
          <p className="text-xs font-bold text-mem-ink/70 mb-2">{t('appearance.textureLabel')}</p>
          <div className="grid grid-cols-5 gap-2">
            {TEXTURE_IDS.map((id) => {
              const active = texture === id;
              // 只挂图案类、不挂 .zs-texture（那是全页 overlay 用的 absolute inset-0
              // 定位类）：预览块若绝对定位铺满按钮，文字会压在 background-image
              // 上，WebView2/Chromium 对叠加背景图的 10px 粗体中文走劣化光栅
              // 路径，标签笔画粘连成墨块（round-7 问题3 根因）。h-8 块级 span
              // 本身就是 32px 色块，图案类只负责 background-image。
              const previewClass =
                id === 'none'
                  ? ''
                  : id === 'fluid'
                    ? 'zs-texture-fluid-preview'
                    : id === 'grid'
                      ? 'zs-texture-grid'
                      : id === 'dots'
                        ? 'zs-texture-dots'
                        : 'zs-texture-paper';
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTexture(id)}
                  className={`relative rounded-lg border-2 p-1.5 transition-all ${
                    active
                      ? 'border-mem-ink bg-mem-teal/20 shadow-memphis-sm'
                      : 'border-mem-ink/25 bg-white hover:border-mem-ink/60'
                  }`}
                  aria-pressed={active}
                >
                  <span
                    className={`block h-8 rounded ${previewClass}`}
                    /* backgroundColor 而非 background：简写会把 class 的
                       background-image 一并重置成 none，五个纹理预览全变纯色
                       （round-5 问题3 根因） */
                    style={{ backgroundColor: 'rgb(var(--mem-cream))' }}
                  />
                  <span className="mt-1 flex items-center justify-center gap-1 text-[10px] font-bold text-mem-ink">
                    {t(`appearance.texture.${id}`)}
                    {active && <Check className="w-3 h-3" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 字号（二级选项）：根字号缩放，全站实时生效 */}
        <div className="mt-5">
          <p className="flex items-center gap-1.5 text-xs font-bold text-mem-ink/70 mb-2">
            <Type className="w-3.5 h-3.5" />
            {t('appearance.fontSizeLabel')}
          </p>
          <div className="grid grid-cols-4 gap-2">
            {FONT_SIZE_IDS.map((id) => {
              const active = fontSize === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFontSize(id)}
                  className={`relative rounded-lg border-2 py-2 transition-all ${
                    active
                      ? 'border-mem-ink bg-mem-sky/20 shadow-memphis-sm'
                      : 'border-mem-ink/25 bg-white hover:border-mem-ink/60'
                  }`}
                  aria-pressed={active}
                >
                  <span
                    className="block text-mem-ink font-bold leading-none"
                    style={{ fontSize: fontSizePx[id] }}
                  >
                    A
                  </span>
                  <span className="mt-1 flex items-center justify-center gap-1 text-[10px] font-bold text-mem-ink">
                    {t(`appearance.fontSize.${id}`)}
                    {active && <Check className="w-3 h-3" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
