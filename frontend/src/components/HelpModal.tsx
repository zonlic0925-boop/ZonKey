import React from 'react';
import { X, HelpCircle, Download, FileText, Shield, Coffee, Globe, Lock, Zap, ExternalLink, Smartphone, Monitor } from 'lucide-react';
import { APP_NAME, PROJECT_REPO_URL, PROJECT_GITHUB_URL } from '../lib/brand';
import { useI18n } from '../i18n';

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ open, onClose }) => {
  const { t } = useI18n();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-mem-ink/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="memphis-card max-w-2xl w-full max-h-[88dvh] overflow-y-auto p-6 relative animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-mem-yellow/40 text-mem-ink/60"
          aria-label={t('common.close')}
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <HelpCircle className="w-5 h-5 text-mem-sky" />
          <h2 className="font-display font-black text-xl text-mem-ink">{t('help.title')}</h2>
        </div>

        {/* 简介 */}
        <div className="rounded-xl border-2 border-mem-ink bg-mem-cream/60 p-4 mb-4">
          <div className="flex items-start gap-2 mb-2">
            <Globe className="w-4 h-4 text-mem-teal mt-0.5 shrink-0" />
            <p className="text-sm font-bold text-mem-ink">{t('help.intro')}</p>
          </div>
          <p className="text-xs text-mem-ink/60">{t('help.introDesc')}</p>
        </div>

        {/* 核心功能 */}
        <div className="rounded-xl border-2 border-mem-ink bg-white p-4 mb-4">
          <h3 className="font-display font-bold text-sm text-mem-ink mb-3 flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-mem-yellow" />
            {t('help.features')}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { icon: Shield, label: t('help.featureRedact'), desc: t('help.featureRedactDesc') },
              { icon: FileText, label: t('help.featurePdf'), desc: t('help.featurePdfDesc') },
              { icon: Lock, label: t('help.featureLocal'), desc: t('help.featureLocalDesc') },
              { icon: Coffee, label: t('help.featureFree'), desc: t('help.featureFreeDesc') },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-2 p-2 rounded-lg bg-mem-cream/40">
                <Icon className="w-3.5 h-3.5 text-mem-teal mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-mem-ink">{label}</p>
                  <p className="text-[11px] text-mem-ink/55">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 下载与安装 */}
        <div className="rounded-xl border-2 border-mem-ink bg-mem-sky/10 p-4 mb-4">
          <h3 className="font-display font-bold text-sm text-mem-ink mb-2 flex items-center gap-1.5">
            <Download className="w-4 h-4 text-mem-sky" />
            {t('help.download')}
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex items-start gap-2">
              <Monitor className="w-3.5 h-3.5 text-mem-ink/50 mt-0.5 shrink-0" />
              <div>
                <span className="font-bold">{t('help.desktop')}</span>
                <span className="text-mem-ink/55"> — {t('help.desktopDesc')}</span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Smartphone className="w-3.5 h-3.5 text-mem-ink/50 mt-0.5 shrink-0" />
              <div>
                <span className="font-bold">{t('help.mobile')}</span>
                <span className="text-mem-ink/55"> — {t('help.mobileDesc')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 使用步骤 */}
        <div className="rounded-xl border-2 border-mem-ink bg-white p-4 mb-4">
          <h3 className="font-display font-bold text-sm text-mem-ink mb-3 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-mem-coral" />
            {t('help.quickStart')}
          </h3>
          <ol className="space-y-2 text-xs">
            {[
              t('help.step1'),
              t('help.step2'),
              t('help.step3'),
              t('help.step4'),
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-mem-teal/20 border border-mem-ink flex items-center justify-center text-[10px] font-black shrink-0">{i + 1}</span>
                <span className="text-mem-ink/70 mt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* 仓库链接 */}
        <div className="rounded-xl border-2 border-mem-ink bg-mem-cream/60 p-4 mb-4">
          <h3 className="font-display font-bold text-sm text-mem-ink mb-2 flex items-center gap-1.5">
            <ExternalLink className="w-4 h-4 text-mem-ink" />
            {t('help.repo')}
          </h3>
          <div className="space-y-1.5 text-xs">
            <a
              href={PROJECT_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-mem-teal hover:text-mem-ink underline"
            >
              {t('help.gitee')} — {PROJECT_REPO_URL}
            </a>
            <a
              href={PROJECT_GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-mem-teal hover:text-mem-ink underline"
            >
              {t('help.github')} — {PROJECT_GITHUB_URL}
            </a>
          </div>
        </div>

        <p className="text-xs text-mem-ink/40 text-center">
          {APP_NAME} · {t('help.footer')}
        </p>
      </div>
    </div>
  );
};