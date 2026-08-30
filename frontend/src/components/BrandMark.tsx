import React from 'react';
import { APP_NAME, APP_TAGLINE } from '../lib/brand';
import { useI18n } from '../i18n';

interface BrandMarkProps {
  compact?: boolean;
  showSubtitle?: boolean;
}

function ScaleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      aria-hidden
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M24 4L40 13V35L24 44L8 35V13L24 4Z"
        fill="url(#scaleGrad)"
        stroke="#1A1A2E"
        strokeWidth="2.5"
      />
      <path
        d="M24 12L32 17V31L24 36L16 31V17L24 12Z"
        fill="rgba(255,255,255,0.35)"
        stroke="#1A1A2E"
        strokeWidth="1.5"
      />
      <path
        d="M24 20L28 23V29L24 32L20 29V23L24 20Z"
        fill="rgba(255,255,255,0.55)"
      />
      <defs>
        <linearGradient id="scaleGrad" x1="8" y1="4" x2="40" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4ECDC4" />
          <stop offset="0.5" stopColor="#FFE66D" />
          <stop offset="1" stopColor="#FF6B6B" />
        </linearGradient>
      </defs>
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
        <ScaleIcon className={compact ? 'w-6 h-6' : 'w-7 h-7'} />
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
