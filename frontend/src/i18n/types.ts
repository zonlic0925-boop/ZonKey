export type Locale = 'zh-CN' | 'zh-TW' | 'en';

export type MessageValue = string | MessageTree;
export interface MessageTree {
  [key: string]: MessageValue;
}

export const LOCALE_LABELS: Record<Locale, string> = {
  'zh-CN': '简体',
  'zh-TW': '繁體',
  en: 'EN',
};

export const LOCALE_NAMES: Record<Locale, string> = {
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  en: 'English',
};
