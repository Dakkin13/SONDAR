'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'

// ── Waveform filaments ────────────────────────────────────────────────────────

interface FilamentConfig { yC: number; A: number; f: number; s: number; p: number }

const FILAMENTS: FilamentConfig[] = [
  { yC: 0.38, A: 55, f: 0.0018, s: Math.PI * 2 / 28000, p: 0.0 },
  { yC: 0.42, A: 45, f: 0.0014, s: Math.PI * 2 / 31000, p: 2.2 },
  { yC: 0.46, A: 65, f: 0.0012, s: Math.PI * 2 / 25000, p: 1.1 },
  { yC: 0.50, A: 75, f: 0.0016, s: Math.PI * 2 / 29000, p: 3.5 },
  { yC: 0.54, A: 60, f: 0.0020, s: Math.PI * 2 / 26000, p: 0.8 },
  { yC: 0.58, A: 50, f: 0.0013, s: Math.PI * 2 / 33000, p: 4.1 },
]
const F_WIDTHS  = [0.5, 0.6, 0.8, 1.0, 1.2, 1.5]
const F_OPACITIES = [0.12, 0.15, 0.20, 0.28, 0.38, 0.45]

// ── Stage targets ─────────────────────────────────────────────────────────────
// Positions are 0–1 fractions of canvas width/height.
// Radius is a fraction of Math.min(canvas.width, canvas.height).

interface OrbState { x: number; y: number; r: number }
interface Stage { orange: OrbState; violet: OrbState }

const STAGES: Record<string, Stage> = {
  landing:  { orange: { x:0.62, y:0.35, r:0.55 }, violet: { x:0.20, y:0.68, r:0.45 } },
  step1:    { orange: { x:0.68, y:0.32, r:0.35 }, violet: { x:0.16, y:0.72, r:0.28 } },
  step2:    { orange: { x:0.80, y:0.48, r:0.48 }, violet: { x:0.25, y:0.28, r:0.38 } },
  step3:    { orange: { x:0.50, y:0.25, r:0.58 }, violet: { x:0.10, y:0.80, r:0.50 } },
  step4:    { orange: { x:0.52, y:0.48, r:0.65 }, violet: { x:0.48, y:0.52, r:0.60 } },
  explore:  { orange: { x:0.75, y:0.25, r:0.45 }, violet: { x:0.18, y:0.75, r:0.38 } },
  messages: { orange: { x:0.50, y:0.20, r:0.30 }, violet: { x:0.28, y:0.80, r:0.25 } },
  profile:  { orange: { x:0.52, y:0.25, r:0.38 }, violet: { x:0.20, y:0.75, r:0.32 } },
  bands:    { orange: { x:0.52, y:0.25, r:0.38 }, violet: { x:0.20, y:0.75, r:0.32 } },
}

function stageName(pathname: string, step: number): string {
  if (pathname.startsWith('/explore')) return 'explore'
  // /messages/band/[bandId] intentionally reuses the 'messages' stage — same
  // chat context, no need for a distinct orb position.
  if (pathname.startsWith('/messages')) return 'messages'
  if (pathname.startsWith('/bands')) return 'bands'
  if (pathname.startsWith('/profile')) return 'profile'
  if (pathname === '/onboarding') return `step${Math.min(step, 4)}`
  return 'landing'
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t }
function easeOutCubic(t: number) { return 1 - Math.pow(1 - Math.min(1, t), 3) }

// ── Component ─────────────────────────────────────────────────────────────────

export default function GlobalBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pathname = usePathname()
  const router = useRouter()

  const pathnameRef = useRef(pathname)
  const routerRef   = useRef(router)
  const stepRef     = useRef(1)

  useEffect(() => { pathnameRef.current = pathname }, [pathname])
  useEffect(() => { routerRef.current  = router  }, [router])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // ── Grain texture ──────────────────────────────────────────────────────
    const GRAIN = 256
    const gCv = document.createElement('canvas')
    gCv.width = gCv.height = GRAIN
    const gCtx = gCv.getContext('2d')!
    const id = gCtx.createImageData(GRAIN, GRAIN)
    for (let i = 0; i < id.data.length; i += 4) {
      const v = (Math.random() * 255) | 0
      id.data[i] = v; id.data[i+1] = v; id.data[i+2] = v; id.data[i+3] = 255
    }
    gCtx.putImageData(id, 0, 0)
    const grainPat = ctx.createPattern(gCv, 'repeat')

    // ── Resize ──────────────────────────────────────────────────────────────
    function resize() {
      if (!canvas) return
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // ── Lerp state (normalised 0–1) ──────────────────────────────────────
    let ox = 0.60, oy = 0.38, or_ = 0.18
    let vx = 0.22, vy = 0.62, vr  = 0.14

    // ── Bloom state ─────────────────────────────────────────────────────
    let bloomActive    = false
    let bloomStartTime = -1
    let bOx = 0.60, bOy = 0.38, bOr = 0.18
    let bVx = 0.22, bVy = 0.62, bVr = 0.14
    let bloomDone = false

    function startBloom() {
      bOx = ox; bOy = oy; bOr = or_
      bVx = vx; bVy = vy; bVr = vr
      bloomActive    = true
      bloomStartTime = -1
      bloomDone      = false
    }

    // ── sondar-step event ───────────────────────────────────────────────
    function handleStep(e: Event) {
      const detail = (e as CustomEvent<{ step: number | 'complete' }>).detail
      if (detail.step === 'complete') {
        startBloom()
      } else {
        stepRef.current = detail.step as number
      }
    }
    window.addEventListener('sondar-step', handleStep)

    // ── RAF loop ────────────────────────────────────────────────────────
    let raf: number

    function draw(time: number) {
      raf = requestAnimationFrame(draw)
      if (!canvas || !ctx) return
      try {
      const w = canvas.width
      const h = canvas.height
      const dim = Math.min(w, h)

      // ── Background ──────────────────────────────────────────────────
      ctx.fillStyle = '#08080F'
      ctx.fillRect(0, 0, w, h)

      // ── Resolve pixel positions & radii ─────────────────────────────
      let foxPx: number, foyPx: number, forPx: number
      let fvxPx: number, fvyPx: number, fvrPx: number

      if (bloomActive) {
        if (bloomStartTime < 0) bloomStartTime = time
        const elapsed = time - bloomStartTime
        const TOTAL   = 1800

        const movePhase    = easeOutCubic(elapsed / 800)
        const expandO      = easeOutCubic(elapsed / 1200)
        const expandV      = easeOutCubic(Math.max(0, (elapsed - 200) / 1400))

        foxPx = lerp(bOx, 0.50, movePhase) * w
        foyPx = lerp(bOy, 0.50, movePhase) * h
        forPx = lerp(bOr, 1.50, expandO) * dim

        fvxPx = lerp(bVx, 0.50, movePhase) * w
        fvyPx = lerp(bVy, 0.50, movePhase) * h
        fvrPx = lerp(bVr, 1.30, expandV) * dim

        // Canvas fades out in last 400ms
        const fadeStart = TOTAL - 400
        const opacity = elapsed > fadeStart ? 1 - Math.min(1, (elapsed - fadeStart) / 400) : 1
        canvas.style.opacity = String(opacity.toFixed(3))

        if (elapsed >= TOTAL && !bloomDone) {
          bloomDone   = true
          bloomActive = false
          canvas.style.opacity = '1'
          routerRef.current.push('/explore')
        }
      } else {
        // Normal lerp toward stage target
        const stage = STAGES[stageName(pathnameRef.current, stepRef.current)] ?? STAGES.landing
        ox  = lerp(ox,  stage.orange.x, 0.025)
        oy  = lerp(oy,  stage.orange.y, 0.025)
        or_ = lerp(or_, stage.orange.r, 0.02)
        vx  = lerp(vx,  stage.violet.x, 0.025)
        vy  = lerp(vy,  stage.violet.y, 0.025)
        vr  = lerp(vr,  stage.violet.r, 0.02)

        const t = time / 1000
        foxPx = ox * w + 30 * Math.sin(t * 0.40)
        foyPx = oy * h + 24 * Math.cos(t * 0.30)
        fvxPx = vx * w + 24 * Math.cos(t * 0.35)
        fvyPx = vy * h + 24 * Math.sin(t * 0.28)
        forPx = or_ * dim
        fvrPx = vr  * dim

        // Clamp to 6% from edges
        const ex = w * 0.06, ey = h * 0.06
        foxPx = Math.max(ex, Math.min(w - ex, foxPx))
        foyPx = Math.max(ey, Math.min(h - ey, foyPx))
        fvxPx = Math.max(ex, Math.min(w - ex, fvxPx))
        fvyPx = Math.max(ey, Math.min(h - ey, fvyPx))
      }

      // ── Violet orb ────────────────────────────────────────────────────
      const vg = ctx.createRadialGradient(fvxPx, fvyPx, 0, fvxPx, fvyPx, fvrPx)
      vg.addColorStop(0,    'rgba(91,33,182,0.40)')
      vg.addColorStop(0.25, 'rgba(91,33,182,0.18)')
      vg.addColorStop(0.55, 'rgba(91,33,182,0.05)')
      vg.addColorStop(1,    'rgba(91,33,182,0)')
      ctx.fillStyle = vg
      ctx.fillRect(0, 0, w, h)

      // ── Orange orb ───────────────────────────────────────────────────
      const og = ctx.createRadialGradient(foxPx, foyPx, 0, foxPx, foyPx, forPx)
      og.addColorStop(0,    'rgba(255,200,80,0.55)')
      og.addColorStop(0.06, 'rgba(255,140,20,0.45)')
      og.addColorStop(0.18, 'rgba(255,92,0,0.25)')
      og.addColorStop(0.40, 'rgba(255,60,0,0.09)')
      og.addColorStop(0.70, 'rgba(255,40,0,0.03)')
      og.addColorStop(1,    'rgba(255,40,0,0)')
      ctx.fillStyle = og
      ctx.fillRect(0, 0, w, h)

      // ── Waveform filaments ────────────────────────────────────────────
      const orbXFrac = foxPx / w
      for (let fi = 0; fi < FILAMENTS.length; fi++) {
        const fil = FILAMENTS[fi]
        const phase = fil.s * time + fil.p
        const baseY = fil.yC * h
        const op    = F_OPACITIES[fi]
        const lf    = Math.max(0, orbXFrac - 0.40)
        const wl    = Math.max(0, orbXFrac - 0.18)
        const wr    = Math.min(1, orbXFrac + 0.18)
        const rf    = Math.min(1, orbXFrac + 0.40)

        const g = ctx.createLinearGradient(0, 0, w, 0)
        g.addColorStop(0,          `rgba(240,239,235,${op * 0.25})`)
        g.addColorStop(lf,         `rgba(240,239,235,${op * 0.35})`)
        g.addColorStop(wl,         `rgba(255,140,30,${op * 0.70})`)
        g.addColorStop(orbXFrac,   `rgba(255,92,0,${op})`)
        g.addColorStop(wr,         `rgba(255,140,30,${op * 0.70})`)
        g.addColorStop(rf,         `rgba(240,239,235,${op * 0.35})`)
        g.addColorStop(1,          `rgba(240,239,235,${op * 0.25})`)

        ctx.save()
        ctx.lineWidth    = F_WIDTHS[fi]
        ctx.strokeStyle  = g
        ctx.beginPath()
        for (let x = 0; x <= w; x += 3) {
          const y = baseY + fil.A * Math.sin(fil.f * x + phase)
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.stroke()
        ctx.restore()
      }

      // ── Floor reflection ──────────────────────────────────────────────
      {
        const fil    = FILAMENTS[FILAMENTS.length - 1]
        const phase  = fil.s * time + fil.p
        const floorY = fil.yC * h + fil.A + 18
        const rg     = ctx.createLinearGradient(0, 0, w, 0)
        rg.addColorStop(0,        'rgba(240,239,235,0)')
        rg.addColorStop(orbXFrac, `rgba(255,92,0,${F_OPACITIES[5] * 0.10})`)
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

      // ── Film grain ───────────────────────────────────────────────────
      if (grainPat) {
        ctx.save()
        ctx.globalAlpha = 0.025
        ctx.fillStyle   = grainPat
        ctx.fillRect(0, 0, w, h)
        ctx.restore()
      }

      } catch (err) {
        console.error('[GlobalBackground] draw error:', err)
      }
    }

    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('sondar-step', handleStep)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0"
      style={{ zIndex: 0 }}
    />
  )
}
