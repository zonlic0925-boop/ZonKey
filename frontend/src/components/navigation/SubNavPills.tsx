import React from 'react'
import { motion } from 'framer-motion'
import { pillMorphSpring } from '../../motion/springs'
import type { MemphisAccent } from '../../lib/navigation'

export interface SubNavOption {
  id: string
  label: string
  icon?: React.ReactNode
  badge?: string | number
}

interface SubNavPillsProps {
  options: SubNavOption[]
  activeId: string
  onChange: (id: string) => void
  colorVariant?: MemphisAccent
}

const activePillColors: Record<MemphisAccent, string> = {
  yellow: 'bg-mem-yellow text-mem-ink',
  teal: 'bg-mem-teal text-mem-ink',
  coral: 'bg-mem-coral text-white',
  sky: 'bg-mem-sky text-white',
  pink: 'bg-mem-pink text-mem-ink',
  lime: 'bg-mem-lime text-mem-ink',
  lavender: 'bg-mem-lavender text-white',
  orange: 'bg-mem-orange text-mem-ink',
}

export const SubNavPills: React.FC<SubNavPillsProps> = ({
  options,
  activeId,
  onChange,
  colorVariant = 'yellow',
}) => {
  return (
    <div className="zs-mobile-scroll-x flex items-center gap-1.5 p-1 bg-white border-2 border-mem-ink rounded-xl shadow-memphis-sm overflow-x-auto max-w-full">
      {options.map((opt) => {
        const isActive = opt.id === activeId

        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className="relative px-3.5 py-2 md:py-1.5 rounded-lg font-display text-[13px] md:text-sm font-semibold transition-colors duration-150 flex items-center gap-2 select-none shrink-0"
          >
            {isActive && (
              <motion.div
                layoutId="subNavActivePillHighlight"
                transition={pillMorphSpring}
                className={`absolute inset-0 rounded-lg border-2 border-mem-ink shadow-[2px_2px_0px_#1A1A2E] ${activePillColors[colorVariant]}`}
              />
            )}
            <span
              className={`relative z-10 flex items-center gap-1.5 ${
                isActive ? '' : 'text-mem-ink/70 hover:text-mem-ink'
              }`}
            >
              {opt.icon}
              {opt.label}
              {opt.badge !== undefined && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-xs font-bold border border-mem-ink ${
                    isActive ? 'bg-white text-mem-ink' : 'bg-mem-ink/10 text-mem-ink'
                  }`}
                >
                  {opt.badge}
                </span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
