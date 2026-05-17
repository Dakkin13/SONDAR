'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import MarketingNav from '@/components/ui/MarketingNav'

// ─── TopNav → now handled by shared <MarketingNav /> ─────────────────────────

// ─── Sondar symbol ────────────────────────────────────────────────────────────

function SondarSymbol({ size = 48 }: { size?: number }) {
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
      <path d="M10 22L10 10L22 10" stroke="rgba(240,239,235,0.25)" strokeWidth="1" />
      <path d="M150 22L150 10L138 10" stroke="rgba(240,239,235,0.25)" strokeWidth="1" />
      <path d="M10 118L10 130L22 130" stroke="rgba(240,239,235,0.25)" strokeWidth="1" />
      <path d="M150 118L150 130L138 130" stroke="rgba(240,239,235,0.25)" strokeWidth="1" />
      <circle cx="80" cy="66" r="38" fill="url(#pmGlow)" />
      <circle cx="80" cy="66" r="38" stroke="rgba(255,92,0,0.35)" strokeWidth="1" />
      <circle cx="80" cy="66" r="50" stroke="rgba(255,92,0,0.12)" strokeWidth="0.8" />
      <circle cx="80" cy="66" r="60" stroke="rgba(255,92,0,0.06)" strokeWidth="0.6" />
      <circle cx="80" cy="52" r="13" fill="rgba(240,239,235,0.82)" />
      <path d="M53 92Q53 73 80 73Q107 73 107 92" fill="rgba(240,239,235,0.82)" />
      <rect x="18" y="54" width="4" height="22" rx="1" fill="rgba(255,92,0,0.65)" />
      <rect x="24" y="60" width="4" height="16" rx="1" fill="rgba(255,92,0,0.45)" />
      <rect x="30" y="57" width="4" height="19" rx="1" fill="rgba(255,92,0,0.55)" />
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
  { cx: 80,  cy: 70,  r: 5,   main: true  },
  { cx: 48,  cy: 42,  r: 3.5, main: false },
  { cx: 122, cy: 38,  r: 3,   main: false },
  { cx: 132, cy: 87,  r: 3.5, main: false },
  { cx: 38,  cy: 100, r: 2.5, main: false },
  { cx: 108, cy: 110, r: 3,   main: false },
]

function ProximityModuleIcon() {
  return (
    <svg width="160" height="140" viewBox="0 0 160 140" fill="none" aria-hidden>
      {[20,40,60,80,100,120,140].map(x => (
        <line key={`v${x}`} x1={x} y1="8" x2={x} y2="132" stroke="rgba(240,239,235,0.04)" strokeWidth="0.5" />
      ))}
      {[22,44,66,88,110].map(y => (
        <line key={`h${y}`} x1="8" y1={y} x2="152" y2={y} stroke="rgba(240,239,235,0.04)" strokeWidth="0.5" />
      ))}
      <path d="M8,70 C28,50 52,90 80,70 C108,50 132,90 152,70"
        stroke="rgba(139,92,246,0.55)" strokeWidth="1.5" fill="none" />
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
      <text x="10" y="17" fill="rgba(240,239,235,0.28)" fontSize="6.5" fontFamily="monospace">48.861° N · 2.349° E</text>
      <circle cx="141" cy="13" r="3" fill="#B8FF00" />
      <text x="146" y="17" fill="rgba(184,255,0,0.6)" fontSize="6.5" fontFamily="monospace">LIVE</text>
      <text x="10" y="130" fill="rgba(240,239,235,0.22)" fontSize="6" fontFamily="monospace">ACTIVE · 4 · NEARBY · 12 · RADIUS · 2.4KM</text>
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
      <circle cx="66" cy="70" r="28" fill="rgba(255,92,0,0.10)" stroke="rgba(255,92,0,0.60)" strokeWidth="1.5" />
      <circle cx="94" cy="70" r="28" fill="rgba(139,92,246,0.10)" stroke="rgba(139,92,246,0.60)" strokeWidth="1.5" />
      <circle cx="80" cy="70" r="5" fill="white" opacity="0.88" />
      <circle cx="80" cy="70" r="10" fill="rgba(255,255,255,0.08)" />
      {VU_BARS.map((b, i) => (
        <rect key={i} x={126 + i * 4} y={b.y} width="2.5" height={b.h} rx="0.5"
          fill={`rgba(255,92,0,${b.op})`} />
      ))}
      <text x="10" y="17" fill="rgba(240,239,235,0.28)" fontSize="6.5" fontFamily="monospace">SIGNAL</text>
      <circle cx="132" cy="13" r="3" fill="#FF5C00" />
      <text x="137" y="17" fill="rgba(255,92,0,0.7)" fontSize="6.5" fontFamily="monospace">LOCKED</text>
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
  { label: 'CITY',        value: 'LONDON' },
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
      <div className="flex items-start justify-between px-4 pt-4 pb-3">
        <div>
          <p className="text-[18px] leading-none tracking-[0.10em] text-[#F0EFEB]"
            style={{ fontFamily: 'var(--font-bebas)' }}>SONDAR</p>
          <p className="mt-0.5 text-[7px] tracking-[0.22em] text-[rgba(240,239,235,0.38)]">BACKSTAGE · ALL AREAS</p>
          <div className="mt-1.5 h-px w-10 bg-[#FF5C00]" />
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-[#B8FF00] px-2.5 py-1 opacity-90">
          <span className="h-1.5 w-1.5 rounded-full bg-[#B8FF00]" />
          <span className="text-[7px] tracking-[0.15em] text-[#B8FF00]">LIVE NOW</span>
        </div>
      </div>
      <div className="relative mx-3 h-[190px] overflow-hidden rounded-lg bg-[#080808]">
        <span className="absolute left-2 top-2 block h-3 w-3 border-l border-t border-[rgba(240,239,235,0.25)]" />
        <span className="absolute right-2 top-2 block h-3 w-3 border-r border-t border-[rgba(240,239,235,0.25)]" />
        <span className="absolute bottom-2 left-2 block h-3 w-3 border-b border-l border-[rgba(240,239,235,0.25)]" />
        <span className="absolute bottom-2 right-2 block h-3 w-3 border-b border-r border-[rgba(240,239,235,0.25)]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-28 w-28 rounded-full bg-[#FF5C00] opacity-35 blur-2xl" />
        </div>
        <svg className="absolute inset-0 m-auto" width="96" height="116" viewBox="0 0 96 116" fill="none" aria-hidden>
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
        <p className="absolute bottom-2 left-3 text-[7px] tracking-widest text-[rgba(240,239,235,0.35)]">ID # SDR-04417</p>
        <p className="absolute bottom-2 right-3 text-[7px] tracking-widest text-[#FF5C00]">DRUMS · LEAD</p>
      </div>
      <div className="px-4 pt-3 pb-4">
        <h3 className="text-[24px] leading-none tracking-[0.04em] text-[#F0EFEB]"
          style={{ fontFamily: 'var(--font-bebas)' }}>MILA OKONKWO</h3>
        <p className="mb-3 mt-0.5 text-[8px] text-[rgba(240,239,235,0.38)]">@mila.makes.noise · est. &apos;22</p>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {CARD_TAGS.map(t => (
            <span key={t.label}
              className={`rounded-full px-2.5 py-0.5 text-[7.5px] font-medium tracking-widest ${
                t.accent ? 'bg-[#FF5C00] text-black' : 'border border-[rgba(240,239,235,0.18)] text-[rgba(240,239,235,0.65)]'
              }`}>{t.label}</span>
          ))}
        </div>
        <div className="mb-4 grid grid-cols-3 gap-2 border-t border-[rgba(240,239,235,0.06)] pt-3">
          {CARD_STATS.map(s => (
            <div key={s.label}>
              <p className="text-[6.5px] tracking-[0.18em] text-[rgba(240,239,235,0.28)]">{s.label}</p>
              <p className="mt-0.5 text-[8.5px] font-semibold tracking-wide text-[#F0EFEB]">{s.value}</p>
            </div>
          ))}
        </div>
        <div className="flex items-end justify-between border-t border-[rgba(240,239,235,0.06)] pt-3">
          <div>
            <BarcodeStripes />
            <p className="mt-0.5 text-[6.5px] text-[rgba(240,239,235,0.2)]">SDR-04417 · 26W19</p>
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

// ─── Europe map dots ──────────────────────────────────────────────────────────

const MAP_PINS = [
  { top: '28%', left: '24%', delay: '0s',   size: 'lg' },
  { top: '52%', left: '50%', delay: '0.5s', size: 'xl' },
  { top: '22%', left: '64%', delay: '1.1s', size: 'md' },
  { top: '68%', left: '33%', delay: '0.3s', size: 'md' },
  { top: '42%', left: '78%', delay: '1.6s', size: 'lg' },
  { top: '62%', left: '14%', delay: '0.9s', size: 'sm' },
  { top: '14%', left: '44%', delay: '1.3s', size: 'sm' },
  { top: '38%', left: '60%', delay: '0.7s', size: 'md' },
  { top: '72%', left: '62%', delay: '1.8s', size: 'sm' },
]

const PIN_SIZE: Record<string, { outer: number; inner: number }> = {
  sm: { outer: 10, inner: 6 },
  md: { outer: 12, inner: 7 },
  lg: { outer: 14, inner: 8 },
  xl: { outer: 18, inner: 10 },
}

function EuropeMap() {
  return (
    <div className="relative h-52 w-full overflow-hidden rounded-xl bg-[#060606]">
      <svg className="absolute inset-0" width="100%" height="100%"
        viewBox="0 0 400 208" preserveAspectRatio="xMidYMid slice" aria-hidden>
        {[30,60,104,140,170].map(y => (
          <line key={`h${y}`} x1="0" y1={y} x2="400" y2={y} stroke="rgba(240,239,235,0.04)" strokeWidth="1" />
        ))}
        {[40,80,120,160,200,240,280,320,360].map(x => (
          <line key={`v${x}`} x1={x} y1="0" x2={x} y2="208" stroke="rgba(240,239,235,0.04)" strokeWidth="1" />
        ))}
        <line x1="0" y1="104" x2="400" y2="104" stroke="rgba(240,239,235,0.07)" strokeWidth="1.5" />
        <line x1="200" y1="0" x2="200" y2="208" stroke="rgba(240,239,235,0.07)" strokeWidth="1.5" />
      </svg>
      {MAP_PINS.map((pin, i) => {
        const sz = PIN_SIZE[pin.size]
        return (
          <div key={i} className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ top: pin.top, left: pin.left }}>
            <span className="absolute block rounded-full bg-[#FF5C00]"
              style={{
                width: sz.outer, height: sz.outer,
                top: -(sz.outer - sz.inner) / 2, left: -(sz.outer - sz.inner) / 2,
                animation: `sondar-ping 2.8s ${pin.delay} ease-out infinite`, opacity: 0.5,
              }} />
            <span className="relative block rounded-full bg-[#FF5C00]"
              style={{ width: sz.inner, height: sz.inner, boxShadow: `0 0 ${sz.inner * 1.5}px rgba(255,92,0,0.9)` }} />
          </div>
        )
      })}
    </div>
  )
}

// ─── How it works ─────────────────────────────────────────────────────────────

const HOW_IT_WORKS = [
  {
    num: '01', tag: 'PROFILE',
    title: 'Create your profile',
    body: 'Set your instruments, genres, and what you\'re looking for. A bandmate. A jam session. Studio time. You\'re in control.',
    Icon: ProfileModuleIcon,
  },
  {
    num: '02', tag: 'PROXIMITY',
    title: 'Find musicians near you',
    body: 'Drop the pin. See who\'s within walking distance. Filter by instrument, genre, or availability. No algorithm — just proximity.',
    Icon: ProximityModuleIcon,
  },
  {
    num: '03', tag: 'RESONANCE',
    title: 'Make some noise',
    body: 'Two signals meet. A band is born. Message them directly, book a space, and make it happen.',
    Icon: ResonanceModuleIcon,
  },
]

// ─── European cities ──────────────────────────────────────────────────────────

const CITIES = [
  'Madrid', 'London', 'Paris', 'Berlin', 'Amsterdam', 'Barcelona',
  'Lisbon', 'Rome', 'Prague', 'Warsaw', 'Vienna',
  'Brussels', 'Stockholm', 'Copenhagen', 'Athens', 'Budapest',
]

// ─── Stats ────────────────────────────────────────────────────────────────────

const STATS = [
  { figure: '4M+',  label: 'active musicians across Europe',          note: 'European Music Market Report, 2024' },
  { figure: '67%',  label: 'of musicians struggle to find collaborators', note: 'MIDEM musician survey, 2023' },
  { figure: 'ENDLESS', label: 'bands waiting to be formed', note: 'Do the math.' },
]

// ─── Framer Motion variants ────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.16, 1, 0.3, 1] as const } },
}
const stagger = (delay = 0.12) => ({
  hidden: {},
  show:   { transition: { staggerChildren: delay } },
})

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const howRef = useRef<HTMLElement>(null)

  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function scrollToHow() {
    const el = document.getElementById('how-it-works')
    if (!el) return
    const scrollTop = document.documentElement.scrollTop || document.body.scrollTop
    const y = el.getBoundingClientRect().top + scrollTop - 72
    window.scrollTo({ top: y, behavior: 'smooth' })
  }

  return (
    <>
      <MarketingNav />

      {/* ── Fixed ambient orbs — follow user through the whole page ───────── */}
      <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', right: '-5%', top: '-5%',
          width: 700, height: 700,
          background: 'radial-gradient(circle at 70% 20%, rgba(255,85,0,0.22) 0%, rgba(255,85,0,0.08) 35%, transparent 65%)',
          borderRadius: '50%',
          transform: `translateY(${scrollY * 0.12}px)`,
          willChange: 'transform',
        }} />
        <div style={{
          position: 'absolute', left: '-5%', bottom: '-5%',
          width: 600, height: 600,
          background: 'radial-gradient(circle at 25% 75%, rgba(91,33,182,0.20) 0%, rgba(91,33,182,0.07) 40%, transparent 65%)',
          borderRadius: '50%',
          transform: `translateY(${-scrollY * 0.08}px)`,
          willChange: 'transform',
        }} />
      </div>

      <main className="relative text-[#F0EFEB]" style={{ zIndex: 1, fontFamily: 'var(--font-dm-sans)' }}>

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="relative flex flex-col items-center justify-center px-5 text-center"
          style={{ minHeight: '100dvh', paddingTop: 80, paddingBottom: 40 }}>

          {/* Subtle hero-centre glow (not scrolled) */}
          <div aria-hidden className="pointer-events-none absolute inset-0" style={{ overflow: 'hidden' }}>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ width: 800, height: 400, background: 'radial-gradient(ellipse at 50% 50%, rgba(255,85,0,0.05) 0%, transparent 60%)', borderRadius: '50%' }} />
          </div>

          <motion.div variants={stagger(0.1)} initial={false} animate="show"
            className="relative z-10 flex flex-col items-center gap-6 sm:gap-8">

            {/* Lozenge badge */}
            <motion.div variants={fadeUp}
              className="flex items-center gap-2 rounded-full border border-[rgba(255,85,0,0.25)] bg-[rgba(255,85,0,0.08)] px-4 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#FF5500]" style={{ boxShadow: '0 0 6px rgba(255,85,0,0.8)' }} />
              <span className="text-[11px] font-medium tracking-[0.18em] text-[rgba(255,85,0,0.85)]">SONDAR · ACROSS EUROPE</span>
            </motion.div>

            {/* Headline */}
            <motion.h1 variants={fadeUp}
              className="leading-[0.92] tracking-[0.03em] text-[#F0EFEB]"
              style={{
                fontFamily: 'var(--font-bebas)',
                fontSize: 'clamp(52px, 13vw, 110px)',
                textShadow: '0 0 120px rgba(255,92,0,0.5), 0 0 280px rgba(255,92,0,0.2)',
              }}>
              FIND YOUR PEOPLE.<br />MAKE NOISE.
            </motion.h1>

            {/* Subtitle */}
            <motion.p variants={fadeUp}
              className="max-w-[520px] text-base leading-relaxed text-[rgba(240,239,235,0.55)] sm:text-lg">
              The app that connects musicians in the same city. Find your next bandmate,
              book a rehearsal space, and make it happen.
            </motion.p>

            {/* CTAs */}
            <motion.div variants={fadeUp} className="flex flex-col items-center gap-3 sm:flex-row">
              <Link href="/login"
                className="flex items-center justify-center rounded-full bg-[#FF5500] px-8 py-3.5 text-base font-semibold text-black shadow-[0_0_40px_rgba(255,85,0,0.5)] transition-opacity hover:opacity-90">
                Get started — it&apos;s free
              </Link>
              {/* Plain <a> link — no JS needed, works on all iOS versions */}
              <a
                href="#how-it-works"
                className="flex items-center justify-center rounded-full border border-[rgba(240,239,235,0.15)] bg-[rgba(240,239,235,0.05)] px-8 py-3.5 text-base font-medium text-[rgba(240,239,235,0.75)] backdrop-blur-sm transition-colors hover:border-[rgba(240,239,235,0.3)] hover:text-[#F0EFEB]"
                style={{ textDecoration: 'none' }}>
                See how it works
              </a>
            </motion.div>

            {/* Scroll indicator — in normal flow so always visible on mobile too */}
            <motion.div variants={fadeUp} className="flex flex-col items-center gap-2 pt-4 pointer-events-none">
              <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                className="flex flex-col items-center gap-2"
              >
                <div className="h-10 w-px bg-gradient-to-b from-transparent to-[rgba(240,239,235,0.45)]" />
                <div className="h-2 w-2 rotate-45 border-b-2 border-r-2 border-[rgba(240,239,235,0.55)]" />
              </motion.div>
            </motion.div>

          </motion.div>
        </section>

        {/* ── How it works ──────────────────────────────────────────────────── */}
        <section id="how-it-works" ref={howRef} className="px-5 py-24 sm:py-32" style={{ scrollMarginTop: 72 }}>
          <div className="mx-auto max-w-5xl">
            <motion.p initial={{ opacity: 1, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }} transition={{ duration: 0.5 }}
              className="mb-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-[rgba(240,239,235,0.3)]">
              How it works
            </motion.p>
            <motion.h2 initial={{ opacity: 1, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }} transition={{ duration: 0.5, delay: 0.05 }}
              className="mb-12 leading-none tracking-[0.04em] text-[#F0EFEB]"
              style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(36px, 7vw, 64px)' }}>
              Three steps to your next jam
            </motion.h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {HOW_IT_WORKS.map((item, i) => (
                <motion.div key={item.num}
                  initial={{ opacity: 1, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.1 }}
                  transition={{ duration: 0.5, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] as const }}
                  className="glass flex flex-col gap-4 p-5">
                  <div className="flex items-center justify-between text-[9px] tracking-[0.22em] text-[rgba(240,239,235,0.28)]">
                    <span>{item.num} / {item.tag}</span>
                    <div className="flex gap-1">
                      <span className="h-1 w-1 rounded-full bg-[#FF5C00]" />
                      <span className="h-1 w-1 rounded-full bg-[rgba(240,239,235,0.18)]" />
                      <span className="h-1 w-1 rounded-full bg-[rgba(240,239,235,0.18)]" />
                    </div>
                  </div>
                  <div className="flex justify-center py-1"><item.Icon /></div>
                  <div className="border-t border-[rgba(240,239,235,0.06)] pt-3">
                    <p className="mb-1 text-[10px] font-semibold tracking-[0.14em] uppercase text-[rgba(240,239,235,0.7)]">{item.title}</p>
                    <p className="text-[11px] text-[rgba(240,239,235,0.4)]">{item.body}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Profile card showcase ──────────────────────────────────────────── */}
        <section className="relative flex flex-col items-center overflow-hidden px-5 py-24 sm:py-32">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ width: 600, height: 600, background: 'radial-gradient(circle, rgba(255,92,0,0.08) 0%, transparent 65%)', borderRadius: '50%' }} />
          </div>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-[rgba(240,239,235,0.3)]">
            Your profile
          </p>
          <p className="mb-10 text-center leading-none tracking-[0.04em] text-[#F0EFEB]"
            style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(32px, 6vw, 56px)' }}>
            Not a profile. A backstage pass.
          </p>
          <motion.div initial={{ opacity: 1, scale: 0.95, y: 20 }} whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] as const }}>
            <ProfileShowcaseCard />
          </motion.div>
          <p className="mt-6 text-center text-xs text-[rgba(240,239,235,0.3)]">
            Your instruments, your vibe, your city — all in one card.
          </p>
        </section>

        {/* ── About / mission ───────────────────────────────────────────────── */}
        <section className="px-5 py-24 sm:py-32">
          <div className="mx-auto max-w-5xl">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-20">
              <div>
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-[rgba(240,239,235,0.3)]">
                  Why Sondar exists
                </p>
                <h2 className="mb-6 leading-none tracking-[0.04em] text-[#F0EFEB]"
                  style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(32px, 6vw, 56px)' }}>
                  Cities are full of musicians who can&apos;t find each other
                </h2>
                <p className="text-base leading-relaxed text-[rgba(240,239,235,0.55)]">
                  Every city is full of musicians who can&apos;t find each other. Guitarists
                  looking for drummers. Producers looking for vocalists. Bands looking for
                  a bassist. The tools to connect them have been broken for years — outdated
                  apps, dead Facebook groups, random luck.
                </p>
                <p className="mt-4 text-base leading-relaxed text-[rgba(240,239,235,0.55)]">
                  Sondar is the fix.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                {STATS.map((s) => (
                  <motion.div key={s.figure}
                    initial={{ opacity: 1, x: 16 }} whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, amount: 0.1 }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as const }}
                    className="glass p-5">
                    <p className="font-[family-name:var(--font-bebas)] text-[42px] leading-none tracking-wide text-[#FF5500]">
                      {s.figure}
                    </p>
                    <p className="mt-1 text-sm font-medium text-[rgba(240,239,235,0.75)]">{s.label}</p>
                    <p className="mt-1.5 text-[10px] text-[rgba(240,239,235,0.25)]">{s.note}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── European cities ────────────────────────────────────────────────── */}
        <section className="px-5 py-24 sm:py-32">
          <div className="mx-auto max-w-5xl">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-[rgba(240,239,235,0.3)]">
              Where we live
            </p>
            <h2 className="mb-10 leading-none tracking-[0.04em] text-[#F0EFEB]"
              style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(36px, 7vw, 64px)' }}>
              Every music city in Europe
            </h2>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-10 items-start">
              {/* Map */}
              <motion.div initial={{ opacity: 1, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.1 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] as const }}
                className="glass overflow-hidden p-1">
                <EuropeMap />
              </motion.div>

              {/* City list */}
              <motion.div initial={{ opacity: 1, x: 16 }} whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.1 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as const }}
                className="glass p-6">
                <p className="mb-4 text-[9px] tracking-[0.22em] text-[rgba(240,239,235,0.3)] uppercase">Active in</p>
                <div className="flex flex-wrap gap-2">
                  {CITIES.map((city) => (
                    <span key={city}
                      className="rounded-full border px-3 py-1 text-xs tracking-wide"
                      style={{
                        borderColor: 'rgba(240,239,235,0.12)',
                        color: 'rgba(240,239,235,0.55)',
                      }}>
                      {city}
                    </span>
                  ))}
                  <span className="rounded-full border border-dashed border-[rgba(240,239,235,0.12)] px-3 py-1 text-xs text-[rgba(240,239,235,0.3)]">
                    + more
                  </span>
                </div>
                <p className="mt-5 text-xs text-[rgba(240,239,235,0.35)]">
                  Wherever you are, your next bandmate is already on Sondar.
                </p>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── Final CTA ─────────────────────────────────────────────────────── */}
        <section className="relative flex flex-col items-center overflow-hidden px-5 py-32 text-center sm:py-40">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ width: 800, height: 600, background: 'radial-gradient(ellipse, rgba(255,92,0,0.12) 0%, rgba(255,92,0,0.04) 40%, transparent 65%)', borderRadius: '50%' }} />
            <div className="absolute bottom-0 right-0"
              style={{ width: 400, height: 400, background: 'radial-gradient(circle at 80% 80%, rgba(91,33,182,0.12) 0%, transparent 60%)', borderRadius: '50%' }} />
          </div>

          <motion.div initial={{ opacity: 1, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] as const }}
            className="relative z-10 flex flex-col items-center gap-7">
            <div className="flex items-center gap-3">
              <SondarSymbol size={36} />
              <span className="text-[42px] leading-none tracking-[0.12em] text-[#F0EFEB]"
                style={{ fontFamily: 'var(--font-bebas)' }}>SONDAR</span>
            </div>
            <h2 className="leading-[0.92] tracking-[0.03em] text-[#F0EFEB]"
              style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(48px, 10vw, 96px)', textShadow: '0 0 80px rgba(255,92,0,0.35)' }}>
              Ready to find<br />your people?
            </h2>
            <Link href="/login"
              className="flex items-center justify-center rounded-full bg-[#FF5500] px-10 py-4 text-lg font-semibold text-black shadow-[0_0_40px_rgba(255,85,0,0.5)] transition-opacity hover:opacity-90">
              Join Sondar — it&apos;s free
            </Link>
            <p className="text-[11px] font-medium tracking-[0.22em] uppercase text-[rgba(240,239,235,0.2)]">
              Free · No algorithm · Just music
            </p>
          </motion.div>
        </section>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <footer className="border-t border-[rgba(240,239,235,0.06)] px-5 py-8">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <span className="font-[family-name:var(--font-bebas)] text-lg tracking-[0.1em] text-[rgba(240,239,235,0.4)]">
              SONDAR
            </span>
            <div className="flex items-center gap-5 text-xs text-[rgba(240,239,235,0.3)]">
              <Link href="/login" className="hover:text-[rgba(240,239,235,0.6)] transition-colors">About</Link>
              <Link href="/login" className="hover:text-[rgba(240,239,235,0.6)] transition-colors">Privacy Policy</Link>
            </div>
            <div className="flex items-center gap-4">
              <a href="https://www.tiktok.com/@sondar_app?_r=1&_t=ZN-96PSe9Lbswg" target="_blank" rel="noopener noreferrer"
                className="flex flex-col items-center gap-1 transition-opacity hover:opacity-70"
                style={{ color: 'rgba(240,239,235,0.3)' }}>
                <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 22, height: 22 }}>
                  <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.3 6.3 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.93a8.18 8.18 0 004.78 1.52V7.01a4.85 4.85 0 01-1.01-.32z"/>
                </svg>
                <span style={{ fontSize: 10, letterSpacing: '0.06em' }}>TikTok</span>
              </a>
              <a href="https://www.instagram.com/sondarhq?igsh=MTNnbmhydW92NWgwYQ%3D%3D&utm_source=qr" target="_blank" rel="noopener noreferrer"
                className="flex flex-col items-center gap-1 transition-opacity hover:opacity-70"
                style={{ color: 'rgba(240,239,235,0.3)' }}>
                <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 22, height: 22 }}>
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                </svg>
                <span style={{ fontSize: 10, letterSpacing: '0.06em' }}>Instagram</span>
              </a>
            </div>
          </div>
          <p className="mt-4 text-center text-[10px] text-[rgba(240,239,235,0.15)] tracking-[0.1em]">
            Follow us — coming soon · © 2026 Sondar
          </p>
        </footer>

      </main>
    </>
  )
}
