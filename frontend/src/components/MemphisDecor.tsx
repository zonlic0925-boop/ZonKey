import React from 'react'

/** 孟菲斯装饰层：几何图案散布在边缘留白区，不遮挡操作区域 */
export const MemphisDecor: React.FC = () => (
  <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
    {/* 左上角：黄色圆 + 黑色描边 */}
    <div className="absolute -top-6 -left-6 w-24 h-24 rounded-full bg-mem-yellow border-[3px] border-mem-ink shadow-memphis" />

    {/* 右上角：粉色三角 */}
    <svg className="absolute top-8 right-12 w-16 h-16" viewBox="0 0 64 64">
      <polygon points="32,4 60,56 4,56" fill="#FF9FF3" stroke="#1A1A2E" strokeWidth="3" />
    </svg>

    {/* 右下：青色方块 */}
    <div className="absolute bottom-16 right-8 w-14 h-14 bg-mem-teal border-[3px] border-mem-ink rotate-12 shadow-memphis" />

    {/* 左下：波浪线 */}
    <svg className="absolute bottom-24 left-6 w-32 h-12 opacity-80" viewBox="0 0 128 48">
      <path
        d="M0,24 Q16,4 32,24 T64,24 T96,24 T128,24"
        fill="none"
        stroke="#FF6B6B"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>

    {/* 散布波点 */}
    <div className="absolute top-[18%] right-[22%] w-3 h-3 rounded-full bg-mem-coral border-2 border-mem-ink" />
    <div className="absolute top-[35%] left-[8%] w-2 h-2 rounded-full bg-mem-teal border-2 border-mem-ink" />
    <div className="absolute bottom-[30%] right-[15%] w-4 h-4 rounded-full bg-mem-yellow border-2 border-mem-ink" />
    <div className="absolute top-[55%] left-[5%] w-2.5 h-2.5 rounded-full bg-mem-pink border-2 border-mem-ink" />

    {/* 中部偏右：小条纹块 */}
    <div
      className="absolute top-[12%] left-[45%] w-10 h-10 border-[3px] border-mem-ink opacity-40"
      style={{
        backgroundImage: 'repeating-linear-gradient(45deg, #4ECDC4, #4ECDC4 4px, transparent 4px, transparent 8px)',
      }}
    />
  </div>
)
