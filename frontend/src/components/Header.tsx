import React, { useState } from 'react';
import { Coffee, ShieldCheck } from 'lucide-react';
import { CenterId } from '../types';
import { CENTERS } from '../lib/navigation';
import { BrandMark } from './BrandMark';
import { SupportAuthorModal } from './SupportAuthorModal';
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

export const Header: React.FC<HeaderProps> = ({
  activeCenter,
  onCenterChange,
  systemStatus,
  backendOnline,
  onOpenPrivacy,
}) => {
  const { t } = useI18n();
  const [supportOpen, setSupportOpen] = useState(false);

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
        {/* 手机：紧凑顶栏 */}
        <div className="flex md:hidden items-center justify-between gap-2 px-3 py-2 min-h-[56px]">
          <BrandMark compact showSubtitle={false} />
          <div className="flex items-center gap-1.5 shrink-0">
            {statusDot}
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

        {/* 手机：横向中心 Tab（图标 + 可横向滚动） */}
        <nav
          className="md:hidden zs-mobile-scroll-x flex items-center gap-1.5 px-2 py-2 border-t border-mem-ink/10"
          aria-label={t('lang.label')}
        >
          {CENTERS.map((center) => centerButton(center, true))}
        </nav>

        {/* 桌面：原布局 */}
        <div className="hidden md:flex h-20 w-full px-6 items-center justify-between gap-4">
          <div className="flex items-center gap-2 shrink-0 min-w-0">
            <BrandMark />
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

          <nav className="flex items-center gap-1 p-1.5 rounded-2xl bg-mem-cream border-2 border-mem-ink shrink-0">
            {CENTERS.map((center) => centerButton(center, true))}
          </nav>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-mem-lime/30 border-2 border-mem-ink text-xs shrink-0">
            {statusDot}
            <span className="text-mem-ink/60 whitespace-nowrap">{engineLabel}</span>
            <span className="font-bold text-mem-ink whitespace-nowrap">
              {t('header.rulesCount', { count: systemStatus.activeRulesCount })}
            </span>
          </div>
        </div>
      </header>

      <SupportAuthorModal open={supportOpen} onClose={() => setSupportOpen(false)} />
    </>
  );
};
