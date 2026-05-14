'use client'

import { useEffect, useRef } from 'react'

// ── Per-step orb target positions (fractions of canvas w/h) ──────────────────

interface OrbTargets {
  ox: number; oy: number   // orange
  vx: number; vy: number   // violet
}

const STEP_TARGETS: OrbTargets[] = [
  // Step 1 — instruments & genres: energetic, orange dominates centre-right
  { ox: 0.65, oy: 0.35, vx: 0.15, vy: 0.70 },
  // Step 2 — what are you looking for: orange shifts right & lower, violet rises
  { ox: 0.80, oy: 0.55, vx: 0.25, vy: 0.30 },
  // Step 3 — make it yours: orange spotlight top-centre, violet sinks low-left
  { ox: 0.50, oy: 0.25, vx: 0.10, vy: 0.85 },
  // Step 4 — confirmation: both orbs merge at centre, celebratory bloom
  { ox: 0.50, oy: 0.50, vx: 0.50, vy: 0.50 },
]

// ── Filaments (identical to landing page) ────────────────────────────────────

interface FilamentConfig { yC: number; A: number; f: number; s: number; p: number }

const FILAMENTS: FilamentConfig[] = [
  { yC: 0.38, A: 55, f: 0.0018, s: Math.PI * 2 / 28000, p: 0.0 },
  { yC: 0.42, A: 45, f: 0.0014, s: Math.PI * 2 / 31000, p: 2.2 },
  { yC: 0.46, A: 65, f: 0.0012, s: Math.PI * 2 / 25000, p: 1.1 },
  { yC: 0.50, A: 75, f: 0.0016, s: Math.PI * 2 / 29000, p: 3.5 },
  { yC: 0.54, A: 60, f: 0.0020, s: Math.PI * 2 / 26000, p: 0.8 },
  { yC: 0.58, A: 50, f: 0.0013, s: Math.PI * 2 / 33000, p: 4.1 },
]
const F_LINE_WIDTHS = [0.5, 0.6, 0.8, 1.0, 1.2, 1.5]
const F_OPACITIES   = [0.12, 0.15, 0.20, 0.28, 0.38, 0.45]

const POS_LERP    = 0.08   // position convergence — ~800ms at 60fps
const RADIUS_LERP = 0.04   // radius convergence — slower for the bloom feel

// ── Component ─────────────────────────────────────────────────────────────────

interface Props { currentStep: number }

export default function OnboardingBackground({ currentStep }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Keep animation loop reading latest step without restarting the effect
  const stepRef = useRef(currentStep)
  useEffect(() => { stepRef.current = currentStep }, [currentStep])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // ── One-time grain texture ────────────────────────────────────────────────
    const GRAIN = 256
    const grainCv = document.createElement('canvas')
    grainCv.width = GRAIN; grainCv.height = GRAIN
    const gctx = grainCv.getContext('2d')!
    const id = gctx.createImageData(GRAIN, GRAIN)
    for (let i = 0; i < id.data.length; i += 4) {
      const v = (Math.random() * 255) | 0
      id.data[i] = v; id.data[i + 1] = v; id.data[i + 2] = v; id.data[i + 3] = 255
    }
    gctx.putImageData(id, 0, 0)
    const grainPat = ctx.createPattern(grainCv, 'repeat')

    function resize() {
      if (!canvas) return
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // ── Mutable animation state (lives in closure, no React state) ────────────
    // Current orb positions, initialised to step 1 targets
    let curOX = STEP_TARGETS[0].ox, curOY = STEP_TARGETS[0].oy
    let curVX = STEP_TARGETS[0].vx, curVY = STEP_TARGETS[0].vy

    // Radius multiplier for the step-4 bloom
    let radiusMult = 1.0
    let pulseTriggered = false
    type PulsePhase = 'expanding' | 'contracting' | 'done'
    let pulsePhase: PulsePhase | null = null
    let pulseStart = 0

    let raf: number

    function draw(time: number) {
      if (!canvas || !ctx) return
      const w = canvas.width
      const h = canvas.height

      const step = stepRef.current
      const idx  = Math.max(0, Math.min(step - 1, STEP_TARGETS.length - 1))
      const tgt  = STEP_TARGETS[idx]

      // ── Lerp orb base positions toward step target ────────────────────────
      curOX += (tgt.ox - curOX) * POS_LERP
      curOY += (tgt.oy - curOY) * POS_LERP
      curVX += (tgt.vx - curVX) * POS_LERP
      curVY += (tgt.vy - curVY) * POS_LERP

      // ── Step-4 bloom pulse ─────────────────────────────────────────────────
      if (step === 4 && !pulseTriggered) {
        pulseTriggered = true
        pulsePhase = 'expanding'
        pulseStart = time
      }
      if (step !== 4) {
        // Reset when user navigates away from step 4
        pulseTriggered = false
        pulsePhase = null
        radiusMult = 1.0
      }

      if (pulsePhase === 'expanding') {
        const elapsed = time - pulseStart
        radiusMult = 1 + 0.4 * Math.min(elapsed / 600, 1)
        if (elapsed >= 600) {
          pulsePhase = 'contracting'
          pulseStart = time
        }
      } else if (pulsePhase === 'contracting') {
        const elapsed = time - pulseStart
        radiusMult = 1.4 - 0.3 * Math.min(elapsed / 1200, 1)
        if (elapsed >= 1200) {
          pulsePhase = 'done'
          radiusMult = 1.1
        }
      }

      // ── Floating drift (additive over the lerped base position) ──────────
      const ox = w * curOX + 30 * Math.sin(time / 17000) * Math.cos(time / 11300 * 0.7)
      const oy = h * curOY + 20 * Math.cos(time / 13000) * Math.sin(time / 9100 * 0.8)
      const vx = w * curVX + 25 * Math.sin(time / 22000 + 1.2) * Math.cos(time / 15700 * 0.6)
      const vy = h * curVY + 25 * Math.cos(time / 19000 + 0.8) * Math.sin(time / 12300 * 0.9)

      // On step 4 the violet orb grows large so both glows merge
      const orangeR = 300 * radiusMult
      const violetR = (step === 4 ? 520 : 400) * radiusMult

      // ── Background ────────────────────────────────────────────────────────
      ctx.fillStyle = '#0D0D0D'
      ctx.fillRect(0, 0, w, h)

      // ── Violet orb ────────────────────────────────────────────────────────
      const vg = ctx.createRadialGradient(vx, vy, 0, vx, vy, violetR)
      vg.addColorStop(0,    step === 4 ? 'rgba(91,33,182,0.65)' : 'rgba(91,33,182,0.52)')
      vg.addColorStop(0.30, 'rgba(91,33,182,0.22)')
      vg.addColorStop(0.65, 'rgba(91,33,182,0.06)')
      vg.addColorStop(1,    'rgba(91,33,182,0)')
      ctx.fillStyle = vg
      ctx.fillRect(0, 0, w, h)

      // ── Orange orb ────────────────────────────────────────────────────────
      const og = ctx.createRadialGradient(ox, oy, 0, ox, oy, orangeR)
      og.addColorStop(0,    'rgba(255,200,80,0.95)')
      og.addColorStop(0.06, 'rgba(255,140,20,0.75)')
      og.addColorStop(0.18, 'rgba(255,92,0,0.40)')
      og.addColorStop(0.40, 'rgba(255,60,0,0.15)')
      og.addColorStop(0.70, 'rgba(255,40,0,0.05)')
      og.addColorStop(1,    'rgba(255,40,0,0)')
      ctx.fillStyle = og
      ctx.fillRect(0, 0, w, h)

      // ── Waveform filaments ────────────────────────────────────────────────
      const orbXFrac = ox / w

      for (let fi = 0; fi < FILAMENTS.length; fi++) {
        const fil   = FILAMENTS[fi]
        const phase = fil.s * time + fil.p
        const baseY = fil.yC * h
        const op    = F_OPACITIES[fi]

        const leftFade  = Math.max(0, orbXFrac - 0.40)
        const warmLeft  = Math.max(0, orbXFrac - 0.18)
        const warmRight = Math.min(1, orbXFrac + 0.18)
        const rightFade = Math.min(1, orbXFrac + 0.40)

        const grad = ctx.createLinearGradient(0, 0, w, 0)
        grad.addColorStop(0,          `rgba(240,239,235,${op * 0.25})`)
        grad.addColorStop(leftFade,   `rgba(240,239,235,${op * 0.35})`)
        grad.addColorStop(warmLeft,   `rgba(255,140,30,${op * 0.70})`)
        grad.addColorStop(orbXFrac,   `rgba(255,92,0,${op})`)
        grad.addColorStop(warmRight,  `rgba(255,140,30,${op * 0.70})`)
        grad.addColorStop(rightFade,  `rgba(240,239,235,${op * 0.35})`)
        grad.addColorStop(1,          `rgba(240,239,235,${op * 0.25})`)

        ctx.save()
        ctx.lineWidth   = F_LINE_WIDTHS[fi]
        ctx.strokeStyle = grad
        ctx.beginPath()
        for (let x = 0; x <= w; x += 3) {
          const y = baseY + fil.A * Math.sin(fil.f * x + phase)
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.stroke()
        ctx.restore()
      }

      // ── Floor reflection ──────────────────────────────────────────────────
      {
        const fil    = FILAMENTS[FILAMENTS.length - 1]
        const phase  = fil.s * time + fil.p
        const floorY = fil.yC * h + fil.A + 18

        const rg = ctx.createLinearGradient(0, 0, w, 0)
        rg.addColorStop(0,        'rgba(240,239,235,0)')
        rg.addColorStop(orbXFrac, `rgba(255,92,0,${F_OPACITIES[5] * 0.12})`)
        rg.addColorStop(1,        'rgba(240,239,235,0)')

        ctx.save()
        ctx.lineWidth   = 0.4
        ctx.strokeStyle = rg
        ctx.beginPath()
        for (let x = 0; x <= w; x += 3) {
          const srcY = fil.yC * h + fil.A * Math.sin(fil.f * x + phase)
          const y    = 2 * floorY - srcY
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.stroke()
        ctx.restore()
      }

      // ── Film grain ────────────────────────────────────────────────────────
      if (grainPat) {
        ctx.save()
        ctx.globalAlpha = 0.045
        ctx.fillStyle   = grainPat
        ctx.fillRect(0, 0, w, h)
        ctx.restore()
      }

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, []) // runs once — step changes flow through stepRef

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0"
      style={{ zIndex: 0 }}
    />
  )
}
