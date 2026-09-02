import React from 'react';
import { APP_NAME, APP_TAGLINE } from '../lib/brand';
import { useI18n } from '../i18n';

interface BrandMarkProps {
  compact?: boolean;
  showSubtitle?: boolean;
}

function CrownIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      aria-hidden
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 单皇冠：与 zonkey-icon.svg 同几何，Memphis 三色渐变 + 立体渲染 */}
      <defs>
        <linearGradient id="zgBrand" x1="8" y1="12" x2="56" y2="52" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4ECDC4" />
          <stop offset="0.5" stopColor="#FFE66D" />
          <stop offset="1" stopColor="#FF6B6B" />
        </linearGradient>
        <linearGradient id="zgDarkBrand" x1="14" y1="14" x2="52" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2FA9A0" />
          <stop offset="0.52" stopColor="#D9BE3C" />
          <stop offset="1" stopColor="#D94F52" />
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="58" height="58" rx="9" fill="#FFF9F0" stroke="#1A1A2E" strokeWidth="3" />
      <path d="M7 41.5H57V46.5A4.5 4.5 0 0 1 52.5 51H11.5A4.5 4.5 0 0 1 7 46.5Z" fill="url(#zgBrand)" stroke="#1A1A2E" strokeWidth="3" strokeLinejoin="round" />
      <path d="M6 43V16L18 21L32 8.5L46 21L58 16V43Z" fill="url(#zgBrand)" stroke="#1A1A2E" strokeWidth="3" strokeLinejoin="round" />
      <path d="M42 19.2L56 14.4V43H6V42H41.2L33.8 33.4L46 21Z" fill="url(#zgDarkBrand)" />
      <circle cx="18" cy="21" r="2.6" fill="#FFF9F0" stroke="#1A1A2E" strokeWidth="1.8" />
      <circle cx="32" cy="8.5" r="2.6" fill="#FFF9F0" stroke="#1A1A2E" strokeWidth="1.8" />
      <circle cx="46" cy="21" r="2.6" fill="#FFF9F0" stroke="#1A1A2E" strokeWidth="1.8" />
      <path d="M32 43.2L36 46.4L32 49.6L28 46.4Z" fill="#FFF9F0" stroke="#1A1A2E" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M33.5 44.4L35.1 46.4L33.5 48.4L31.9 46.4Z" fill="url(#zgBrand)" />
    </svg>
  );
}

export const BrandMark: React.FC<BrandMarkProps> = ({
  compact = false,
  showSubtitle = true,
}) => {
  const { t } = useI18n();

  return (
    <div className="flex items-center gap-3 select-none">
      <div
        className={`rounded-xl bg-white border-[3px] border-mem-ink shadow-memphis-sm flex items-center justify-center shrink-0 ${
          compact ? 'w-9 h-9' : 'w-11 h-11'
        }`}
      >
        <CrownIcon className={compact ? 'w-6 h-6' : 'w-7 h-7'} />
      </div>
      <div className="leading-none">
        <div className="flex items-end gap-2 flex-wrap">
          <span className={`brand-wordmark ${compact ? 'text-lg' : 'text-[1.75rem]'}`}>
            {APP_NAME}
          </span>
          {!compact && (
            <span className="text-xs px-2 py-0.5 rounded-lg bg-mem-teal/30 text-mem-ink border-2 border-mem-ink font-semibold mb-1">
              {t('brand.workbenchBadge')}
            </span>
          )}
        </div>
        <p className={`brand-credit mt-1 ${compact ? 'text-xs' : 'text-[13px]'}`}>
          {APP_TAGLINE}
        </p>
        {showSubtitle && !compact && (
          <p className="text-xs text-mem-ink/45 mt-1 tracking-wide">{t('brand.subtitle')}</p>
        )}
      </div>
    </div>
  );
};
