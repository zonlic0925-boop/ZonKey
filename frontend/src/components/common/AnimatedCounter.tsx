import React, { useEffect, useState } from 'react'
import { motion, useSpring, useTransform } from 'framer-motion'

interface AnimatedCounterProps {
  value: number
  prefix?: string
  suffix?: string
  className?: string
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  prefix = '',
  suffix = '',
  className = '',
}) => {
  const springValue = useSpring(value, { stiffness: 120, damping: 18 })
  const [displayValue, setDisplayValue] = useState(value)

  useEffect(() => {
    springValue.set(value)
  }, [value, springValue])

  useEffect(() => {
    return springValue.on('change', (latest) => {
      setDisplayValue(Math.round(latest))
    })
  }, [springValue])

  return (
    <motion.span className={`inline-flex items-baseline font-display font-bold ${className}`}>
      {prefix}
      <span>{displayValue.toLocaleString()}</span>
      {suffix}
    </motion.span>
  )
}
