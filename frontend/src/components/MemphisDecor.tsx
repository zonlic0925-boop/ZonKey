import React from 'react'

/**
 * 孟菲斯装饰层：几何图案散布在边缘留白区，不遮挡操作区域（手机端隐藏）。
 * 颜色全部走 mem-* 变量类（tailwind 挂 CSS 变量），深色/冷灰主题下自动跟随。
 * 动效：缓漂浮（transform/opacity only）；系统减动效时 CSS 动画整体关闭
 * （main.tsx 的 MotionConfig 只管 framer-motion，这里是纯 CSS 动画，另用媒体查询兜底）。
 */
export const MemphisDecor: React.FC = () => (
  <div className="hidden md:block absolute inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
    <style>{`
      @keyframes zs-float {
        0%, 100% { transform: translate(0, 0) rotate(var(--zs-rot, 0deg)); }
        50% { transform: translate(0, -6px) rotate(var(--zs-rot, 0deg)); }
      }
      .zs-float { animation: zs-float 7s ease-in-out infinite; }
      .zs-float-delay { animation: zs-float 9s ease-in-out 1.2s infinite; }
      @media (prefers-reduced-motion: reduce) {
        .zs-float, .zs-float-delay { animation: none; }
      }
    `}</style>

    {/* 左上角：黄色圆 + 黑色描边 */}
    <div className="zs-float absolute -top-6 -left-6 w-24 h-24 rounded-full bg-mem-yellow border-[3px] border-mem-ink shadow-memphis" style={{ ['--zs-rot' as string]: '0deg' }} />

    {/* 右上角：粉色三角 */}
    <svg className="zs-float-delay absolute top-8 right-12 w-16 h-16" viewBox="0 0 64 64">
      <polygon points="32,4 60,56 4,56" className="fill-mem-pink stroke-mem-ink" strokeWidth="3" />
    </svg>

    {/* 右下：青色方块 */}
    <div className="zs-float absolute bottom-16 right-8 w-14 h-14 bg-mem-teal border-[3px] border-mem-ink rotate-12 shadow-memphis" style={{ ['--zs-rot' as string]: '12deg' }} />

    {/* 左下：波浪线 */}
    <svg className="absolute bottom-24 left-6 w-32 h-12 opacity-80" viewBox="0 0 128 48">
      <path
        d="M0,24 Q16,4 32,24 T64,24 T96,24 T128,24"
        fill="none"
        className="stroke-mem-coral"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>

    {/* 散布波点 (降低对比度，防止被误认为脏数据/死像素) */}
    <div className="absolute top-[18%] right-[22%] w-3 h-3 rounded-full bg-mem-coral/30 border-2 border-mem-ink/20" />
    <div className="absolute top-[35%] left-[8%] w-2 h-2 rounded-full bg-mem-teal/30 border-2 border-mem-ink/20" />
    <div className="absolute bottom-[30%] right-[15%] w-4 h-4 rounded-full bg-mem-yellow/30 border-2 border-mem-ink/20" />
    <div className="absolute top-[55%] left-[5%] w-2.5 h-2.5 rounded-full bg-mem-pink/30 border-2 border-mem-ink/20" />

    {/* 中部偏右：小条纹块 (降低对比度) */}
    <div
      className="absolute top-[12%] left-[45%] w-10 h-10 border-[3px] border-mem-ink/20 opacity-20"
      style={{
        backgroundImage:
          'repeating-linear-gradient(45deg, rgb(var(--mem-teal)), rgb(var(--mem-teal)) 4px, transparent 4px, transparent 8px)',
      }}
    />
  </div>
)
