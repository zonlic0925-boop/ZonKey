import React, { useEffect, useRef, useState } from 'react';
import { Languages, ChevronDown } from 'lucide-react';
import { LOCALE_LABELS, LOCALE_NAMES, useI18n, type Locale } from '../i18n';

const LOCALES: Locale[] = ['zh-CN', 'zh-TW', 'en'];

interface LanguageSwitcherProps {
  /** 菜单对齐：left=按钮左缘（桌面工具行靠左）；right=按钮右缘向左展开
   *  （手机顶栏最右侧，left 对齐会把菜单推出视口右缘）。 */
  align?: 'left' | 'right';
  /** 手机顶栏专用：按钮与菜单项放大到 44px 触控目标。 */
  largeTouch?: boolean;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ align = 'left', largeTouch = false }) => {
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
        className={`flex items-center rounded-xl bg-white border-2 border-mem-ink/30 hover:border-mem-ink/60 transition-colors ${
          largeTouch ? 'gap-1.5 px-2.5 min-h-[44px]' : 'gap-1 px-2 py-1.5'
        }`}
        title={t('lang.label')}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Languages className={`text-mem-ink/60 ${largeTouch ? 'w-4 h-4' : 'w-3.5 h-3.5'}`} />
        <span className={`font-bold text-mem-ink text-center ${largeTouch ? 'text-xs min-w-[2rem]' : 'text-xs min-w-[2rem]'}`}>
          {LOCALE_LABELS[locale]}
        </span>
        <ChevronDown className={`text-mem-ink/40 transition-transform ${largeTouch ? 'w-3.5 h-3.5' : 'w-3 h-3'} ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className={`absolute top-full mt-1.5 min-w-[9rem] py-1 rounded-xl bg-white border-2 border-mem-ink shadow-memphis-sm z-50 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
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
              className={`w-full text-left px-3 transition-colors ${
                largeTouch ? 'py-2.5 text-sm' : 'py-2 text-xs'
              } ${locale === code ? 'bg-mem-teal/30 font-bold text-mem-ink' : 'text-mem-ink/70 hover:bg-mem-yellow/40'}`}
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
