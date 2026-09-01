/**
 * 主题 Context：React 侧唯一真源入口。
 *
 * 职责：加载/持久化主题与纹理 → 写 <html data-theme> → 通知壳层
 * （ui_prefs.json 镜像，供下次启动的闪屏底色联动）。
 * 用 useSyncExternalStore 之外普通 state 即可——写入方只有 UI，
 * 跨窗口同步不存在（单窗口应用）。
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  type TextureId,
  type ThemeId,
  applyThemeToDom,
  loadTexture,
  loadTheme,
  saveTexture,
  saveTheme,
} from './themeCore';

interface ThemeContextValue {
  theme: ThemeId;
  texture: TextureId;
  setTheme: (t: ThemeId) => void;
  setTexture: (t: TextureId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** 壳层镜像协议：pywebview api 可选提供（浏览器无壳直接跳过） */
interface ShellPrefsApi {
  save_ui_prefs?: (prefs: { theme: string; texture: string }) => Promise<unknown>;
}

function pushPrefsToShell(theme: ThemeId, texture: TextureId): void {
  const api = (window as unknown as { pywebview?: { api?: ShellPrefsApi } }).pywebview?.api;
  api?.save_ui_prefs?.({ theme, texture })?.catch?.(() => undefined);
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeId>(loadTheme);
  const [texture, setTextureState] = useState<TextureId>(loadTexture);

  // data-theme 写根元素：index.css 变量块选择器吃这个属性
  useEffect(() => {
    applyThemeToDom(theme);
  }, [theme]);

  // 首挂时把已存偏好补推给壳层（壳内场景保证 ui_prefs.json 与 localStorage 一致）
  useEffect(() => {
    pushPrefsToShell(theme, texture);
    // 仅首挂一次；后续变更在 setTheme/setTexture 里即时推
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTheme = useCallback(
    (t: ThemeId) => {
      setThemeState(t);
      saveTheme(t);
      pushPrefsToShell(t, texture);
    },
    [texture],
  );

  const setTexture = useCallback(
    (t: TextureId) => {
      setTextureState(t);
      saveTexture(t);
      pushPrefsToShell(theme, t);
    },
    [theme],
  );

  const value = useMemo(() => ({ theme, texture, setTheme, setTexture }), [theme, texture, setTheme, setTexture]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
