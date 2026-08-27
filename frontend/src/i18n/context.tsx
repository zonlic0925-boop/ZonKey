import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { APP_NAME, APP_TAGLINE } from '../lib/brand';
import { en } from './locales/en';
import { zhCN } from './locales/zh-CN';
import { zhTW } from './locales/zh-TW';
import type { Locale, MessageTree } from './types';

const STORAGE_KEY = 'zonscale-locale';

const MESSAGES: Record<Locale, MessageTree> = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  en,
};

type Vars = Record<string, string | number>;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Vars) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function resolve(messages: MessageTree, key: string): string | undefined {
  const parts = key.split('.');
  let cur: unknown = messages;
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as MessageTree)[part];
  }
  return typeof cur === 'string' ? cur : undefined;
}

function interpolate(text: string, vars?: Vars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}

function detectDefaultLocale(): Locale {
  if (typeof window === 'undefined') return 'zh-CN';
  const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
  if (saved && saved in MESSAGES) return saved;
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith('zh-tw') || lang.startsWith('zh-hk') || lang.startsWith('zh-mo')) return 'zh-TW';
  if (lang.startsWith('zh')) return 'zh-CN';
  if (lang.startsWith('en')) return 'en';
  return 'zh-CN';
}

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(detectDefaultLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const t = useCallback(
    (key: string, vars?: Vars) => {
      const merged = { appName: APP_NAME, tagline: APP_TAGLINE, ...vars };
      const text =
        resolve(MESSAGES[locale], key) ??
        resolve(MESSAGES['zh-CN'], key) ??
        key;
      return interpolate(text, merged);
    },
    [locale]
  );

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = t('meta.pageTitle');
  }, [locale, t]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
