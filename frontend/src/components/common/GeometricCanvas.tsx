import React, { useEffect, useRef } from 'react'

export const GeometricCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)

    const handleResize = () => {
      if (!canvas) return
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }

    window.addEventListener('resize', handleResize)

    // Memphis Floating Elements
    const shapes = Array.from({ length: 18 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: 14 + Math.random() * 26,
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.01,
      type: ['circle', 'rect', 'cross', 'triangle', 'donut'][Math.floor(Math.random() * 5)],
      color: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#45B7D1', '#FF9FF3', '#1A1A2E'][
        Math.floor(Math.random() * 6)
      ],
      alpha: 0.12 + Math.random() * 0.14,
    }))

    const render = () => {
      ctx.clearRect(0, 0, width, height)

      shapes.forEach((s) => {
        s.x += s.vx
        s.y += s.vy
        s.rot += s.vRot

        if (s.x < -50) s.x = width + 50
        if (s.x > width + 50) s.x = -50
        if (s.y < -50) s.y = height + 50
        if (s.y > height + 50) s.y = -50

        ctx.save()
        ctx.translate(s.x, s.y)
        ctx.rotate(s.rot)
        ctx.globalAlpha = s.alpha
        ctx.fillStyle = s.color
        ctx.strokeStyle = s.color
        ctx.lineWidth = 2.5

        if (s.type === 'circle') {
          ctx.beginPath()
          ctx.arc(0, 0, s.size / 2, 0, Math.PI * 2)
          ctx.fill()
        } else if (s.type === 'donut') {
          ctx.beginPath()
          ctx.arc(0, 0, s.size / 2, 0, Math.PI * 2)
          ctx.stroke()
        } else if (s.type === 'rect') {
          ctx.fillRect(-s.size / 2, -s.size / 2, s.size, s.size)
        } else if (s.type === 'cross') {
          const arm = s.size / 2
          ctx.beginPath()
          ctx.moveTo(-arm, 0)
          ctx.lineTo(arm, 0)
          ctx.moveTo(0, -arm)
          ctx.lineTo(0, arm)
          ctx.stroke()
        } else if (s.type === 'triangle') {
          const r = s.size / 2
          ctx.beginPath()
          ctx.moveTo(0, -r)
          ctx.lineTo(r, r)
          ctx.lineTo(-r, r)
          ctx.closePath()
          ctx.stroke()
        }

        ctx.restore()
      })

      animationFrameId = requestAnimationFrame(render)
    }

    render()

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 opacity-80"
      style={{ mixBlendMode: 'multiply' }}
    />
  )
}
