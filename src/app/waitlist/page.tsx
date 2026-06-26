'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

function SondarSymbol({ size = 40 }: { size?: number }) {
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

const INSTRUMENTS = [
  { value: 'guitar',    label: 'Guitar' },
  { value: 'bass',      label: 'Bass' },
  { value: 'drums',     label: 'Drums' },
  { value: 'keys',      label: 'Keys' },
  { value: 'piano',     label: 'Piano' },
  { value: 'vocals',    label: 'Vocals' },
  { value: 'producer',  label: 'Producer' },
  { value: 'dj',        label: 'DJ' },
  { value: 'violin',    label: 'Violin' },
  { value: 'cello',     label: 'Cello' },
  { value: 'trumpet',   label: 'Trumpet' },
  { value: 'saxophone', label: 'Saxophone' },
  { value: 'flute',     label: 'Flute' },
  { value: 'other',     label: 'Other' },
]

export default function WaitlistPage() {
  const [email, setEmail] = useState('')
  const [city, setCity] = useState('')
  const [instruments, setInstruments] = useState<string[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  function toggleInstrument(value: string) {
    setInstruments(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('loading')
    setErrorMsg('')
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          city: city.trim() || null,
          instruments: instruments.length > 0 ? instruments : null,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setErrorMsg(json.error ?? 'Something went wrong.')
        setStatus('error')
      } else {
        setStatus('success')
      }
    } catch {
      setErrorMsg('Network error. Try again.')
      setStatus('error')
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#0D0D0D',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 20px',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: 'var(--font-dm-sans)',
      color: '#F0EFEB',
    }}>
      {/* Ambient orbs */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute', right: '-10%', top: '-10%',
          width: 600, height: 600,
          background: 'radial-gradient(circle at 65% 30%, rgba(255,85,0,0.20) 0%, rgba(255,85,0,0.06) 40%, transparent 65%)',
          borderRadius: '50%',
        }} />
        <div style={{
          position: 'absolute', left: '-10%', bottom: '-10%',
          width: 500, height: 500,
          background: 'radial-gradient(circle at 30% 70%, rgba(91,33,182,0.16) 0%, rgba(91,33,182,0.05) 40%, transparent 65%)',
          borderRadius: '50%',
        }} />
      </div>

      <AnimatePresence mode="wait">
        {status === 'success' ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            style={{ textAlign: 'center', maxWidth: 480 }}
          >
            <div style={{ marginBottom: 28 }}>
              <SondarSymbol size={52} />
            </div>
            <h1 style={{
              fontFamily: 'var(--font-bebas)',
              fontSize: 'clamp(52px, 12vw, 88px)',
              lineHeight: 0.9,
              letterSpacing: '0.04em',
              color: '#F0EFEB',
              textShadow: '0 0 80px rgba(255,85,0,0.5), 0 0 200px rgba(255,85,0,0.2)',
              marginBottom: 20,
            }}>
              YOU&apos;RE ON<br />THE LIST.
            </h1>
            <p style={{ fontSize: 15, color: 'rgba(240,239,235,0.45)', lineHeight: 1.65, marginBottom: 36 }}>
              We&apos;ll let you know when Sondar opens in your city.<br />
              Get ready to make some noise.
            </p>
            <Link href="/" style={{
              fontSize: 11,
              letterSpacing: '0.18em',
              color: 'rgba(240,239,235,0.28)',
              textDecoration: 'none',
            }}>
              ← BACK TO HOME
            </Link>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            style={{ width: '100%', maxWidth: 440, textAlign: 'center' }}
          >
            {/* Logo */}
            <div style={{ marginBottom: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <SondarSymbol size={40} />
              <span style={{
                fontFamily: 'var(--font-bebas)',
                fontSize: 26,
                letterSpacing: '0.14em',
                color: 'rgba(240,239,235,0.55)',
              }}>SONDAR</span>
            </div>

            {/* Badge */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              borderRadius: 99,
              border: '1px solid rgba(255,85,0,0.25)',
              background: 'rgba(255,85,0,0.08)',
              padding: '6px 16px',
              marginBottom: 24,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: '#FF5500', boxShadow: '0 0 6px rgba(255,85,0,0.8)',
              }} />
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.2em', color: 'rgba(255,85,0,0.85)' }}>
                EARLY ACCESS
              </span>
            </div>

            {/* Headline */}
            <h1 style={{
              fontFamily: 'var(--font-bebas)',
              fontSize: 'clamp(30px, 8vw, 72px)',
              lineHeight: 0.92,
              letterSpacing: '0.03em',
              color: '#F0EFEB',
              textShadow: '0 0 100px rgba(255,92,0,0.4), 0 0 260px rgba(255,92,0,0.15)',
              marginBottom: 16,
            }}>
              Get early access<br />and exclusive perks.
            </h1>

            <p style={{ fontSize: 14, color: 'rgba(240,239,235,0.42)', lineHeight: 1.7, marginBottom: 36 }}>
              Sondar is launching soon. Join the waitlist and be the first<br />
              to know when we open in your city.
            </p>

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="email"
                required
                placeholder="Your email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '14px 18px',
                  borderRadius: 12,
                  border: '1px solid rgba(240,239,235,0.12)',
                  background: 'rgba(240,239,235,0.05)',
                  color: '#F0EFEB',
                  fontSize: 15,
                  fontFamily: 'var(--font-dm-sans)',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(255,85,0,0.45)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(240,239,235,0.12)' }}
              />
              <input
                type="text"
                placeholder="Your city (optional)"
                value={city}
                onChange={e => setCity(e.target.value)}
                style={{
                  width: '100%',
                  padding: '14px 18px',
                  borderRadius: 12,
                  border: '1px solid rgba(240,239,235,0.12)',
                  background: 'rgba(240,239,235,0.05)',
                  color: '#F0EFEB',
                  fontSize: 15,
                  fontFamily: 'var(--font-dm-sans)',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(255,85,0,0.25)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(240,239,235,0.12)' }}
              />

              {/* Instrument chips */}
              <div style={{ textAlign: 'left' }}>
                <p style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.18em',
                  color: 'rgba(240,239,235,0.3)',
                  marginBottom: 10,
                  marginTop: 4,
                }}>
                  WHAT DO YOU PLAY? <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span>
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {INSTRUMENTS.map(({ value, label }) => {
                    const selected = instruments.includes(value)
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => toggleInstrument(value)}
                        style={{
                          padding: '7px 14px',
                          borderRadius: 99,
                          border: selected
                            ? '1px solid #FF5500'
                            : '1px solid rgba(240,239,235,0.12)',
                          background: selected
                            ? 'rgba(255,85,0,0.15)'
                            : 'rgba(240,239,235,0.04)',
                          color: selected ? '#FF5500' : 'rgba(240,239,235,0.5)',
                          fontSize: 12,
                          fontWeight: selected ? 600 : 400,
                          letterSpacing: '0.04em',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          fontFamily: 'var(--font-dm-sans)',
                        }}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {status === 'error' && (
                <p style={{ fontSize: 13, color: '#FF5500', textAlign: 'left', margin: '0 2px' }}>
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={status === 'loading'}
                style={{
                  marginTop: 4,
                  padding: '15px 24px',
                  borderRadius: 99,
                  background: '#FF5500',
                  color: '#000',
                  fontWeight: 700,
                  fontSize: 15,
                  letterSpacing: '0.03em',
                  border: 'none',
                  cursor: status === 'loading' ? 'not-allowed' : 'pointer',
                  opacity: status === 'loading' ? 0.65 : 1,
                  boxShadow: '0 0 40px rgba(255,85,0,0.45)',
                  transition: 'opacity 0.2s',
                  fontFamily: 'var(--font-dm-sans)',
                }}
              >
                {status === 'loading' ? 'Joining…' : 'Join the waitlist'}
              </button>
            </form>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
