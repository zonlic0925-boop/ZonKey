import type { Transition, Variants } from 'framer-motion'

export const snappySpring: Transition = {
  type: 'spring',
  stiffness: 450,
  damping: 28,
  mass: 0.8,
}

export const smoothSpring: Transition = {
  type: 'spring',
  stiffness: 280,
  damping: 26,
}

export const bouncyDelight: Transition = {
  type: 'spring',
  stiffness: 350,
  damping: 18,
}

export const pillMorphSpring: Transition = {
  type: 'spring',
  stiffness: 500,
  damping: 32,
}

export const cardHoverVariants: Variants = {
  initial: { x: 0, y: 0, scale: 1 },
  hover: {
    x: -2,
    y: -2,
    scale: 1.01,
    transition: snappySpring,
  },
  tap: {
    x: 3,
    y: 3,
    scale: 0.98,
    transition: { duration: 0.08 },
  },
}

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
}

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: smoothSpring,
  },
}

export const pageFadeSlide: Variants = {
  initial: { opacity: 0, y: 8, scale: 0.99 },
  animate: { opacity: 1, y: 0, scale: 1, transition: smoothSpring },
  exit: { opacity: 0, y: -8, scale: 0.99, transition: { duration: 0.12 } },
}

export const stampPopVariants: Variants = {
  initial: { scale: 1.6, opacity: 0, rotate: -8 },
  animate: {
    scale: 1,
    opacity: 1,
    rotate: 0,
    transition: bouncyDelight,
  },
}
