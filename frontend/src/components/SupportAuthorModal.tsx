import React, { useState } from 'react';
import { X, Coffee, Mail, User, Star, ExternalLink, Smartphone, Copy, CheckCircle2 } from 'lucide-react';
import {
  APP_NAME,
  AUTHOR_EMAIL,
  AUTHOR_GITHUB_URL,
  PROJECT_REPO_URL,
  PROJECT_REPO_GITEE_URL,
  SUPPORT_ALIPAY_QR,
  SUPPORT_WECHAT_QR,
  SUPPORT_ALIPAY_DEEPLINK,
  SUPPORT_WECHAT_DEEPLINK,
} from '../lib/brand';
import { isMobileDevice } from '../lib/deliver';
import { useI18n } from '../i18n';

interface SupportAuthorModalProps {
  open: boolean;
  onClose: () => void;
}

export const SupportAuthorModal: React.FC<SupportAuthorModalProps> = ({ open, onClose }) => {
  const { t } = useI18n();
  const [copied, setCopied] = useState<'alipay' | 'wechat' | null>(null);

  if (!open) return null;

  const onMobile = isMobileDevice();

  const copyQrToClipboard = async (name: 'alipay' | 'wechat') => {
    const imgUrl = name === 'alipay' ? SUPPORT_ALIPAY_QR : SUPPORT_WECHAT_QR;
    const fullUrl = `${window.location.origin}${imgUrl}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(name);
      setTimeout(() => setCopied(null), 2500);
    } catch {
      // 回退：创建临时 textarea 复制
      const ta = document.createElement('textarea');
      ta.value = fullUrl;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      setCopied(name);
      setTimeout(() => setCopied(null), 2500);
    }
  };

  const alipayLink = SUPPORT_ALIPAY_DEEPLINK || '';
  const wechatLink = SUPPORT_WECHAT_DEEPLINK || '';

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
        <p className="text-xs text-mem-ink/55 mb-4 leading-relaxed">{t('support.description', { appName: APP_NAME })}</p>

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

        {/* GitHub + Gitee 链接 */}
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
                {t('support.projectRepo')}
              </span>
              <span className="block text-xs text-mem-ink/45 truncate mt-0.5">{PROJECT_REPO_URL}</span>
            </span>
            <ExternalLink className="w-3 h-3 text-mem-ink/40 shrink-0" />
          </a>
          {/* Gitee 镜像（国内用户可直达） */}
          <a
            href={PROJECT_REPO_GITEE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-mem-ink/20 bg-mem-cream/50 hover:bg-mem-coral/15 transition-colors text-xs text-mem-ink"
          >
            <span className="min-w-0">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Star className="w-3.5 h-3.5 text-mem-coral shrink-0" />
                {t('support.giteeRepo')}
              </span>
              <span className="block text-xs text-mem-ink/45 truncate mt-0.5">{PROJECT_REPO_GITEE_URL}</span>
            </span>
            <ExternalLink className="w-3 h-3 text-mem-ink/40 shrink-0" />
          </a>
          <p className="text-xs text-mem-ink/55 leading-relaxed pt-1 border-t border-mem-ink/10">
            {t('support.starHint')}
          </p>
        </div>

        {/* 打赏区：移动端一键支付，桌面端二维码 */}
        {onMobile ? (
          <div className="space-y-3 mb-4">
            <p className="text-xs text-mem-ink/60 text-center">{t('support.mobilePayHint')}</p>
            <div className="grid grid-cols-2 gap-3">
              {/* 支付宝一键支付 */}
              <div className="memphis-card-flat p-3 flex flex-col items-center gap-2">
                <span className="text-xs font-semibold text-[#1677FF]">{t('support.alipayLabel')}</span>
                {alipayLink ? (
                  <a
                    href={alipayLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#1677FF] text-white text-xs font-bold hover:bg-[#1677FF]/90 transition-colors"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    {t('support.payNow')}
                  </a>
                ) : (
                  <>
                    <img
                      src={SUPPORT_ALIPAY_QR}
                      alt={t('support.alipayQrAlt')}
                      className="w-full max-w-[120px] rounded-lg border border-mem-ink/10"
                    />
                    <button
                      type="button"
                      onClick={() => copyQrToClipboard('alipay')}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-mem-ink/20 bg-white text-xs text-mem-ink/60 hover:text-mem-ink hover:border-mem-ink transition-colors"
                    >
                      {copied === 'alipay' ? (
                        <CheckCircle2 className="w-3 h-3 text-green-600" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      {copied === 'alipay' ? t('support.copied') : t('support.copyQr')}
                    </button>
                  </>
                )}
              </div>
              {/* 微信一键支付 */}
              <div className="memphis-card-flat p-3 flex flex-col items-center gap-2">
                <span className="text-xs font-semibold text-[#07C160]">{t('support.wechatLabel')}</span>
                {wechatLink ? (
                  <a
                    href={wechatLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#07C160] text-white text-xs font-bold hover:bg-[#07C160]/90 transition-colors"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    {t('support.payNow')}
                  </a>
                ) : (
                  <>
                    <img
                      src={SUPPORT_WECHAT_QR}
                      alt={t('support.wechatQrAlt')}
                      className="w-full max-w-[120px] rounded-lg border border-mem-ink/10"
                    />
                    <button
                      type="button"
                      onClick={() => copyQrToClipboard('wechat')}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-mem-ink/20 bg-white text-xs text-mem-ink/60 hover:text-mem-ink hover:border-mem-ink transition-colors"
                    >
                      {copied === 'wechat' ? (
                        <CheckCircle2 className="w-3 h-3 text-green-600" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      {copied === 'wechat' ? t('support.copied') : t('support.copyQr')}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs text-mem-ink/60 text-center mb-3">{t('support.qrHint')}</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
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
          </>
        )}

        <p className="text-xs text-mem-ink/40 text-center mt-4">
          {t('support.thanks', { appName: APP_NAME })}
        </p>
      </div>
    </div>
  );
};