import React from 'react'

/**
 * 流动背景层（用户可选开关，AppearanceModal「流动背景」档）。
 *
 * 实现（animate skill 规范）：纯 CSS animation 离主线程；每个 blob 只动
 * transform/opacity；120-180s 超慢循环 = 氛围不是演出；颜色全部走主题变量
 * （各主题下自动协调）；prefers-reduced-motion 直接静止（纯氛围动效无信息量，
 * 减动效场景应完全关停而非放缓）。
 * blob 用 radial-gradient 渐隐边缘，blur 值固定（不动画 filter，避免每帧重采样）。
 */
export const FluidBackground: React.FC = () => (
  <div className="zs-fluid pointer-events-none" aria-hidden="true">
    <div className="zs-fluid-blob zs-fluid-a" />
    <div className="zs-fluid-blob zs-fluid-b" />
    <div className="zs-fluid-blob zs-fluid-c" />
  </div>
)
