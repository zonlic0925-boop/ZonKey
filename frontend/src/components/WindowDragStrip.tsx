/**
 * 无边框窗口的顶部拖拽带（仅桌面壳内渲染）。
 *
 * `app-region: drag` 依赖桌面壳打开 WebView2 的
 * IsNonClientRegionSupportEnabled（core/frameless_window.py）：
 * 鼠标落在带上时 WebView2 返回 HTCAPTION → 原生拖拽 / Aero Snap /
 * Snap 布局悬浮卡 / 双击最大化，与系统标题栏行为完全一致。
 *
 * 浏览器 / 手机：useShellMode() 为 false，不渲染（app-region 也只在
 * WebView2 非客户区模式下生效，其他环境是普通透明条）。
 */
import React from 'react';
import { useShellMode } from '../lib/deliver';

export const WindowDragStrip: React.FC = () => {
  const shellMode = useShellMode();
  if (!shellMode) return null;
  return (
    // 盖在 Header 顶边的透明细条；右侧留出窗口控制按钮的可点区
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-[132px] h-10 z-[90] pointer-events-auto"
      style={{ appRegion: 'drag', WebkitAppRegion: 'drag' } as React.CSSProperties}
    />
  );
};
