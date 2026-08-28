import React from 'react'
import { motion, HTMLMotionProps } from 'framer-motion'
import clsx from 'clsx'
import { snappySpring } from '../../motion/springConfigs'
import { playSound } from '../../lib/sound'

export type ButtonVariant =
  | 'primary'
  | 'coral'
  | 'teal'
  | 'sun'
  | 'yellow'
  | 'sky'
  | 'pink'
  | 'lime'
  | 'lavender'
  | 'paper'
  | 'white'
  | 'ghost'

export interface MemphisButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
  icon?: React.ReactNode
  children?: React.ReactNode
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-mem-coral text-white hover:bg-opacity-95',
  coral: 'bg-mem-coral text-white hover:bg-opacity-95',
  teal: 'bg-mem-teal text-white hover:bg-opacity-95',
  sun: 'bg-mem-sun text-mem-ink hover:bg-opacity-95',
  yellow: 'bg-mem-sun text-mem-ink hover:bg-opacity-95',
  sky: 'bg-mem-sky text-white hover:bg-opacity-95',
  pink: 'bg-mem-pink text-mem-ink hover:bg-opacity-95',
  lime: 'bg-mem-lime text-mem-ink hover:bg-opacity-95',
  lavender: 'bg-mem-lavender text-white hover:bg-opacity-95',
  paper: 'bg-white text-mem-ink hover:bg-slate-50',
  white: 'bg-white text-mem-ink hover:bg-slate-50',
  ghost: 'bg-transparent text-mem-ink border-transparent shadow-none hover:bg-black/5 hover:border-mem-ink'
}

const sizeStyles = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-4 py-2 text-sm rounded-xl',
  lg: 'px-6 py-3 text-base rounded-2xl'
}

export const MemphisButton: React.FC<MemphisButtonProps> = ({
  variant = 'paper',
  size = 'md',
  icon,
  className,
  children,
  onClick,
  ...props
}) => {
  return (
    <motion.button
      whileHover={{ scale: 1.02, x: -1, y: -1 }}
      whileTap={{ scale: 0.98, x: 2, y: 2 }}
      transition={snappySpring}
      onClick={(e) => {
        playSound('touch')
        onClick?.(e)
      }}
      className={clsx(
        'font-bold border-[2px] border-mem-ink shadow-memphis-sm select-none inline-flex items-center justify-center gap-2 cursor-pointer transition-colors',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {icon && <span className="inline-flex shrink-0">{icon}</span>}
      {children}
    </motion.button>
  )
}
