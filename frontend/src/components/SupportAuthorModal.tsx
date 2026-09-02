import React from 'react';
import { X, Coffee, Mail, User, Star, ExternalLink } from 'lucide-react';
import {
  APP_NAME,
  AUTHOR_EMAIL,
  AUTHOR_GITHUB_URL,
  PROJECT_REPO_URL,
  PROJECT_GITHUB_URL,
  SUPPORT_ALIPAY_QR,
  SUPPORT_WECHAT_QR,
} from '../lib/brand';
import { useI18n } from '../i18n';

interface SupportAuthorModalProps {
  open: boolean;
  onClose: () => void;
}

export const SupportAuthorModal: React.FC<SupportAuthorModalProps> = ({ open, onClose }) => {
  const { t } = useI18n();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-mem-ink/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="memphis-card max-w-lg w-full max-h-[88dvh] overflow-y-auto p-6 relative animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-mem-yellow/40 text-mem-ink/60"
          aria-label={t('support.close')}
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <Coffee className="w-5 h-5 text-mem-coral" />
          <h2 className="font-brand text-xl brand-wordmark tracking-wider">{t('support.title')}</h2>
        </div>
        <p className="text-xs text-mem-ink/55 mb-4 leading-relaxed">{t('support.description')}</p>

        <div className="rounded-xl border-2 border-mem-ink bg-mem-cream/60 p-4 mb-4">
          <p className="font-display font-bold text-mem-ink text-sm">{t('support.authorName')}</p>
          <p className="font-brand-script text-mem-ink/65 text-base mt-0.5">{t('support.authorBio')}</p>
          <a
            href={`mailto:${AUTHOR_EMAIL}`}
            className="inline-flex items-center gap-1.5 text-xs text-mem-teal hover:text-mem-ink mt-2"
          >
            <Mail className="w-3.5 h-3.5" />
            {AUTHOR_EMAIL}
          </a>
        </div>

        <div className="rounded-xl border-2 border-mem-ink bg-white p-3 mb-4 space-y-2">
          <p className="text-xs font-semibold text-mem-ink/70">{t('support.linksTitle')}</p>
          <a
            href={AUTHOR_GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-mem-ink/20 bg-mem-cream/50 hover:bg-mem-yellow/30 transition-colors text-xs text-mem-ink"
          >
            <span className="min-w-0">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <User className="w-3.5 h-3.5 shrink-0" />
                {t('support.githubProfile')}
              </span>
              <span className="block text-xs text-mem-ink/45 truncate mt-0.5">{AUTHOR_GITHUB_URL}</span>
            </span>
            <ExternalLink className="w-3 h-3 text-mem-ink/40 shrink-0" />
          </a>
          <a
            href={PROJECT_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-mem-ink/20 bg-mem-cream/50 hover:bg-mem-teal/20 transition-colors text-xs text-mem-ink"
          >
            <span className="min-w-0">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Star className="w-3.5 h-3.5 text-mem-coral shrink-0" />
                {t('support.projectRepo')}（Gitee）
              </span>
              <span className="block text-xs text-mem-ink/45 truncate mt-0.5">{PROJECT_REPO_URL}</span>
            </span>
            <ExternalLink className="w-3 h-3 text-mem-ink/40 shrink-0" />
          </a>
          <a
            href={PROJECT_GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-mem-ink/20 bg-mem-cream/50 hover:bg-mem-yellow/30 transition-colors text-xs text-mem-ink"
          >
            <span className="min-w-0">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Star className="w-3.5 h-3.5 text-mem-yellow shrink-0" />
                {t('support.githubMirror')}
              </span>
              <span className="block text-xs text-mem-ink/45 truncate mt-0.5">{PROJECT_GITHUB_URL}</span>
            </span>
            <ExternalLink className="w-3 h-3 text-mem-ink/40 shrink-0" />
          </a>
          <p className="text-xs text-mem-ink/55 leading-relaxed pt-1 border-t border-mem-ink/10">
            {t('support.starHint')}
          </p>
        </div>

        <p className="text-xs text-mem-ink/60 text-center mb-3">{t('support.qrHint')}</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="memphis-card-flat p-2 flex flex-col items-center gap-1.5">
            <img
              src={SUPPORT_ALIPAY_QR}
              alt={t('support.alipayQrAlt')}
              className="w-full max-w-[140px] rounded-lg border border-mem-ink/10"
            />
            <span className="text-xs font-semibold text-[#1677FF]">{t('support.alipayLabel')}</span>
          </div>
          <div className="memphis-card-flat p-2 flex flex-col items-center gap-1.5">
            <img
              src={SUPPORT_WECHAT_QR}
              alt={t('support.wechatQrAlt')}
              className="w-full max-w-[140px] rounded-lg border border-mem-ink/10"
            />
            <span className="text-xs font-semibold text-[#07C160]">{t('support.wechatLabel')}</span>
          </div>
        </div>

        <p className="text-xs text-mem-ink/40 text-center mt-4">
          {t('support.thanks', { appName: APP_NAME })}
        </p>
      </div>
    </div>
  );
};
