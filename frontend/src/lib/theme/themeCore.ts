/**
 * 主题真源与持久化（前端侧）。
 *
 * - localStorage `zonscale-theme` / `zonscale-texture` 是运行时真源；
 * - 桌面壳内额外镜像一份 `ui_prefs.json`（经 pywebview api），供
 *   desktop_app.py 在 create_window 前读取设置启动闪屏底色——
 *   Python 读不到 localStorage，只能走文件桥；
 * - <html data-theme> 驱动 index.css 的变量预设块，组件类名零改动。
 */

export type ThemeId = 'cream' | 'paper' | 'slate' | 'dark';
export type TextureId = 'none' | 'grid' | 'dots' | 'paper' | 'fluid';
export type FontSizeId = 'sm' | 'md' | 'lg' | 'xl';

export const THEME_IDS: ThemeId[] = ['cream', 'paper', 'slate', 'dark'];
export const TEXTURE_IDS: TextureId[] = ['none', 'grid', 'dots', 'paper', 'fluid'];
export const FONT_SIZE_IDS: FontSizeId[] = ['sm', 'md', 'lg', 'xl'];

const THEME_KEY = 'zonscale-theme';
const TEXTURE_KEY = 'zonscale-texture';
const FONT_SIZE_KEY = 'zonscale-fontsize';

/** 字号档 → 根字号 rem 缩放（index.css html[data-fontsize] 消费） */
export const FONT_SCALE: Record<FontSizeId, string> = {
  sm: '15px',
  md: '16px',
  lg: '17.5px',
  xl: '19px',
};

/** 壳层启动闪屏底色（desktop_app.py 同表，改色必须两处同步） */
export const THEME_SHELL_BG: Record<ThemeId, string> = {
  cream: '#FFF9F0',
  paper: '#FAFAF8',
  slate: '#E2E8F0',
  dark: '#181826',
};

export function loadTheme(): ThemeId {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v && (THEME_IDS as string[]).includes(v)) return v as ThemeId;
  } catch {
    /* localStorage 不可用（隐私模式等）时用默认 */
  }
  return 'cream';
}

export function loadTexture(): TextureId {
  try {
    const v = localStorage.getItem(TEXTURE_KEY);
    if (v && (TEXTURE_IDS as string[]).includes(v)) return v as TextureId;
  } catch {
    /* 同上 */
  }
  // round-4：默认流动背景（fluid）——用户反馈「流动效果默认化」；
  // 已存偏好（含显式选过「纯色/none」）优先，不受默认值影响。
  return 'fluid';
}

export function loadFontSize(): FontSizeId {
  try {
    const v = localStorage.getItem(FONT_SIZE_KEY);
    if (v && (FONT_SIZE_IDS as string[]).includes(v)) return v as FontSizeId;
  } catch {
    /* 同上 */
  }
  return 'md';
}

export function saveTheme(theme: ThemeId): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* ignore */
  }
}

export function saveTexture(texture: TextureId): void {
  try {
    localStorage.setItem(TEXTURE_KEY, texture);
  } catch {
    /* ignore */
  }
}

export function saveFontSize(size: FontSizeId): void {
  try {
    localStorage.setItem(FONT_SIZE_KEY, size);
  } catch {
    /* ignore */
  }
}

/** 把主题写入 <html> 属性（幂等；index.html 内联脚本在 React 挂载前已做一次防闪屏） */
export function applyThemeToDom(theme: ThemeId): void {
  document.documentElement.setAttribute('data-theme', theme);
}

/** 字号档写 <html> 属性 + 直接设根字号（Tailwind rem 全局等比缩放） */
export function applyFontSizeToDom(size: FontSizeId): void {
  document.documentElement.setAttribute('data-fontsize', size);
  document.documentElement.style.fontSize = FONT_SCALE[size];
}
