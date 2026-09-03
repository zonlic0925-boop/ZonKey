import React, { useCallback, useEffect, useState } from 'react';
import {
  MonitorDown,
  X,
  Download,
  Shield,
  FileText,
  Lock,
  ExternalLink,
  HardDrive,
  Copy,
  Check,
  Loader2,
  Package,
  Archive,
  Laptop,
} from 'lucide-react';
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

/* ------------------------------------------------------------------ */
/* 最新版本资产动态解析（round-17）                                      */
/* Release 资产名带日期（如 ZonKey_Setup_x64_20260903.exe），无法静态拼  */
/* 直链，只能走 GitHub API 解析 latest release。仓库公开 → API 匿名可    */
/* 访问；资产下载链接可加公共镜像前缀（ghfast.top 等）加速国内下载。      */
/* ------------------------------------------------------------------ */

type GhAsset = { name: string; browser_download_url: string; size: number; download_count?: number };
type GhRelease = { tag_name: string; assets: GhAsset[] };

const GH_API_LATEST = 'https://api.github.com/repos/zonlic0925-boop/ZonKey/releases/latest';
const MIRROR_PREFIX = 'https://ghfast.top/';
const RELEASE_CACHE_KEY = 'zonkey.latestRelease.v1';
const RELEASE_CACHE_TTL_MS = 10 * 60 * 1000;

type AssetGroup = 'win-setup' | 'win-portable' | 'mac-dmg' | 'mac-zip';

type AssetRow = {
  name: string;
  url: string;
  size: number;
  group: AssetGroup;
  arch: '' | 'arm64' | 'x64';
  /** GitHub Release 官方下载计数（真实统计，零自建设施） */
  downloads: number;
};

const GROUP_ORDER: Record<AssetGroup, number> = {
  'win-setup': 0,
  'win-portable': 1,
  'mac-dmg': 2,
  'mac-zip': 3,
};

/** sha256 校验文件与开发者构建包（build_kit）不进下载列表 */
function parseAsset(a: GhAsset): AssetRow | null {
  const n = a.name;
  if (n.endsWith('.sha256') || n.includes('build_kit')) return null;
  const arch: AssetRow['arch'] = n.includes('arm64') ? 'arm64' : n.includes('x86_64') ? 'x64' : '';
  if (n.startsWith('ZonKey_Setup_') && n.endsWith('.exe')) {
    return { name: n, url: a.browser_download_url, size: a.size, group: 'win-setup', arch, downloads: a.download_count ?? 0 };
  }
  if (n.startsWith('ZonKey_Windows_') && (n.endsWith('.zip') || n.endsWith('.7z'))) {
    return { name: n, url: a.browser_download_url, size: a.size, group: 'win-portable', arch, downloads: a.download_count ?? 0 };
  }
  if (n.startsWith('ZonKey_macOS_') && n.endsWith('.dmg')) {
    return { name: n, url: a.browser_download_url, size: a.size, group: 'mac-dmg', arch, downloads: a.download_count ?? 0 };
  }
  if (n.startsWith('ZonKey_macOS_') && n.endsWith('.zip')) {
    return { name: n, url: a.browser_download_url, size: a.size, group: 'mac-zip', arch, downloads: a.download_count ?? 0 };
  }
  return null;
}

function readReleaseCache(): GhRelease | null {
  try {
    const raw = sessionStorage.getItem(RELEASE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ts: number; release: GhRelease };
    if (!parsed || typeof parsed.ts !== 'number' || !parsed.release?.assets?.length) return null;
    if (Date.now() - parsed.ts > RELEASE_CACHE_TTL_MS) return null;
    return parsed.release;
  } catch {
    return null;
  }
}

function writeReleaseCache(rel: GhRelease): void {
  try {
    sessionStorage.setItem(RELEASE_CACHE_KEY, JSON.stringify({ ts: Date.now(), release: rel }));
  } catch {
    /* 隐私模式等场景写入失败不影响主流程 */
  }
}

function fmtSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  return `${Math.round(bytes / 1048576)} MB`;
}

const GROUP_ICON: Record<AssetGroup, React.ComponentType<{ className?: string }>> = {
  'win-setup': Package,
  'win-portable': Archive,
  'mac-dmg': Laptop,
  'mac-zip': Laptop,
};

const GROUP_LABEL_KEY: Record<AssetGroup, string> = {
  'win-setup': 'promo.winSetupLabel',
  'win-portable': 'promo.winPortableLabel',
  'mac-dmg': 'promo.macDmgLabel',
  'mac-zip': 'promo.macZipLabel',
};

const GROUP_DESC_KEY: Record<AssetGroup, string> = {
  'win-setup': 'promo.winSetupDesc',
  'win-portable': 'promo.winPortableDesc',
  'mac-dmg': 'promo.macDmgDesc',
  'mac-zip': 'promo.macZipDesc',
};

/** 最新版本资产面板：每行「是什么 + 多大 + 叫什么」，直连/加速双通道 */
const LatestReleasePanel: React.FC = () => {
  const { t } = useI18n();
  const [state, setState] = useState<{ status: 'loading' | 'ok' | 'error'; release: GhRelease | null }>({
    status: 'loading',
    release: null,
  });
  const [copiedUrl, setCopiedUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    const cached = readReleaseCache();
    if (cached) {
      setState({ status: 'ok', release: cached });
      return;
    }
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 8000);
    fetch(GH_API_LATEST, { signal: ctrl.signal, headers: { Accept: 'application/vnd.github+json' } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((rel: GhRelease) => {
        if (cancelled) return;
        if (!rel || !Array.isArray(rel.assets) || rel.assets.length === 0) {
          throw new Error('empty assets');
        }
        setState({ status: 'ok', release: rel });
        writeReleaseCache(rel);
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', release: null });
      });
    return () => {
      cancelled = true;
      ctrl.abort();
      window.clearTimeout(timer);
    };
  }, []);

  const copyUrl = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // 非安全上下文/旧内核兜底
      try {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      } catch {
        /* 放弃 */
      }
    }
    setCopiedUrl(url);
    window.setTimeout(() => setCopiedUrl(''), 1600);
  }, []);

  const rows = state.release
    ? state.release.assets
        .map(parseAsset)
        .filter((r): r is AssetRow => r !== null)
        .sort((a, b) => GROUP_ORDER[a.group] - GROUP_ORDER[b.group] || a.name.localeCompare(b.name))
    : [];
  const totalDownloads = rows.reduce((sum, r) => sum + r.downloads, 0);

  return (
    <div className="rounded-xl border-2 border-mem-ink bg-mem-sky/10 p-4 mb-4">
      <div className="flex items-center gap-2 mb-1">
        <Download className="w-4 h-4 text-mem-sky shrink-0" />
        <h3 className="font-display font-bold text-sm text-mem-ink">
          {t('promo.latestVersion')}
          {state.release ? <span className="text-mem-ink/60 font-bold"> · {state.release.tag_name}</span> : null}
        </h3>
      </div>

      {state.status === 'loading' && (
        <p className="flex items-center gap-2 py-2 text-xs text-mem-ink/60">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          {t('promo.loadingAssets')}
        </p>
      )}
      {state.status === 'error' && (
        <p className="py-2 text-xs text-mem-ink/60">{t('promo.assetsError')}</p>
      )}
      {state.status === 'ok' && rows.length === 0 && (
        <p className="py-2 text-xs text-mem-ink/60">{t('promo.assetsError')}</p>
      )}

      <div className="space-y-2">
        {rows.map((row) => {
          const Icon = GROUP_ICON[row.group];
          const archSuffix =
            row.arch === 'arm64'
              ? ` · ${t('promo.archApple')}`
              : row.arch === 'x64'
                ? ` · ${t('promo.archIntel')}`
                : '';
          return (
            <div
              key={row.name}
              className="flex items-center gap-2 p-2.5 rounded-lg border border-mem-ink/25 bg-white"
            >
              <Icon className="w-4 h-4 text-mem-teal shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black text-mem-ink truncate">
                  {t(GROUP_LABEL_KEY[row.group])}
                  {archSuffix}
                  {row.downloads > 0 && (
                    <span className="ml-1.5 font-bold text-mem-ink/45 font-sans">
                      {t('promo.downloadCount', { count: row.downloads })}
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-mem-ink/55 truncate" title={row.name}>
                  {t(GROUP_DESC_KEY[row.group])}
                  {fmtSize(row.size) ? ` · ${fmtSize(row.size)}` : ''} · {row.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => copyUrl(row.url)}
                className="shrink-0 p-1.5 rounded-md text-mem-ink/45 hover:text-mem-ink hover:bg-mem-cream/60 transition-colors"
                aria-label={t('promo.copyLink')}
                title={t('promo.copyLink')}
              >
                {copiedUrl === row.url ? (
                  <Check className="w-3.5 h-3.5 text-mem-teal" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
              <a
                href={row.url}
                className="shrink-0 px-2 py-1 rounded-md border border-mem-ink/35 bg-white hover:bg-mem-cream/60 text-[11px] font-bold text-mem-ink/75 transition-colors"
              >
                {t('promo.direct')}
              </a>
              <a
                href={`${MIRROR_PREFIX}${row.url}`}
                className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md border-2 border-mem-ink bg-mem-yellow/50 hover:bg-mem-yellow/70 text-[11px] font-black text-mem-ink transition-colors"
                title={`${MIRROR_PREFIX}${row.url}`}
              >
                <Download className="w-3 h-3" />
                {t('promo.accel')}
              </a>
            </div>
          );
        })}
      </div>

      {totalDownloads > 0 && (
        <p className="mt-2 text-[11px] font-bold text-mem-ink/50 flex items-center gap-1">
          <Download className="w-3 h-3" />
          {t('promo.totalDownloads', { count: totalDownloads })}
        </p>
      )}
      <p className="mt-2.5 text-[11px] leading-relaxed text-mem-ink/50">{t('promo.accelHint')}</p>
    </div>
  );
};

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

        {/* 最新版本资产：动态解析 + 镜像加速（round-17） */}
        <LatestReleasePanel />

        {/* 兜底通道：Release 页 + Gitee 镜像 */}
        <div className="rounded-xl border-2 border-mem-ink bg-white p-4 mb-4 space-y-3">
          <a
            href={`${PROJECT_REPO_URL}/releases`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-mem-ink/30 bg-white hover:bg-mem-yellow/30 transition-colors"
          >
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-xs font-bold text-mem-ink">
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
