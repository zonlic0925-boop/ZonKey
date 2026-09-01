/**
 * 无边框窗口的拖拽层（仅桌面壳内渲染）。
 *
 * `app-region: drag` 依赖桌面壳打开 WebView2 的
 * IsNonClientRegionSupportEnabled（core/frameless_window.py）：
 * 鼠标落在带上时 WebView2 返回 HTCAPTION → 原生拖拽 / Aero Snap /
 * Snap 布局悬浮卡 / 双击最大化，与系统标题栏行为完全一致。
 *
 * ⚠️ 历史教训：曾用「fixed 全宽 40px 覆盖条」盖在 Header 顶边，但内容区
 * （图纸画布等）滚动进入顶部 40px 后会被它劫持成拖窗口，用户无法拖动
 * 脱敏方框。现在只对真正的标题栏行（Header 桌面布局的顶行）套 drag，
 * 内容区永不覆盖。右侧留出窗口控制按钮的可点区。
 *
 * 浏览器 / 手机：useShellMode() 为 false，不渲染（app-region 也只在
 * WebView2 非客户区模式下生效，其他环境是普通 div）。
 */
import React from 'react';
import { useShellMode } from '../lib/deliver';

export const WindowDragStrip: React.FC = () => {
  const shellMode = useShellMode();
  if (!shellMode) return null;
  return (
    <>
      {/* 桌面 Header 顶行（h-20 品牌行）：整行可拖，右侧留出窗口按钮 */}
      <div
        aria-hidden="true"
        className="hidden md:block fixed top-0 left-0 right-[132px] h-20 z-[80]"
        style={{ appRegion: 'drag', WebkitAppRegion: 'drag' } as React.CSSProperties}
      />
      {/* 手机/紧凑布局顶栏（h-14 品牌行）同理可拖 */}
      <div
        aria-hidden="true"
        className="md:hidden fixed top-0 left-0 right-0 h-14 z-[80]"
        style={{ appRegion: 'drag', WebkitAppRegion: 'drag' } as React.CSSProperties}
      />
    </>
  );
};
