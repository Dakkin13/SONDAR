'use client'

import { useEffect, useRef } from 'react'

interface WaveConfig {
  amplitude: number
  frequency: number
  speed: number
  phase: number
  opacity: number
  blur: number
  yOffset: number
  lineWidth: number
}

// 3 layers: outer-top (slow), center (slightly faster = parallax), outer-bottom (slowest)
const WAVES: WaveConfig[] = [
  {
    amplitude: 85,
    frequency: 0.0016,
    speed: 0.000135,
    phase: 0,
    opacity: 0.18,
    blur: 48,
    yOffset: -0.07,
    lineWidth: 2.5,
  },
  {
    amplitude: 65,
    frequency: 0.0022,
    speed: 0.000210,
    phase: 1.8,
    opacity: 0.25,
    blur: 32,
    yOffset: 0.0,
    lineWidth: 2,
  },
  {
    amplitude: 100,
    frequency: 0.0012,
    speed: 0.000095,
    phase: 3.4,
    opacity: 0.14,
    blur: 60,
    yOffset: 0.08,
    lineWidth: 3,
  },
]

export default function WaveBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function resize() {
      if (!canvas) return
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    let raf: number

    function draw(time: number) {
      if (!canvas || !ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const w = canvas.width
      const h = canvas.height
      const cy = h * 0.5

      for (const wave of WAVES) {
        ctx.save()

        // Horizontal gradient: #FF5C00 → #8B5CF6
        const grad = ctx.createLinearGradient(0, 0, w, 0)
        grad.addColorStop(0, `rgba(255, 92, 0, ${wave.opacity})`)
        grad.addColorStop(0.5, `rgba(180, 80, 140, ${wave.opacity * 0.85})`)
        grad.addColorStop(1, `rgba(139, 92, 246, ${wave.opacity})`)

        ctx.beginPath()
        ctx.strokeStyle = grad
        ctx.lineWidth = wave.lineWidth
        ctx.shadowColor = 'rgba(180, 70, 180, 0.6)'
        ctx.shadowBlur = wave.blur

        const baseY = cy + wave.yOffset * h

        for (let x = 0; x <= w; x += 4) {
          const y =
            baseY +
            wave.amplitude *
              Math.sin(wave.frequency * x + wave.speed * time + wave.phase)
          if (x === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }

        ctx.stroke()
        ctx.restore()
      }

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0"
    />
  )
}
