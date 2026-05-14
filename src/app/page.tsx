'use client'

// TODO: Add ambient instrument sound interactions — subtle audio cues on hover and scroll events. To be implemented in a future session.

import { motion } from 'framer-motion'
import Link from 'next/link'
import { useEffect, useRef } from 'react'

// ─── Wave canvas ──────────────────────────────────────────────────────────────
// Fixed, full-viewport. Renders: pure #0D0D0D base, two animated glowing orbs
// (orange dominant + violet wash), six thin waveform filaments lit by the orbs,
// a faint floor reflection, and a subtle film-grain overlay.

interface FilamentConfig {
  yC: number  // vertical center as fraction of canvas height
  A: number   // amplitude px
  f: number   // spatial frequency rad/px
  s: number   // temporal speed rad/ms
  p: number   // initial phase offset
}

const FILAMENTS: FilamentConfig[] = [
  { yC: 0.38, A: 55, f: 0.0018, s: Math.PI * 2 / 28000, p: 0.0 },
  { yC: 0.42, A: 45, f: 0.0014, s: Math.PI * 2 / 31000, p: 2.2 },
  { yC: 0.46, A: 65, f: 0.0012, s: Math.PI * 2 / 25000, p: 1.1 },
  { yC: 0.50, A: 75, f: 0.0016, s: Math.PI * 2 / 29000, p: 3.5 },
  { yC: 0.54, A: 60, f: 0.0020, s: Math.PI * 2 / 26000, p: 0.8 },
  { yC: 0.58, A: 50, f: 0.0013, s: Math.PI * 2 / 33000, p: 4.1 },
]

// Back filaments = thin/faint; front filaments = thicker/more visible
const F_LINE_WIDTHS = [0.5, 0.6, 0.8, 1.0, 1.2, 1.5]
const F_OPACITIES   = [0.12, 0.15, 0.20, 0.28, 0.38, 0.45]

function WaveCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Build static grain texture once — fine noise at low opacity = analogue warmth
    const GRAIN = 256
    const grainCv = document.createElement('canvas')
    grainCv.width = GRAIN
    grainCv.height = GRAIN
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

    let raf: number

    function draw(time: number) {
      if (!canvas || !ctx) return
      const w = canvas.width
      const h = canvas.height

      // ── Background: pure near-black ──
      ctx.fillStyle = '#0D0D0D'
      ctx.fillRect(0, 0, w, h)

      // ── Orb positions: gentle irregular float via sine combinations ──
      // Orange: center-right, slightly above centre — 30px drift, ~17s cycle
      const ox = w * 0.63 + 30 * Math.sin(time / 17000) * Math.cos(time / 11300 * 0.7)
      const oy = h * 0.42 + 20 * Math.cos(time / 13000) * Math.sin(time / 9100 * 0.8)

      // Violet: left side, lower, slightly slower — 25px drift, ~22s cycle
      const vx = w * 0.18 + 25 * Math.sin(time / 22000 + 1.2) * Math.cos(time / 15700 * 0.6)
      const vy = h * 0.60 + 25 * Math.cos(time / 19000 + 0.8) * Math.sin(time / 12300 * 0.9)

      // ── Violet orb: large diffuse wash, painted first (behind waves) ──
      const vg = ctx.createRadialGradient(vx, vy, 0, vx, vy, 400)
      vg.addColorStop(0,    'rgba(91,33,182,0.52)')
      vg.addColorStop(0.30, 'rgba(91,33,182,0.22)')
      vg.addColorStop(0.65, 'rgba(91,33,182,0.06)')
      vg.addColorStop(1,    'rgba(91,33,182,0)')
      ctx.fillStyle = vg
      ctx.fillRect(0, 0, w, h)

      // ── Orange orb: dominant light source, bright warm core ──
      const og = ctx.createRadialGradient(ox, oy, 0, ox, oy, 300)
      og.addColorStop(0,    'rgba(255,200,80,0.95)')
      og.addColorStop(0.06, 'rgba(255,140,20,0.75)')
      og.addColorStop(0.18, 'rgba(255,92,0,0.40)')
      og.addColorStop(0.40, 'rgba(255,60,0,0.15)')
      og.addColorStop(0.70, 'rgba(255,40,0,0.05)')
      og.addColorStop(1,    'rgba(255,40,0,0)')
      ctx.fillStyle = og
      ctx.fillRect(0, 0, w, h)

      // ── Six waveform filaments ──
      // Each picks up the orange orb's colour at its x-position; neutral elsewhere
      const orbXFrac = ox / w

      for (let fi = 0; fi < FILAMENTS.length; fi++) {
        const fil = FILAMENTS[fi]
        const phase = fil.s * time + fil.p
        const baseY = fil.yC * h
        const op = F_OPACITIES[fi]

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
        ctx.lineWidth = F_LINE_WIDTHS[fi]
        ctx.strokeStyle = grad
        ctx.beginPath()
        for (let x = 0; x <= w; x += 3) {
          const y = baseY + fil.A * Math.sin(fil.f * x + phase)
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.stroke()
        ctx.restore()
      }

      // ── Floor reflection: mirrored bottom filament, very faint ──
      {
        const fil = FILAMENTS[FILAMENTS.length - 1]
        const phase = fil.s * time + fil.p
        // Reflection axis sits just below the wave trough
        const floorY = fil.yC * h + fil.A + 18

        const rg = ctx.createLinearGradient(0, 0, w, 0)
        rg.addColorStop(0,        'rgba(240,239,235,0)')
        rg.addColorStop(orbXFrac, `rgba(255,92,0,${F_OPACITIES[5] * 0.12})`)
        rg.addColorStop(1,        'rgba(240,239,235,0)')

        ctx.save()
        ctx.lineWidth = 0.4
        ctx.strokeStyle = rg
        ctx.beginPath()
        for (let x = 0; x <= w; x += 3) {
          const srcY = fil.yC * h + fil.A * Math.sin(fil.f * x + phase)
          const y = 2 * floorY - srcY  // mirror about floorY
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.stroke()
        ctx.restore()
      }

      // ── Film grain: fine analogue texture ──
      if (grainPat) {
        ctx.save()
        ctx.globalAlpha = 0.045
        ctx.fillStyle = grainPat
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
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0"
      style={{ zIndex: 0 }}
    />
  )
}

// ─── Sonus symbol ─────────────────────────────────────────────────────────────

function SonusSymbol({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <circle cx="18" cy="24" r="13" stroke="#FF5C00" strokeWidth="1.5" opacity="0.9" />
      <circle cx="30" cy="24" r="13" stroke="#FF5C00" strokeWidth="1.5" opacity="0.7" />
      <circle cx="24" cy="24" r="2.5" fill="#F0EFEB" />
      <line x1="24" y1="8" x2="24" y2="11" stroke="#FF5C00" strokeWidth="1" opacity="0.5" />
      <line x1="24" y1="37" x2="24" y2="40" stroke="#FF5C00" strokeWidth="1" opacity="0.5" />
    </svg>
  )
}

// ─── Step module icons ────────────────────────────────────────────────────────

function ProfileModuleIcon() {
  return (
    <svg width="160" height="140" viewBox="0 0 160 140" fill="none" aria-hidden>
      {/* Corner ticks */}
      <path d="M10 22L10 10L22 10" stroke="rgba(240,239,235,0.25)" strokeWidth="1" />
      <path d="M150 22L150 10L138 10" stroke="rgba(240,239,235,0.25)" strokeWidth="1" />
      <path d="M10 118L10 130L22 130" stroke="rgba(240,239,235,0.25)" strokeWidth="1" />
      <path d="M150 118L150 130L138 130" stroke="rgba(240,239,235,0.25)" strokeWidth="1" />
      {/* Glow */}
      <circle cx="80" cy="66" r="38" fill="url(#pmGlow)" />
      {/* Rings */}
      <circle cx="80" cy="66" r="38" stroke="rgba(255,92,0,0.35)" strokeWidth="1" />
      <circle cx="80" cy="66" r="50" stroke="rgba(255,92,0,0.12)" strokeWidth="0.8" />
      <circle cx="80" cy="66" r="60" stroke="rgba(255,92,0,0.06)" strokeWidth="0.6" />
      {/* Person — backlit silhouette */}
      <circle cx="80" cy="52" r="13" fill="rgba(240,239,235,0.82)" />
      <path d="M53 92Q53 73 80 73Q107 73 107 92" fill="rgba(240,239,235,0.82)" />
      {/* VU left */}
      <rect x="18" y="54" width="4" height="22" rx="1" fill="rgba(255,92,0,0.65)" />
      <rect x="24" y="60" width="4" height="16" rx="1" fill="rgba(255,92,0,0.45)" />
      <rect x="30" y="57" width="4" height="19" rx="1" fill="rgba(255,92,0,0.55)" />
      {/* VU right */}
      <rect x="138" y="54" width="4" height="22" rx="1" fill="rgba(255,92,0,0.65)" />
      <rect x="132" y="60" width="4" height="16" rx="1" fill="rgba(255,92,0,0.45)" />
      <rect x="126" y="57" width="4" height="19" rx="1" fill="rgba(255,92,0,0.55)" />
      <defs>
        <radialGradient id="pmGlow" cx="50%" cy="38%" r="55%">
          <stop offset="0%" stopColor="rgba(255,115,0,0.55)" />
          <stop offset="55%" stopColor="rgba(255,92,0,0.18)" />
          <stop offset="100%" stopColor="rgba(255,92,0,0)" />
        </radialGradient>
      </defs>
    </svg>
  )
}

const PROX_DOTS = [
  { cx: 80, cy: 70, r: 5, main: true },
  { cx: 48, cy: 42, r: 3.5, main: false },
  { cx: 122, cy: 38, r: 3,   main: false },
  { cx: 132, cy: 87, r: 3.5, main: false },
  { cx: 38,  cy: 100, r: 2.5, main: false },
  { cx: 108, cy: 110, r: 3,   main: false },
]

function ProximityModuleIcon() {
  return (
    <svg width="160" height="140" viewBox="0 0 160 140" fill="none" aria-hidden>
      {/* Grid */}
      {[20,40,60,80,100,120,140].map(x => (
        <line key={`v${x}`} x1={x} y1="8" x2={x} y2="132" stroke="rgba(240,239,235,0.04)" strokeWidth="0.5" />
      ))}
      {[22,44,66,88,110].map(y => (
        <line key={`h${y}`} x1="8" y1={y} x2="152" y2={y} stroke="rgba(240,239,235,0.04)" strokeWidth="0.5" />
      ))}
      {/* Wave */}
      <path d="M8,70 C28,50 52,90 80,70 C108,50 132,90 152,70"
        stroke="rgba(139,92,246,0.55)" strokeWidth="1.5" fill="none" />
      {/* Dots */}
      {PROX_DOTS.map((d, i) =>
        d.main ? (
          <g key={i}>
            <circle cx={d.cx} cy={d.cy} r={12} fill="rgba(255,92,0,0.12)" />
            <circle cx={d.cx} cy={d.cy} r={d.r} fill="rgba(255,130,0,0.85)" />
            <circle cx={d.cx} cy={d.cy} r={2} fill="white" />
          </g>
        ) : (
          <circle key={i} cx={d.cx} cy={d.cy} r={d.r} fill="rgba(255,92,0,0.6)" />
        )
      )}
      {/* Meta */}
      <text x="10" y="17" fill="rgba(240,239,235,0.28)" fontSize="6.5" fontFamily="monospace">52.520° N · 13.405° E</text>
      <circle cx="141" cy="13" r="3" fill="#B8FF00" />
      <text x="146" y="17" fill="rgba(184,255,0,0.6)" fontSize="6.5" fontFamily="monospace">LIVE</text>
      <text x="10" y="130" fill="rgba(240,239,235,0.22)" fontSize="6" fontFamily="monospace">ACTIVE · 4 · NEARBY · 12 · RADIUS · 2.4KM</text>
      {/* Ticks */}
      <path d="M10 22L10 10L22 10" stroke="rgba(240,239,235,0.2)" strokeWidth="0.8" />
      <path d="M150 22L150 10L138 10" stroke="rgba(240,239,235,0.2)" strokeWidth="0.8" />
    </svg>
  )
}

const VU_BARS = [
  { h: 14, y: 56, op: 0.75 },
  { h: 9,  y: 61, op: 0.50 },
  { h: 16, y: 54, op: 0.85 },
  { h: 7,  y: 63, op: 0.40 },
  { h: 12, y: 58, op: 0.65 },
  { h: 15, y: 55, op: 0.78 },
  { h: 8,  y: 62, op: 0.48 },
  { h: 11, y: 59, op: 0.62 },
]

function ResonanceModuleIcon() {
  return (
    <svg width="160" height="140" viewBox="0 0 160 140" fill="none" aria-hidden>
      <ellipse cx="80" cy="70" rx="48" ry="34" fill="url(#resGlow)" />
      {/* Circles */}
      <circle cx="66" cy="70" r="28" fill="rgba(255,92,0,0.10)" stroke="rgba(255,92,0,0.60)" strokeWidth="1.5" />
      <circle cx="94" cy="70" r="28" fill="rgba(139,92,246,0.10)" stroke="rgba(139,92,246,0.60)" strokeWidth="1.5" />
      {/* Intersection pulse */}
      <circle cx="80" cy="70" r="5" fill="white" opacity="0.88" />
      <circle cx="80" cy="70" r="10" fill="rgba(255,255,255,0.08)" />
      {/* VU bars */}
      {VU_BARS.map((b, i) => (
        <rect key={i} x={126 + i * 4} y={b.y} width="2.5" height={b.h} rx="0.5"
          fill={`rgba(255,92,0,${b.op})`} />
      ))}
      {/* Meta */}
      <text x="10" y="17" fill="rgba(240,239,235,0.28)" fontSize="6.5" fontFamily="monospace">SIGNAL</text>
      <circle cx="132" cy="13" r="3" fill="#FF5C00" />
      <text x="137" y="17" fill="rgba(255,92,0,0.7)" fontSize="6.5" fontFamily="monospace">LOCKED</text>
      {/* Ticks */}
      <path d="M10 22L10 10L22 10" stroke="rgba(240,239,235,0.2)" strokeWidth="0.8" />
      <path d="M150 22L150 10L138 10" stroke="rgba(240,239,235,0.2)" strokeWidth="0.8" />
      <defs>
        <radialGradient id="resGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(200,72,160,0.32)" />
          <stop offset="100%" stopColor="rgba(200,72,160,0)" />
        </radialGradient>
      </defs>
    </svg>
  )
}

// ─── Profile showcase card ────────────────────────────────────────────────────

const CARD_TAGS = [
  { label: 'DRUMS', accent: true },
  { label: 'POST-PUNK', accent: false },
  { label: 'SHOEGAZE', accent: false },
  { label: 'DREAM', accent: false },
]

const CARD_STATS = [
  { label: 'CITY',        value: 'BERLIN' },
  { label: 'LOOKING FOR', value: 'A BAND' },
  { label: 'PLAYS',       value: 'WEEKENDS' },
]

function BarcodeStripes() {
  const widths = [2,1,2,1,1,2,1,2,1,1,2,1,1,2,1,2,1,2,1,1,2,1,2,1,1]
  let x = 0
  return (
    <svg width="80" height="22" viewBox="0 0 80 22" aria-hidden>
      {widths.map((w, i) => {
        const rect = <rect key={i} x={x} y={0} width={w} height={18} fill="rgba(240,239,235,0.5)" />
        x += w + 1
        return rect
      })}
    </svg>
  )
}

function ProfileShowcaseCard() {
  return (
    <div className="relative w-[290px] overflow-hidden rounded-2xl border border-[rgba(240,239,235,0.10)] bg-[rgba(10,10,10,0.96)] shadow-[0_0_60px_rgba(255,92,0,0.15)]">
      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-3">
        <div>
          <p className="text-[18px] leading-none tracking-[0.10em] text-[#F0EFEB]"
            style={{ fontFamily: 'var(--font-bebas)' }}>SONUS</p>
          <p className="mt-0.5 text-[7px] tracking-[0.22em] text-[rgba(240,239,235,0.38)]">BACKSTAGE · ALL AREAS</p>
          <div className="mt-1.5 h-px w-10 bg-[#FF5C00]" />
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-[#B8FF00] px-2.5 py-1 opacity-90">
          <span className="h-1.5 w-1.5 rounded-full bg-[#B8FF00]" />
          <span className="text-[7px] tracking-[0.15em] text-[#B8FF00]">LIVE NOW</span>
        </div>
      </div>

      {/* Photo frame */}
      <div className="relative mx-3 h-[190px] overflow-hidden rounded-lg bg-[#080808]">
        {/* Corner ticks */}
        <span className="absolute left-2 top-2 block h-3 w-3 border-l border-t border-[rgba(240,239,235,0.25)]" />
        <span className="absolute right-2 top-2 block h-3 w-3 border-r border-t border-[rgba(240,239,235,0.25)]" />
        <span className="absolute bottom-2 left-2 block h-3 w-3 border-b border-l border-[rgba(240,239,235,0.25)]" />
        <span className="absolute bottom-2 right-2 block h-3 w-3 border-b border-r border-[rgba(240,239,235,0.25)]" />
        {/* Orange backlight */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-28 w-28 rounded-full bg-[#FF5C00] opacity-35 blur-2xl" />
        </div>
        {/* Silhouette */}
        <svg className="absolute inset-0 m-auto" width="96" height="116"
          viewBox="0 0 96 116" fill="none" aria-hidden>
          <defs>
            <linearGradient id="silFill" x1="48" y1="0" x2="48" y2="116" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="rgba(255,130,0,0.92)" />
              <stop offset="100%" stopColor="rgba(255,55,0,0.55)" />
            </linearGradient>
          </defs>
          <circle cx="48" cy="26" r="17" fill="url(#silFill)" />
          <path d="M12 98Q12 60 48 60Q84 60 84 98L84 116L12 116Z" fill="url(#silFill)" />
          <line x1="12" y1="75" x2="2" y2="63" stroke="url(#silFill)" strokeWidth="7" strokeLinecap="round" />
          <line x1="84" y1="75" x2="94" y2="63" stroke="url(#silFill)" strokeWidth="7" strokeLinecap="round" />
        </svg>
        {/* Overlaid meta */}
        <p className="absolute bottom-2 left-3 text-[7px] tracking-widest text-[rgba(240,239,235,0.35)]">
          ID # SNS-04417
        </p>
        <p className="absolute bottom-2 right-3 text-[7px] tracking-widest text-[#FF5C00]">
          DRUMS · LEAD
        </p>
      </div>

      {/* Info */}
      <div className="px-4 pt-3 pb-4">
        <h3 className="text-[24px] leading-none tracking-[0.04em] text-[#F0EFEB]"
          style={{ fontFamily: 'var(--font-bebas)' }}>MILA OKONKWO</h3>
        <p className="mb-3 mt-0.5 text-[8px] text-[rgba(240,239,235,0.38)]">
          @mila.makes.noise · est. &apos;22
        </p>
        {/* Tags */}
        <div className="mb-4 flex flex-wrap gap-1.5">
          {CARD_TAGS.map(t => (
            <span key={t.label}
              className={`rounded-full px-2.5 py-0.5 text-[7.5px] font-medium tracking-widest ${
                t.accent
                  ? 'bg-[#FF5C00] text-black'
                  : 'border border-[rgba(240,239,235,0.18)] text-[rgba(240,239,235,0.65)]'
              }`}
            >
              {t.label}
            </span>
          ))}
        </div>
        {/* Stats */}
        <div className="mb-4 grid grid-cols-3 gap-2 border-t border-[rgba(240,239,235,0.06)] pt-3">
          {CARD_STATS.map(s => (
            <div key={s.label}>
              <p className="text-[6.5px] tracking-[0.18em] text-[rgba(240,239,235,0.28)]">{s.label}</p>
              <p className="mt-0.5 text-[8.5px] font-semibold tracking-wide text-[#F0EFEB]">{s.value}</p>
            </div>
          ))}
        </div>
        {/* Footer */}
        <div className="flex items-end justify-between border-t border-[rgba(240,239,235,0.06)] pt-3">
          <div>
            <BarcodeStripes />
            <p className="mt-0.5 text-[6.5px] text-[rgba(240,239,235,0.2)]">SNS-04417 · 26W19</p>
          </div>
          <div className="text-right">
            <p className="text-[8px] tracking-[0.14em] text-[rgba(240,239,235,0.55)]">FIND YOUR PEOPLE</p>
            <p className="text-[7.5px] tracking-[0.12em] text-[#FF5C00]">MAKE NOISE.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── City map ─────────────────────────────────────────────────────────────────

const MAP_PINS = [
  { top: '28%', left: '24%', delay: '0s',    size: 'lg' },
  { top: '52%', left: '50%', delay: '0.5s',  size: 'xl' },
  { top: '22%', left: '64%', delay: '1.1s',  size: 'md' },
  { top: '68%', left: '33%', delay: '0.3s',  size: 'md' },
  { top: '42%', left: '78%', delay: '1.6s',  size: 'lg' },
  { top: '62%', left: '14%', delay: '0.9s',  size: 'sm' },
  { top: '14%', left: '44%', delay: '1.3s',  size: 'sm' },
]

const PIN_SIZE: Record<string, { outer: number; inner: number }> = {
  sm: { outer: 10, inner: 6 },
  md: { outer: 12, inner: 7 },
  lg: { outer: 14, inner: 8 },
  xl: { outer: 18, inner: 10 },
}

function CityMap() {
  return (
    <div className="relative h-52 w-full overflow-hidden rounded-xl bg-[#060606]">
      {/* Grid SVG */}
      <svg className="absolute inset-0" width="100%" height="100%"
        viewBox="0 0 400 208" preserveAspectRatio="xMidYMid slice" aria-hidden>
        {[30,60,104,140,170].map(y => (
          <line key={`h${y}`} x1="0" y1={y} x2="400" y2={y}
            stroke="rgba(240,239,235,0.04)" strokeWidth="1" />
        ))}
        {[40,80,120,160,200,240,280,320,360].map(x => (
          <line key={`v${x}`} x1={x} y1="0" x2={x} y2="208"
            stroke="rgba(240,239,235,0.04)" strokeWidth="1" />
        ))}
        {/* Major avenues */}
        <line x1="0" y1="104" x2="400" y2="104" stroke="rgba(240,239,235,0.07)" strokeWidth="1.5" />
        <line x1="200" y1="0" x2="200" y2="208" stroke="rgba(240,239,235,0.07)" strokeWidth="1.5" />
      </svg>

      {/* Pulsing pins */}
      {MAP_PINS.map((pin, i) => {
        const sz = PIN_SIZE[pin.size]
        return (
          <div key={i} className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ top: pin.top, left: pin.left }}>
            {/* Ping ring */}
            <span className="absolute block rounded-full bg-[#FF5C00]"
              style={{
                width: sz.outer, height: sz.outer,
                top: -(sz.outer - sz.inner) / 2,
                left: -(sz.outer - sz.inner) / 2,
                animation: `sonus-ping 2.8s ${pin.delay} ease-out infinite`,
                opacity: 0.5,
              }} />
            {/* Dot */}
            <span className="relative block rounded-full bg-[#FF5C00]"
              style={{
                width: sz.inner, height: sz.inner,
                boxShadow: `0 0 ${sz.inner * 1.5}px rgba(255,92,0,0.9)`,
              }} />
          </div>
        )
      })}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const STEPS = [
  {
    num: '01', tag: 'PROFILE',
    label: 'Create your profile',
    sub: "Set your instruments, genres, and what you're looking for.",
    Icon: ProfileModuleIcon,
  },
  {
    num: '02', tag: 'PROXIMITY',
    label: 'Find musicians near you',
    sub: "Drop the pin. See who's within walking distance.",
    Icon: ProximityModuleIcon,
  },
  {
    num: '03', tag: 'RESONANCE',
    label: 'Make some noise',
    sub: 'Two signals meet. A band is born.',
    Icon: ResonanceModuleIcon,
  },
]

const heroStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
}

const heroFadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1, y: 0,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const },
  },
}

export default function Home() {
  return (
    <>
      <WaveCanvas />

      <main
        className="relative text-[#F0EFEB]"
        style={{ zIndex: 1, fontFamily: 'var(--font-dm-sans)' }}
      >
        {/* ── Hero ─────────────────────────────────────────── */}
        <section className="flex min-h-screen flex-col items-center justify-center px-4 py-20">
          <motion.div
            variants={heroStagger}
            initial="hidden"
            animate="show"
            className="flex flex-col items-center gap-6 text-center"
          >
            <motion.h1
              variants={heroFadeUp}
              className="text-[clamp(6rem,22vw,11rem)] leading-none tracking-widest text-[#F0EFEB]"
              style={{
                fontFamily: 'var(--font-bebas)',
                textShadow: '0 0 80px rgba(255,92,0,0.6), 0 0 240px rgba(255,92,0,0.2)',
              }}
            >
              SONUS
            </motion.h1>

            <motion.p
              variants={heroFadeUp}
              className="text-base tracking-[0.18em] uppercase text-[rgba(240,239,235,0.45)]"
            >
              Find your people. Make noise.
            </motion.p>

            <motion.div variants={heroFadeUp} className="mt-2">
              <div className="glass flex flex-col items-center gap-4 px-8 py-6">
                <Link
                  href="/onboarding"
                  className="rounded-xl bg-[#FF5C00] px-8 py-3 text-sm font-semibold text-black shadow-[0_0_28px_rgba(255,92,0,0.45)] transition-opacity hover:opacity-90 active:opacity-80"
                >
                  Get started
                </Link>
                <p className="text-xs text-[rgba(240,239,235,0.25)]">
                  Free · No algorithm · Just music
                </p>
              </div>
            </motion.div>
          </motion.div>
        </section>

        {/* ── How it works ─────────────────────────────────── */}
        <section className="px-4 py-28">
          <div className="mx-auto max-w-5xl">
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5 }}
              className="mb-12 text-[10px] tracking-[0.28em] uppercase text-[rgba(240,239,235,0.3)]"
            >
              How it works
            </motion.p>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <motion.div
                  key={step.num}
                  initial={{ opacity: 0, y: 36 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.6, delay: i * 0.13, ease: [0.16, 1, 0.3, 1] as const }}
                >
                  <div className="glass flex flex-col gap-4 p-5">
                    {/* Module header */}
                    <div className="flex items-center justify-between text-[9px] tracking-[0.22em] text-[rgba(240,239,235,0.28)]">
                      <span>{step.num} / {step.tag}</span>
                      <div className="flex gap-1">
                        <span className="h-1 w-1 rounded-full bg-[#FF5C00]" />
                        <span className="h-1 w-1 rounded-full bg-[rgba(240,239,235,0.18)]" />
                        <span className="h-1 w-1 rounded-full bg-[rgba(240,239,235,0.18)]" />
                      </div>
                    </div>
                    {/* Icon */}
                    <div className="flex justify-center py-1">
                      <step.Icon />
                    </div>
                    {/* Label */}
                    <div className="border-t border-[rgba(240,239,235,0.06)] pt-3">
                      <p className="mb-1 text-[10px] font-semibold tracking-[0.14em] uppercase text-[rgba(240,239,235,0.7)]">
                        {step.label}
                      </p>
                      <p className="text-[11px] text-[rgba(240,239,235,0.4)]">{step.sub}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Profile card showcase ─────────────────────────── */}
        <section className="flex flex-col items-center px-4 py-24">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="mb-12 text-[10px] tracking-[0.28em] uppercase text-[rgba(240,239,235,0.3)]"
          >
            Your profile
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.93 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] as const }}
          >
            <ProfileShowcaseCard />
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-8 text-center text-xs text-[rgba(240,239,235,0.3)]"
          >
            Not the app screen — a backstage pass.
          </motion.p>
        </section>

        {/* ── City map ─────────────────────────────────────── */}
        <section className="px-4 py-20">
          <div className="mx-auto max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] as const }}
              className="glass overflow-hidden p-1"
            >
              <CityMap />
            </motion.div>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="mt-6 text-center text-sm text-[rgba(240,239,235,0.38)]"
            >
              Your city is full of musicians. Find them.
            </motion.p>
          </div>
        </section>

        {/* ── CTA footer ───────────────────────────────────── */}
        <section className="relative flex flex-col items-center overflow-hidden px-4 py-32">
          {/* Radial glow */}
          <div aria-hidden className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2">
            <div className="h-[360px] w-[560px] rounded-full bg-[#FF5C00] opacity-[0.07] blur-[110px]" />
          </div>

          <div className="relative z-10 flex flex-col items-center gap-6 text-center">
            <div className="flex items-center gap-3">
              <SonusSymbol size={36} />
              <span
                className="text-[42px] leading-none tracking-[0.12em] text-[#F0EFEB]"
                style={{ fontFamily: 'var(--font-bebas)' }}
              >
                SONUS
              </span>
            </div>

            <p className="text-[rgba(240,239,235,0.45)]">
              Ready to find your people?
            </p>

            <Link
              href="/onboarding"
              className="w-full max-w-xs rounded-xl bg-[#FF5C00] px-8 py-4 text-center text-sm font-semibold text-black shadow-[0_0_40px_rgba(255,92,0,0.4)] transition-opacity hover:opacity-90 sm:w-auto"
            >
              Get started
            </Link>

            <p className="text-[10px] tracking-[0.25em] uppercase text-[rgba(240,239,235,0.18)]">
              Sound · Est. Berlin 26
            </p>
          </div>
        </section>
      </main>
    </>
  )
}
