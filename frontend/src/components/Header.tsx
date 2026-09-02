import React, { useRef, useState } from 'react';
import { Coffee, ShieldCheck, Palette } from 'lucide-react';
import { CenterId } from '../types';
import { CENTERS } from '../lib/navigation';
import { BrandMark } from './BrandMark';
import { SupportAuthorModal } from './SupportAuthorModal';
import { AppearanceModal } from './AppearanceModal';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useI18n } from '../i18n';

interface HeaderProps {
  activeCenter: CenterId;
  onCenterChange: (center: CenterId) => void;
  systemStatus: {
    ocrAvailable: boolean;
    activeRulesCount: number;
  };
  backendOnline?: boolean | null;
  onOpenPrivacy?: () => void;
}

/** 中心导航激活态底色（mem-* 强调色映射） */
const centerActiveAccent: Record<string, string> = {
  coral: 'bg-mem-coral/20',
  sky: 'bg-mem-sky/30',
  orange: 'bg-mem-orange/30',
  yellow: 'bg-mem-yellow/40',
  teal: 'bg-mem-teal/30',
  pink: 'bg-mem-pink/30',
  lavender: 'bg-mem-lavender/30',
  lime: 'bg-mem-lime/40',
};

/** 拖拽行样式：Header 品牌行自身就是窗口拖拽区（app-region: drag），
 *  行内交互元素逐个 .no-drag 豁免。旧方案是独立 fixed 覆盖条复刻行几何，
 *  离线横幅下压 Header 时几何错位，且每加一个按钮都要同步覆盖条挖洞——
 *  现在拖拽区天然等于标题栏真实几何，见 docs/AGENTS_HANDOFF.md。
 *  关键（round-4 教训）：drag 必须走 class 而非内联 style——内联样式
 *  优先级压过任何样式表规则，导致 html[data-canvas-gesture] 手势期
 *  转 no-drag 的覆盖规则从未生效（方框拖动劫持复现的根因）。 */
const dragRowClass = 'zs-drag-row';

export const Header: React.FC<HeaderProps> = ({
  activeCenter,
  onCenterChange,
  systemStatus,
  backendOnline,
  onOpenPrivacy,
}) => {
  const { t } = useI18n();
  const [supportOpen, setSupportOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  // 桌面中心导航：窄窗折叠出横向滚动时，竖向滚轮转横向滚动
  // （Chromium 纯横向滚动区不消费竖向 delta，鼠标用户够不到右侧项）。
  const centersNavRef = useRef<HTMLElement>(null);
  const handleCentersWheel = (e: React.WheelEvent) => {
    const el = centersNavRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  };

  const engineLabel =
    backendOnline === false
      ? t('header.engineOffline')
      : backendOnline === null
        ? t('header.engineChecking')
        : t('header.engineOnline');

  const statusDot = (
    <span
      className={`w-2 h-2 rounded-full border border-mem-ink shrink-0 ${
        backendOnline === false ? 'bg-mem-coral' : 'bg-mem-teal'
      }`}
    />
  );

  const centerButton = (center: (typeof CENTERS)[number], showLabel: boolean) => {
    const Icon = center.icon;
    const isActive = activeCenter === center.id;
    return (
      <button
        key={center.id}
        type="button"
        onClick={() => onCenterChange(center.id)}
        title={t(center.labelKey)}
        className={`group flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-medium transition-all duration-150 shrink-0 zs-touch-target ${
          isActive
            ? `memphis-tab-active ${centerActiveAccent[center.accent]}`
            : 'memphis-tab-inactive'
        }`}
      >
        <span className={`p-1 rounded-md border border-mem-ink/20 ${isActive ? centerActiveAccent[center.accent] : ''}`}>
          <Icon className="w-4 h-4" />
        </span>
        {/* 激活项始终带文字（手机横滚 Tab 上也显示），非激活项仅图标，保证任何宽度不溢出 */}
        {showLabel && isActive && (
          <span className="inline whitespace-nowrap">{t(center.labelKey)}</span>
        )}
      </button>
    );
  };

  return (
    <>
      <header className="shrink-0 w-full max-w-full border-b-[3px] border-mem-ink bg-white z-40 relative shadow-memphis-sm">
        {/* 手机：紧凑顶栏——品牌行自身可拖，交互组 no-drag 豁免 */}
        <div className={`flex md:hidden items-center justify-between gap-2 px-3 py-2 min-h-[56px] ${dragRowClass}`} data-drag-row>
          <div className="no-drag">
            <BrandMark compact showSubtitle={false} />
          </div>
          <div className="flex items-center gap-1.5 shrink-0 no-drag">
            {statusDot}
            <button
              type="button"
              onClick={() => setAppearanceOpen(true)}
              className="zs-touch-target flex items-center justify-center rounded-xl bg-mem-lavender/30 border-2 border-mem-ink text-mem-ink/80"
              title={t('appearance.entry')}
            >
              <Palette className="w-4 h-4 text-mem-lavender" />
            </button>
            <button
              type="button"
              onClick={() => onOpenPrivacy?.()}
              className="zs-touch-target flex items-center justify-center rounded-xl bg-mem-teal/30 border-2 border-mem-ink text-mem-ink/80"
              title={t('privacy.title')}
            >
              <ShieldCheck className="w-4 h-4 text-mem-teal" />
            </button>
            <button
              type="button"
              onClick={() => setSupportOpen(true)}
              className="zs-touch-target flex items-center justify-center rounded-xl bg-mem-yellow/50 border-2 border-mem-ink text-mem-ink/80"
              title={t('header.supportTitle')}
            >
              <Coffee className="w-4 h-4 text-mem-coral" />
            </button>
            <LanguageSwitcher />
          </div>
        </div>

        {/* 手机：横向中心 Tab（图标 + 可横向滚动，非标题栏不加 drag） */}
        <nav
          className="md:hidden zs-mobile-scroll-x flex items-center gap-1.5 px-2 py-2 border-t border-mem-ink/10"
          aria-label={t('lang.label')}
        >
          {CENTERS.map((center) => centerButton(center, true))}
        </nav>

        {/* 桌面：品牌行自身可拖（h-20 标题栏），三组交互区 no-drag 豁免。
            画布手势期（html[data-canvas-gesture]）整行临时转 no-drag，
            防止方框拖动滑进行内被 WebView2 接管成拖窗口。
            布局：中列 min-w-0 可收缩 + 中心导航横向滚动 + 右列 spacer，
            保证引擎状态条在任何窗宽下都不进入右侧窗口按钮区。 */}
        <div
          data-drag-row
          className={`hidden md:flex h-20 w-full px-6 items-center justify-between gap-4 min-w-0 pr-[150px] ${dragRowClass}`}
        >
          <div className="flex items-center gap-2 shrink-0 min-w-0 no-drag">
            <BrandMark />
            <button
              type="button"
              onClick={() => setAppearanceOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium
                         bg-mem-lavender/25 border-2 border-mem-ink text-mem-ink/80
                         hover:bg-mem-lavender/40 hover:-translate-y-px transition-all"
              title={t('appearance.entry')}
            >
              <Palette className="w-3.5 h-3.5 text-mem-lavender" />
              <span className="font-brand-script text-sm leading-none">{t('appearance.entry')}</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenPrivacy?.()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium
                         bg-mem-teal/25 border-2 border-mem-ink text-mem-ink/80
                         hover:bg-mem-teal/40 hover:-translate-y-px transition-all"
              title={t('privacy.title')}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-mem-teal" />
              <span className="font-brand-script text-sm leading-none">{t('privacy.title')}</span>
            </button>
            <button
              type="button"
              onClick={() => setSupportOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium
                         bg-mem-yellow/50 border-2 border-mem-ink text-mem-ink/80
                         hover:bg-mem-coral/20 hover:-translate-y-px transition-all"
              title={t('header.supportTitle')}
            >
              <Coffee className="w-3.5 h-3.5 text-mem-coral" />
              <span className="font-brand-script text-sm leading-none">{t('header.supportAuthor')}</span>
            </button>
            <LanguageSwitcher />
          </div>

          <nav
            ref={centersNavRef}
            onWheel={handleCentersWheel}
            className="flex items-center gap-1 p-1.5 rounded-2xl bg-mem-cream border-2 border-mem-ink shrink min-w-0 overflow-x-auto zs-wheel-x zs-hide-scrollbar no-drag"
          >
            {CENTERS.map((center) => centerButton(center, true))}
          </nav>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-mem-lime/30 border-2 border-mem-ink text-xs shrink min-w-0 no-drag">
            {statusDot}
            {/* min-w 底线：中列收缩把芯片挤窄时，引擎文字至少保留 4 字宽度再省略，
                否则 span 被压成 ~14px 竖条逐字换行裁切（round-6 问题1 实测截图）。 */}
            <span className="text-mem-ink/60 whitespace-nowrap overflow-hidden text-ellipsis min-w-[76px]">{engineLabel}</span>
            <span className="font-bold text-mem-ink whitespace-nowrap shrink-0">
              {t('header.rulesCount', { count: systemStatus.activeRulesCount })}
            </span>
          </div>
        </div>
      </header>

      <SupportAuthorModal open={supportOpen} onClose={() => setSupportOpen(false)} />
      <AppearanceModal open={appearanceOpen} onClose={() => setAppearanceOpen(false)} />
    </>
  );
};
