import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SubNavPills, type SubNavOption } from '../navigation/SubNavPills'
import { pageFadeSlide } from '../../motion/springs'

interface ToolShellProps {
  title: string
  subtitle: string
  icon: React.ReactNode
  colorVariant?: 'yellow' | 'teal' | 'coral' | 'sky' | 'pink' | 'lime'
  subOptions?: SubNavOption[]
  activeSubId?: string
  onSubChange?: (id: string) => void
  actions?: React.ReactNode
  children: React.ReactNode
}

const colorBadgeStyles: Record<string, string> = {
  yellow: 'bg-mem-yellow text-mem-ink',
  teal: 'bg-mem-teal text-mem-ink',
  coral: 'bg-mem-coral text-white',
  sky: 'bg-mem-sky text-white',
  pink: 'bg-mem-pink text-mem-ink',
  lime: 'bg-mem-lime text-mem-ink',
}

export const ToolShell: React.FC<ToolShellProps> = ({
  title,
  subtitle,
  icon,
  colorVariant = 'yellow',
  subOptions,
  activeSubId,
  onSubChange,
  actions,
  children,
}) => {
  return (
    <div className="flex flex-col flex-1 h-full min-h-0 w-full">
      {/* Top Banner / Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-white/90 backdrop-blur-sm border-b-[2.5px] border-mem-ink shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl border-2 border-mem-ink shadow-memphis-sm flex items-center justify-center text-xl shrink-0 ${colorBadgeStyles[colorVariant]}`}
          >
            {icon}
          </div>
          <div>
            <h2 className="text-base md:text-lg font-display font-black text-mem-ink flex items-center gap-2">
              {title}
            </h2>
            <p className="text-xs text-mem-ink/65 font-medium">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {subOptions && activeSubId && onSubChange && (
            <SubNavPills
              options={subOptions}
              activeId={activeSubId}
              onChange={onSubChange}
              colorVariant={colorVariant}
            />
          )}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </div>

      {/* Main Workbench Area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSubId || title}
            variants={pageFadeSlide}
            initial="initial"
            animate="animate"
            exit="exit"
            className="h-full flex flex-col"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
