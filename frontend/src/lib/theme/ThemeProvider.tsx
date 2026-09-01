/**
 * 主题 Context：React 侧唯一真源入口。
 *
 * 职责：加载/持久化主题、纹理、字号 → 写 <html data-theme/data-fontsize> →
 * 通知壳层（ui_prefs.json 镜像，供下次启动的闪屏底色联动）。
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  type FontSizeId,
  type TextureId,
  type ThemeId,
  applyFontSizeToDom,
  applyThemeToDom,
  loadFontSize,
  loadTexture,
  loadTheme,
  saveFontSize,
  saveTexture,
  saveTheme,
} from './themeCore';

interface ThemeContextValue {
  theme: ThemeId;
  texture: TextureId;
  fontSize: FontSizeId;
  setTheme: (t: ThemeId) => void;
  setTexture: (t: TextureId) => void;
  setFontSize: (s: FontSizeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** 壳层镜像协议：pywebview api 可选提供（浏览器无壳直接跳过） */
interface ShellPrefsApi {
  save_ui_prefs?: (prefs: { theme: string; texture: string; font_size: string }) => Promise<unknown>;
}

function pushPrefsToShell(theme: ThemeId, texture: TextureId, fontSize: FontSizeId): void {
  const api = (window as unknown as { pywebview?: { api?: ShellPrefsApi } }).pywebview?.api;
  api?.save_ui_prefs?.({ theme, texture, font_size: fontSize })?.catch?.(() => undefined);
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeId>(loadTheme);
  const [texture, setTextureState] = useState<TextureId>(loadTexture);
  const [fontSize, setFontSizeState] = useState<FontSizeId>(loadFontSize);

  // data-theme 写根元素：index.css 变量块选择器吃这个属性
  useEffect(() => {
    applyThemeToDom(theme);
  }, [theme]);

  // 字号写根元素：根字号一变全站 rem 等比缩放
  useEffect(() => {
    applyFontSizeToDom(fontSize);
  }, [fontSize]);

  // 首挂时把已存偏好补推给壳层（壳内场景保证 ui_prefs.json 与 localStorage 一致）
  useEffect(() => {
    pushPrefsToShell(theme, texture, fontSize);
    // 仅首挂一次；后续变更在 setter 里即时推
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTheme = useCallback(
    (t: ThemeId) => {
      setThemeState(t);
      saveTheme(t);
      pushPrefsToShell(t, texture, fontSize);
    },
    [texture, fontSize],
  );

  const setTexture = useCallback(
    (t: TextureId) => {
      setTextureState(t);
      saveTexture(t);
      pushPrefsToShell(theme, t, fontSize);
    },
    [theme, fontSize],
  );

  const setFontSize = useCallback(
    (s: FontSizeId) => {
      setFontSizeState(s);
      saveFontSize(s);
      pushPrefsToShell(theme, texture, s);
    },
    [theme, texture],
  );

  const value = useMemo(
    () => ({ theme, texture, fontSize, setTheme, setTexture, setFontSize }),
    [theme, texture, fontSize, setTheme, setTexture, setFontSize],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
