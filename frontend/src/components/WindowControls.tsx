/**
 * 无边框窗口的自绘窗口控制（仅桌面壳内渲染）。
 *
 * - 桌面壳（pywebview frameless）：右上角最小化 / 最大化-还原 / 关闭，
 *   经 window.pywebview.api 调 Python 侧 WindowApi；
 *   窗口拖拽 / 边缘缩放 / Aero Snap / 双击顶栏最大化由原生钩子
 *   core/frameless_window.py 处理（WM_NCHITTEST → HTCAPTION）。
 * - 浏览器 / 手机：useShellMode() 为 false，不渲染任何东西。
 *
 * 最大化状态：窗口事件不透传到 JS，采用「操作后即时查询 + 低频轮询兜底」
 * 同步按钮的 最大化⇄还原 图标与 title。
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Minus, Square, X } from 'lucide-react';
import { useShellMode } from '../lib/deliver';
import { useI18n } from '../i18n';

/** pywebview 注入的窗口控制 API（desktop_app.py::WindowApi） */
interface ShellWindowApi {
  minimize: () => Promise<void>;
  toggle_maximize: () => Promise<void>;
  restore: () => Promise<void>;
  is_maximized: () => Promise<boolean>;
  close: () => Promise<void>;
}

function getShellApi(): ShellWindowApi | null {
  const shell = (window as unknown as { pywebview?: { api?: Partial<ShellWindowApi> } }).pywebview;
  if (!shell?.api?.minimize || !shell?.api?.toggle_maximize || !shell?.api?.close) return null;
  return shell.api as ShellWindowApi;
}

export const WindowControls: React.FC = () => {
  const shellMode = useShellMode();
  const { t } = useI18n();
  const [maximized, setMaximized] = useState(false);
  // 轮询兜底：用户用 Win+↑/↓、Snap、任务栏等系统途径改变窗口状态时前端收不到通知
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (!shellMode) return;
    let cancelled = false;
    const sync = () => {
      getShellApi()
        ?.is_maximized()
        .then((v) => {
          if (!cancelled) setMaximized(Boolean(v));
        })
        .catch(() => undefined);
    };
    sync();
    pollRef.current = window.setInterval(sync, 1500);
    return () => {
      cancelled = true;
      if (pollRef.current !== null) window.clearInterval(pollRef.current);
    };
  }, [shellMode]);

  const call = useCallback((fn: (api: ShellWindowApi) => Promise<void>) => {
    const api = getShellApi();
    if (!api) return;
    fn(api).catch(() => undefined);
  }, []);

  if (!shellMode) return null;

  const maximizeLabel = maximized ? t('window.restore') : t('window.maximize');

  const onToggleMaximize = () =>
    call((api) => (maximized ? api.restore() : api.toggle_maximize()));

  return (
    <div className="fixed top-2 right-3 z-[100] flex items-center gap-1 no-drag" role="group">
      <button
        type="button"
        onClick={() => call((api) => api.minimize())}
        title={t('window.minimize')}
        aria-label={t('window.minimize')}
        className="zs-win-ctrl"
      >
        <Minus className="h-4 w-4" strokeWidth={2.5} />
      </button>
      <button
        type="button"
        onClick={onToggleMaximize}
        title={maximizeLabel}
        aria-label={maximizeLabel}
        aria-pressed={maximized}
        className="zs-win-ctrl"
      >
        {maximized ? (
          // 还原图标：Windows 惯例是双叠方块（右下偏移的原窗口 + 左上焦点框）
          <span className="relative block h-3.5 w-3.5" aria-hidden="true">
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 border-[2px] border-current" />
            <span className="absolute left-0 top-0 h-2 w-2 border-l-2 border-t-2 border-current" />
          </span>
        ) : (
          <Square className="h-3.5 w-3.5" strokeWidth={2.5} />
        )}
      </button>
      <button
        type="button"
        onClick={() => call((api) => api.close())}
        title={t('window.close')}
        aria-label={t('window.close')}
        className="zs-win-ctrl zs-win-ctrl-close"
      >
        <X className="h-4 w-4" strokeWidth={2.5} />
      </button>
    </div>
  );
};
