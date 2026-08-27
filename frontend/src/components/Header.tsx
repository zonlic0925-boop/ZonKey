import React, { useState } from 'react';
import {
  Compass,
  FileText,
  FileCode,
  ShieldCheck,
  History,
  Coffee,
} from 'lucide-react';
import { TabType } from '../types';
import { BrandMark } from './BrandMark';
import { SupportAuthorModal } from './SupportAuthorModal';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useI18n } from '../i18n';

interface HeaderProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  systemStatus: {
    ocrAvailable: boolean;
    activeRulesCount: number;
  };
  backendOnline?: boolean | null;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  systemStatus,
  backendOnline,
}) => {
  const { t } = useI18n();
  const [supportOpen, setSupportOpen] = useState(false);

  const navTabs: {
    id: TabType;
    labelKey: string;
    icon: React.ComponentType<{ className?: string }>;
    accent: string;
  }[] = [
    { id: 'drawing', labelKey: 'header.navDrawing', icon: Compass, accent: 'bg-mem-coral/20' },
    { id: 'pdf_doc', labelKey: 'header.navPdfDoc', icon: FileText, accent: 'bg-mem-teal/30' },
    { id: 'word_doc', labelKey: 'header.navWordDoc', icon: FileCode, accent: 'bg-mem-pink/30' },
    { id: 'rules', labelKey: 'header.navRules', icon: ShieldCheck, accent: 'bg-mem-yellow/40' },
    { id: 'audit', labelKey: 'header.navAudit', icon: History, accent: 'bg-mem-sky/20' },
  ];

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

  const navButton = (tab: (typeof navTabs)[number], showLabel: boolean) => {
    const Icon = tab.icon;
    const isActive = activeTab === tab.id;
    return (
      <button
        key={tab.id}
        type="button"
        onClick={() => onTabChange(tab.id)}
        title={t(tab.labelKey)}
        className={`group flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 shrink-0 zs-touch-target ${
          isActive ? 'memphis-tab-active' : 'memphis-tab-inactive'
        }`}
      >
        <span className={`p-1 rounded-md border border-mem-ink/20 ${isActive ? tab.accent : ''}`}>
          <Icon className="w-4 h-4" />
        </span>
        {showLabel && <span className="hidden lg:inline whitespace-nowrap">{t(tab.labelKey)}</span>}
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
              onClick={() => setSupportOpen(true)}
              className="zs-touch-target flex items-center justify-center rounded-xl bg-mem-yellow/50 border-2 border-mem-ink text-mem-ink/80"
              title={t('header.supportTitle')}
            >
              <Coffee className="w-4 h-4 text-mem-coral" />
            </button>
            <LanguageSwitcher />
          </div>
        </div>

        {/* 手机：横向 Tab */}
        <nav
          className="md:hidden zs-mobile-scroll-x flex items-center gap-1.5 px-2 pb-2 border-t border-mem-ink/10"
          aria-label={t('lang.label')}
        >
          {navTabs.map((tab) => navButton(tab, false))}
        </nav>

        {/* 桌面：原布局 */}
        <div className="hidden md:flex h-20 w-full px-6 items-center justify-between gap-4">
          <div className="flex items-center gap-2 shrink-0 min-w-0">
            <BrandMark />
            <button
              type="button"
              onClick={() => setSupportOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium
                         bg-mem-yellow/50 border-2 border-mem-ink text-mem-ink/80
                         hover:bg-mem-coral/20 hover:-translate-y-px transition-all"
              title={t('header.supportTitle')}
            >
              <Coffee className="w-3.5 h-3.5 text-mem-coral" />
              <span className="font-brand-script text-sm leading-none">{t('header.supportAuthor')}</span>
            </button>
            <LanguageSwitcher />
          </div>

          <nav className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-mem-cream border-2 border-mem-ink shrink-0">
            {navTabs.map((tab) => navButton(tab, true))}
          </nav>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-mem-lime/30 border-2 border-mem-ink text-[11px] shrink-0">
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
