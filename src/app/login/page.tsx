'use client'

import { Suspense, useState } from 'react'
import { motion } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden>
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335" />
    </svg>
  )
}

// ─── Sondar symbol ─────────────────────────────────────────────────────────────

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
      <text x="10" y="17" fill="rgba(240,239,235,0.28)" fontSize="6.5" fontFamily="monospace">52.520° N · 13.405° E</text>
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

// ─── Page ─────────────────────────────────────────────────────────────────────

const STEPS = [
  { num: '01', tag: 'PROFILE',   label: 'Create your profile',       sub: "Set your instruments, genres, and what you're looking for.", Icon: ProfileModuleIcon  },
  { num: '02', tag: 'PROXIMITY', label: 'Find musicians near you',    sub: "Drop the pin. See who's within walking distance.",           Icon: ProximityModuleIcon },
  { num: '03', tag: 'RESONANCE', label: 'Make some noise',            sub: 'Two signals meet. A band is born.',                          Icon: ResonanceModuleIcon },
]

const heroStagger = { hidden: {}, show: { transition: { staggerChildren: 0.12 } } }
const heroFadeUp  = { hidden: { opacity: 0, y: 28 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const } } }

const inputCls = 'w-full rounded-xl border border-[rgba(240,239,235,0.1)] bg-[rgba(240,239,235,0.06)] px-4 py-2.5 text-sm text-[#F0EFEB] placeholder-[rgba(240,239,235,0.3)] outline-none focus:border-[rgba(255,85,0,0.4)] transition-colors'

function LoginContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [isSignUp,    setIsSignUp]    = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError,   setAuthError]   = useState<string | null>(
    searchParams.get('error'),  // surfaces errors forwarded by /api/auth/google
  )
  const [signUpSent,  setSignUpSent]  = useState(false)
  // Google sign-in is handled entirely server-side via /api/auth/google.
  // Those buttons are plain <a> links — no JS click handler needed.

  async function handleEmailAuth() {
    if (!email || !password) return
    setAuthLoading(true)
    setAuthError(null)

    const supabase = createClient()

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      setAuthLoading(false)
      if (error) { setAuthError(error.message); return }
      setSignUpSent(true)
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setAuthError(
        error.message.includes('Invalid login') ? 'Wrong email or password.' :
        error.message.includes('Email not confirmed') ? 'Please confirm your email first.' :
        error.message,
      )
      setAuthLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setAuthError('Something went wrong. Try again.'); setAuthLoading(false); return }

    const { data: profile } = await supabase
      .from('profiles').select('is_onboarded').eq('id', user.id).single()

    router.push(profile?.is_onboarded ? '/home' : '/onboarding')
  }

  return (
    <>
      <main className="relative text-[#F0EFEB]" style={{ zIndex: 1, fontFamily: 'var(--font-dm-sans)' }}>

        {/* ── Hero ── */}
        <section className="relative flex flex-col items-center justify-center px-6" style={{ minHeight: '100dvh', zIndex: 1 }}>

          {/* Title — motion only, no interactive elements */}
          <div className="flex w-full flex-col items-center gap-5 text-center">
            <h1 className="whitespace-nowrap leading-none tracking-[0.05em] text-[#F0EFEB]"
              style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(52px, 15vw, 140px)', textShadow: '0 0 80px rgba(255,92,0,0.6), 0 0 240px rgba(255,92,0,0.2)' }}>
              SONDAR
            </h1>
            <p className="uppercase text-[rgba(240,239,235,0.45)]"
              style={{ fontSize: 'clamp(11px, 3vw, 16px)', letterSpacing: '0.15em' }}>
              FIND YOUR PEOPLE. MAKE NOISE.
            </p>

            {/* Auth card — plain div, no framer-motion so iOS pointer events work */}
            <div className="mt-2 w-full max-w-[320px]">
              <div className="glass flex flex-col items-center gap-3 p-6">

                {signUpSent ? (
                  <div className="text-center">
                    <p className="text-sm font-medium text-[#F0EFEB]">Check your email</p>
                    <p className="mt-1 text-xs text-[rgba(240,239,235,0.5)]">
                      We sent a confirmation link to <span className="text-[#FF5500]">{email}</span>
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Google — plain <a>, works on all iOS versions */}
                    <a
                      href="/api/auth/google"
                      className="flex w-full items-center justify-center gap-3 rounded-full bg-[#FF5C00] font-semibold text-black shadow-[0_0_28px_rgba(255,92,0,0.45)] transition-opacity hover:opacity-90 active:opacity-80"
                      style={{ height: 52, fontSize: 16, WebkitTapHighlightColor: 'transparent', textDecoration: 'none' }}
                    >
                      <GoogleIcon />
                      Continue with Google
                    </a>

                    {/* Divider */}
                    <div className="flex w-full items-center gap-2">
                      <div className="h-px flex-1 bg-[rgba(240,239,235,0.1)]" />
                      <span className="text-[11px] text-[rgba(240,239,235,0.3)]">or</span>
                      <div className="h-px flex-1 bg-[rgba(240,239,235,0.1)]" />
                    </div>

                    {/* Email form — native form submit works on all iOS versions */}
                    <form
                      onSubmit={(e) => { e.preventDefault(); void handleEmailAuth() }}
                      className="flex w-full flex-col gap-3"
                    >
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                        placeholder="Email" className={inputCls} autoComplete="email" />
                      <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                        placeholder="Password" className={inputCls} autoComplete="current-password" />

                      {authError && (
                        <p className="w-full text-center text-xs text-red-400">{authError}</p>
                      )}

                      <button
                        type="submit"
                        disabled={authLoading || !email || !password}
                        className="flex w-full items-center justify-center rounded-full border border-[rgba(240,239,235,0.15)] bg-[rgba(240,239,235,0.07)] font-medium text-[#F0EFEB] transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-40"
                        style={{ height: 48, fontSize: 15 }}
                      >
                        {authLoading ? 'Loading…' : isSignUp ? 'Create account' : 'Sign in'}
                      </button>
                    </form>

                    <button
                      type="button"
                      onClick={() => { setIsSignUp(s => !s); setAuthError(null) }}
                      className="text-xs text-[rgba(240,239,235,0.35)] hover:text-[rgba(240,239,235,0.65)] transition-colors"
                    >
                      {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                    </button>
                  </>
                )}

                <p style={{ fontSize: 11, opacity: 0.4, marginTop: 2 }}>
                  Free · No algorithm · Just music
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Desktop-only sections ── */}
        <div className="hidden md:block">

          {/* How it works */}
          <section className="px-4 py-28">
            <div className="mx-auto max-w-5xl">
              <motion.p initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.5 }}
                className="mb-12 text-[10px] tracking-[0.28em] uppercase text-[rgba(240,239,235,0.3)]">
                How it works
              </motion.p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {STEPS.map((step, i) => (
                  <motion.div key={step.num}
                    initial={{ opacity: 0, y: 36 }} whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-40px' }}
                    transition={{ duration: 0.6, delay: i * 0.13, ease: [0.16, 1, 0.3, 1] as const }}>
                    <div className="glass flex flex-col gap-4 p-5">
                      <div className="flex items-center justify-between text-[9px] tracking-[0.22em] text-[rgba(240,239,235,0.28)]">
                        <span>{step.num} / {step.tag}</span>
                        <div className="flex gap-1">
                          <span className="h-1 w-1 rounded-full bg-[#FF5C00]" />
                          <span className="h-1 w-1 rounded-full bg-[rgba(240,239,235,0.18)]" />
                          <span className="h-1 w-1 rounded-full bg-[rgba(240,239,235,0.18)]" />
                        </div>
                      </div>
                      <div className="flex justify-center py-1"><step.Icon /></div>
                      <div className="border-t border-[rgba(240,239,235,0.06)] pt-3">
                        <p className="mb-1 text-[10px] font-semibold tracking-[0.14em] uppercase text-[rgba(240,239,235,0.7)]">{step.label}</p>
                        <p className="text-[11px] text-[rgba(240,239,235,0.4)]">{step.sub}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* Profile card showcase */}
          <section className="flex flex-col items-center px-4 py-24">
            <motion.p initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ duration: 0.4 }}
              className="mb-12 text-[10px] tracking-[0.28em] uppercase text-[rgba(240,239,235,0.3)]">
              Your profile
            </motion.p>
            <motion.div initial={{ opacity: 0, scale: 0.93 }} whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] as const }}>
              <ProfileShowcaseCard />
            </motion.div>
            <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
              viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-8 text-center text-xs text-[rgba(240,239,235,0.3)]">
              Not the app screen — a backstage pass.
            </motion.p>
          </section>

          {/* City map */}
          <section className="px-4 py-20">
            <div className="mx-auto max-w-2xl">
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] as const }}
                className="glass overflow-hidden p-1">
                <CityMap />
              </motion.div>
              <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
                viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.25 }}
                className="mt-6 text-center text-sm text-[rgba(240,239,235,0.38)]">
                Your city is full of musicians. Find them.
              </motion.p>
            </div>
          </section>

          {/* CTA footer */}
          <section className="relative flex flex-col items-center overflow-hidden px-4 py-32">
            <div aria-hidden className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2">
              <div className="h-[360px] w-[560px] rounded-full bg-[#FF5C00] opacity-[0.07] blur-[110px]" />
            </div>
            <div className="relative z-10 flex flex-col items-center gap-6 text-center">
              <div className="flex items-center gap-3">
                <SondarSymbol size={36} />
                <span className="text-[42px] leading-none tracking-[0.12em] text-[#F0EFEB]"
                  style={{ fontFamily: 'var(--font-bebas)' }}>SONDAR</span>
              </div>
              <p className="text-[rgba(240,239,235,0.45)]">Ready to find your people?</p>
              <a href="/api/auth/google"
                style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation', textDecoration: 'none' }}
                className="flex w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-[#FF5C00] px-8 py-4 text-sm font-semibold text-black shadow-[0_0_40px_rgba(255,92,0,0.4)] transition-opacity hover:opacity-90 sm:w-auto">
                <GoogleIcon />
                Get started with Google
              </a>
              <p className="text-[10px] tracking-[0.25em] uppercase text-[rgba(240,239,235,0.18)]">
                Sound · Est. Berlin 26
              </p>
            </div>
          </section>

        </div>
      </main>
    </>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center" style={{ minHeight: '100dvh', background: '#0D0D0D' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[rgba(240,239,235,0.12)] border-t-[#FF5500]" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
