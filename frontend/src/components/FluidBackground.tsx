import React from 'react'

/**
 * 流动背景层（默认外观档，AppearanceModal「流动背景」）。
 *
 * 实现（animate skill 规范）：纯 CSS animation 离主线程；每个 blob 只动
 * transform/opacity；26-42s 错相循环 = 氛围可感知但不抢焦点（round-4 重设计：
 * 旧版 135-180s + 低透明度肉眼不可感知，用户反馈「看不出在动」）；颜色全部
 * 走主题变量（各主题下自动协调）；prefers-reduced-motion 完全静止（纯氛围
 * 动效无信息量，减动效场景应完全关停而非放缓）。
 * blob 用 radial-gradient 渐隐边缘，blur 值固定（不动画 filter，避免每帧重采样）。
 */
export const FluidBackground: React.FC = () => (
  <div className="zs-fluid pointer-events-none" aria-hidden="true">
    <div className="zs-fluid-blob zs-fluid-a" />
    <div className="zs-fluid-blob zs-fluid-b" />
    <div className="zs-fluid-blob zs-fluid-d" />
  </div>
)
