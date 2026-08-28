import React from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { snappySpring } from '../../motion/springs'

interface MemphisCardProps extends HTMLMotionProps<'div'> {
  interactive?: boolean
  flat?: boolean
  variant?: 'white' | 'cream' | 'yellow' | 'teal' | 'coral' | 'sky' | 'pink'
  children: React.ReactNode
}

const variantBackgrounds: Record<string, string> = {
  white: 'bg-white',
  cream: 'bg-[#FFFDF7]',
  yellow: 'bg-mem-yellow/15',
  teal: 'bg-mem-teal/15',
  coral: 'bg-mem-coral/10',
  sky: 'bg-mem-sky/15',
  pink: 'bg-mem-pink/15',
}

export const MemphisCard: React.FC<MemphisCardProps> = ({
  interactive = false,
  flat = false,
  variant = 'white',
  className = '',
  children,
  ...props
}) => {
  return (
    <motion.div
      whileHover={interactive ? { x: -2, y: -2 } : undefined}
      whileTap={interactive ? { x: 2, y: 2 } : undefined}
      transition={snappySpring}
      className={`border-[2.5px] border-mem-ink rounded-2xl ${variantBackgrounds[variant]} ${
        flat ? '' : 'shadow-memphis'
      } ${interactive ? 'cursor-pointer transition-shadow hover:shadow-memphis-lg' : ''} ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  )
}
