import React, { useEffect, useRef, useState } from 'react';
import { Languages, ChevronDown } from 'lucide-react';
import { LOCALE_LABELS, LOCALE_NAMES, useI18n, type Locale } from '../i18n';

const LOCALES: Locale[] = ['zh-CN', 'zh-TW', 'en'];

export const LanguageSwitcher: React.FC = () => {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const pick = (code: Locale) => {
    setLocale(code);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-white border-2 border-mem-ink/30 hover:border-mem-ink/60 transition-colors"
        title={t('lang.label')}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Languages className="w-3.5 h-3.5 text-mem-ink/60" />
        <span className="text-xs font-bold text-mem-ink min-w-[2rem] text-center">
          {LOCALE_LABELS[locale]}
        </span>
        <ChevronDown className={`w-3 h-3 text-mem-ink/40 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1.5 min-w-[7.5rem] py-1 rounded-xl bg-white border-2 border-mem-ink shadow-memphis-sm z-50"
          role="menu"
          aria-label={t('lang.label')}
        >
          {LOCALES.map((code) => (
            <button
              key={code}
              type="button"
              role="menuitem"
              onClick={() => pick(code)}
              title={LOCALE_NAMES[code]}
              className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                locale === code
                  ? 'bg-mem-teal/30 font-bold text-mem-ink'
                  : 'text-mem-ink/70 hover:bg-mem-yellow/40'
              }`}
            >
              <span className="font-semibold">{LOCALE_LABELS[code]}</span>
              <span className="block text-xs text-mem-ink/60 mt-0.5">{LOCALE_NAMES[code]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
