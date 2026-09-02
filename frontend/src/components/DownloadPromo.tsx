import React, { useState } from 'react';
import { MonitorDown, X, Download, Shield, FileText, Lock, ExternalLink, HardDrive } from 'lucide-react';
import { APP_NAME, PROJECT_REPO_URL, PROJECT_GITEE_URL } from '../lib/brand';
import { useShellMode } from '../lib/deliver';
import { useI18n } from '../i18n';

const DISMISS_KEY = 'zonkey.desktopPromoDismissed';

function isDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function dismiss(): void {
  try {
    localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    /* 无 localStorage（隐私模式）则每次显示 */
  }
}

/** 桌面版独有能力（网页版做不到或保真度更低的能力，如实标注） */
const DESKTOP_ONLY_ICONS = { Shield, FileText, Lock } as const;

export const DownloadPromoModal: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const { t } = useI18n();
  if (!open) return null;
  const desktopOnly = [
    { icon: DESKTOP_ONLY_ICONS.Shield, label: t('promo.featRedact'), desc: t('promo.featRedactDesc') },
    { icon: DESKTOP_ONLY_ICONS.FileText, label: t('promo.featOcr'), desc: t('promo.featOcrDesc') },
    { icon: DESKTOP_ONLY_ICONS.Lock, label: t('promo.featSign'), desc: t('promo.featSignDesc') },
  ];
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-mem-ink/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="memphis-card max-w-xl w-full max-h-[88dvh] overflow-y-auto p-6 relative animate-in fade-in zoom-in-95 duration-200"
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

        <div className="flex items-center gap-2 mb-3">
          <MonitorDown className="w-5 h-5 text-mem-sky" />
          <h2 className="font-display font-black text-xl text-mem-ink">{t('promo.title')}</h2>
        </div>
        <p className="text-xs text-mem-ink/60 mb-4">{t('promo.intro')}</p>

        {/* 桌面版独有能力 */}
        <div className="rounded-xl border-2 border-mem-ink bg-white p-4 mb-4">
          <h3 className="font-display font-bold text-sm text-mem-ink mb-3">{t('promo.whyTitle')}</h3>
          <div className="space-y-2">
            {desktopOnly.map(({ icon: Icon, label, desc }) => (
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

        {/* 下载通道：GitHub 主仓库 + Gitee 国内镜像 */}
        <div className="rounded-xl border-2 border-mem-ink bg-mem-sky/10 p-4 mb-4 space-y-3">
          <a
            href={`${PROJECT_REPO_URL}/releases/latest`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border-2 border-mem-ink bg-mem-yellow/40 hover:bg-mem-yellow/60 transition-colors"
          >
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-xs font-black text-mem-ink">
                <Download className="w-3.5 h-3.5" />
                {t('promo.mainChannel')}
              </span>
              <span className="block text-[11px] text-mem-ink/55 mt-0.5">{t('promo.mainChannelDesc')}</span>
            </span>
            <ExternalLink className="w-3.5 h-3.5 text-mem-ink/50 shrink-0" />
          </a>
          <a
            href={`${PROJECT_GITEE_URL}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-mem-ink/30 bg-white hover:bg-mem-teal/20 transition-colors"
          >
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-xs font-bold text-mem-ink">
                <Download className="w-3.5 h-3.5" />
                {t('promo.mirrorChannel')}
              </span>
              <span className="block text-[11px] text-mem-ink/55 mt-0.5">{t('promo.mirrorChannelDesc')}</span>
            </span>
            <ExternalLink className="w-3.5 h-3.5 text-mem-ink/50 shrink-0" />
          </a>
          <div className="flex items-start gap-1.5 text-[11px] text-mem-ink/50">
            <HardDrive className="w-3 h-3 mt-0.5 shrink-0" />
            <span>{t('promo.verifyHint')}</span>
          </div>
        </div>

        <p className="text-[11px] text-mem-ink/40 text-center">{t('promo.footer')}</p>
      </div>
    </div>
  );
};

/**
 * 网页版专属的桌面版下载提示区（round-16 用户反馈④）。
 * 桌面壳内不渲染（已在桌面版里，无需提示）；浏览器端所有页面顶部常驻，
 * 可关闭（localStorage 记忆），点击打开下载弹窗。
 */
export const DownloadPromoBanner: React.FC = () => {
  const { t } = useI18n();
  const shell = useShellMode();
  const [showModal, setShowModal] = useState(false);
  const [hidden, setHidden] = useState(isDismissed);

  if (shell || hidden) return null;

  return (
    <>
      <div className="relative z-20 w-full bg-mem-sky/20 border-b-2 border-mem-ink/20">
        <div className="max-w-6xl mx-auto px-3 py-1.5 flex items-center gap-2">
          <MonitorDown className="w-4 h-4 text-mem-sky shrink-0" />
          <p className="flex-1 min-w-0 text-[11px] sm:text-xs font-medium text-mem-ink/75 truncate">
            {t('promo.banner')}
          </p>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="shrink-0 px-2.5 py-1 rounded-lg border-2 border-mem-ink bg-mem-yellow/50 hover:bg-mem-yellow/70 text-[11px] font-black text-mem-ink transition-colors"
          >
            {t('promo.bannerCta')}
          </button>
          <button
            type="button"
            onClick={() => {
              dismiss();
              setHidden(true);
            }}
            className="shrink-0 p-1 rounded-lg text-mem-ink/40 hover:text-mem-ink"
            aria-label={t('common.close')}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <DownloadPromoModal open={showModal} onClose={() => setShowModal(false)} />
    </>
  );
};
