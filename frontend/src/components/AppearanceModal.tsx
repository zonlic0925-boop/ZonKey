/**
 * 外观选择弹层：主题 4 套（cream/paper/slate/dark）+ 背景纹理 4 档
 * （无/网格/波点/纸纹）。即点即换即存（ThemeProvider + localStorage），
 * 壳内同步 ui_prefs.json 供下次启动闪屏底色联动。
 * 入口：Header（桌面右上 + 手机顶栏）与首页导航页快捷入口。
 */
import React from 'react';
import { X, Palette, Check } from 'lucide-react';
import { useI18n } from '../i18n';
import {
  THEME_IDS,
  TEXTURE_IDS,
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

export const AppearanceModal: React.FC<AppearanceModalProps> = ({ open, onClose }) => {
  const { t } = useI18n();
  const { theme, texture, setTheme, setTexture } = useTheme();

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
        className="memphis-card max-w-md w-full p-6 relative animate-in fade-in zoom-in-95 duration-200"
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

        {/* 背景纹理（二级选项） */}
        <div className="mt-5">
          <p className="text-xs font-bold text-mem-ink/70 mb-2">{t('appearance.textureLabel')}</p>
          <div className="grid grid-cols-4 gap-2">
            {TEXTURE_IDS.map((id) => {
              const active = texture === id;
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
                    className={`block h-8 rounded ${id === 'none' ? '' : `zs-texture ${id === 'grid' ? 'zs-texture-grid' : id === 'dots' ? 'zs-texture-dots' : 'zs-texture-paper'}`}`}
                    style={{ background: 'rgb(var(--mem-cream))' }}
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
      </div>
    </div>
  );
};
