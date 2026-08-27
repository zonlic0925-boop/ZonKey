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

  return (
    <>
      <header className="h-20 w-full px-6 flex items-center justify-between border-b-[3px] border-mem-ink bg-white z-40 relative shadow-memphis-sm">
        <div className="flex items-center gap-2 shrink-0">
          <BrandMark />
          <button
            type="button"
            onClick={() => setSupportOpen(true)}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium
                       bg-mem-yellow/50 border-2 border-mem-ink text-mem-ink/80
                       hover:bg-mem-coral/20 hover:-translate-y-px transition-all"
            title={t('header.supportTitle')}
          >
            <Coffee className="w-3.5 h-3.5 text-mem-coral" />
            <span className="font-brand-script text-sm leading-none">{t('header.supportAuthor')}</span>
          </button>
          <LanguageSwitcher />
        </div>

        <nav className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-mem-cream border-2 border-mem-ink">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`group flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all duration-150 ${
                  isActive ? 'memphis-tab-active' : 'memphis-tab-inactive'
                }`}
              >
                <span className={`p-1 rounded-md border border-mem-ink/20 ${isActive ? tab.accent : ''}`}>
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <span className="hidden lg:inline">{t(tab.labelKey)}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-mem-lime/30 border-2 border-mem-ink text-[11px]">
          <span
            className={`w-2 h-2 rounded-full border border-mem-ink ${
              backendOnline === false ? 'bg-mem-coral' : 'bg-mem-teal'
            }`}
          />
          <span className="text-mem-ink/60">{engineLabel}</span>
          <span className="font-bold text-mem-ink">
            {t('header.rulesCount', { count: systemStatus.activeRulesCount })}
          </span>
        </div>
      </header>

      <SupportAuthorModal open={supportOpen} onClose={() => setSupportOpen(false)} />
    </>
  );
};
