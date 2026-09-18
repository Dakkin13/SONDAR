'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const NAV_LINKS = [
  { label: 'About',         href: '/about' },
  { label: 'For Musicians', href: '/musicians' },
  { label: 'Events',        href: '/events' },
]

const TK_PATH = 'M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.3 6.3 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.93a8.18 8.18 0 004.78 1.52V7.01a4.85 4.85 0 01-1.01-.32z'
const IG_PATH = 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z'

export default function MarketingNav({ alwaysScrolled = false }: { alwaysScrolled?: boolean }) {
  const [scrolledPastThreshold, setScrolledPastThreshold] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  // Derived rather than mirrored into state via an effect — alwaysScrolled
  // wins outright, otherwise it tracks actual scroll position.
  const scrolled = alwaysScrolled || scrolledPastThreshold

  useEffect(() => {
    if (alwaysScrolled) return
    const onScroll = () => setScrolledPastThreshold(window.scrollY > 60)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [alwaysScrolled])

  return (
    <>
      {/*
        Use custom class names + !important to bypass any Tailwind conflicts.
        .sdr-ham   → visible on mobile, hidden on desktop
        .sdr-soc   → hidden on mobile, visible on desktop
        .sdr-nav   → hidden on mobile, visible on desktop
      */}
      <style>{`
        .sdr-ham { display: flex !important; }
        .sdr-soc { display: none !important; }
        .sdr-nav { display: none !important; }
        @media (min-width: 640px) {
          .sdr-ham { display: none !important; }
          .sdr-soc { display: flex !important; }
          .sdr-nav { display: flex !important; }
        }
      `}</style>

      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        height: 60,
        background: scrolled ? 'rgba(13,13,13,0.88)' : 'transparent',
        backdropFilter: scrolled ? 'blur(48px) saturate(180%)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(48px) saturate(180%)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.10)' : '1px solid transparent',
        transition: 'background 0.3s, border-color 0.3s',
      }}>

        {/* SONDAR — hard-pinned left via absolute, never moves */}
        <Link href="/" style={{
          position: 'absolute', left: 20, top: 0, bottom: 0,
          display: 'flex', alignItems: 'center',
          fontFamily: 'var(--font-bebas)', fontSize: 22, letterSpacing: '0.1em', color: '#F0EFEB',
        }}>SONDAR</Link>

        {/* Desktop centre nav — absolutely centred, does NOT affect layout */}
        <nav className="sdr-nav" style={{
          position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
          justifyContent: 'center', alignItems: 'center', gap: 24,
          pointerEvents: 'none',
        }}>
          {NAV_LINKS.map(l => (
            <Link key={l.href} href={l.href}
              style={{ fontSize: 14, color: 'rgba(240,239,235,0.65)', pointerEvents: 'auto' }}>
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Right controls — hard-pinned right via absolute, never moves */}
        <div style={{
          position: 'absolute', right: 16, top: 0, bottom: 0,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>

          {/* Hamburger — CSS shows on mobile, hides on desktop */}
          <button type="button" className="sdr-ham"
            onClick={() => setMenuOpen(o => !o)}
            onTouchEnd={(e) => { e.preventDefault(); setMenuOpen(o => !o) }}
            aria-label="Toggle menu"
            style={{
              alignItems: 'center', justifyContent: 'center',
              width: 44, height: 44, borderRadius: 8,
              border: '1px solid rgba(240,239,235,0.12)', background: 'rgba(255,255,255,0.04)',
              cursor: 'pointer', color: 'rgba(240,239,235,0.65)',
              touchAction: 'manipulation', padding: 0,
            }}>
            <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 16, height: 16 }}>
              {menuOpen
                ? <path fillRule="evenodd" clipRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
                : <path fillRule="evenodd" clipRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />}
            </svg>
          </button>

          {/* Social icons — CSS hides on mobile, shows on desktop */}
          <div className="sdr-soc" style={{ alignItems: 'center', gap: 4 }}>
            <a href="https://www.tiktok.com/@sondar_app?_r=1&_t=ZN-96PSe9Lbswg" target="_blank" rel="noopener noreferrer" aria-label="TikTok"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '50%', color: 'rgba(240,239,235,0.55)' }}>
              <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 20, height: 20 }}><path d={TK_PATH} /></svg>
            </a>
            <a href="https://www.instagram.com/sondarhq?igsh=MTNnbmhydW92NWgwYQ%3D%3D&utm_source=qr" target="_blank" rel="noopener noreferrer" aria-label="Instagram"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '50%', color: 'rgba(240,239,235,0.55)' }}>
              <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 20, height: 20 }}><path d={IG_PATH} /></svg>
            </a>
          </div>

          {/* Join — always visible */}
          <Link href="/login" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            borderRadius: 999, background: '#FF5500', padding: '8px 16px',
            fontSize: 13, fontWeight: 600, color: 'black',
            boxShadow: '0 0 16px rgba(255,85,0,0.35)',
            WebkitTapHighlightColor: 'transparent',
          }}>Join →</Link>
        </div>

        {/* Mobile dropdown — position:fixed so it escapes any overflow:clip ancestor */}
        {menuOpen && (
          <div className="glass-apple" style={{
            position: 'fixed', top: 60, left: 16, right: 16, zIndex: 100,
            borderRadius: 16, padding: '8px 0',
          }}>
            {NAV_LINKS.map(l => (
              <a key={l.href} href={l.href}
                onTouchEnd={(e) => { e.preventDefault(); setMenuOpen(false); window.location.href = l.href }}
                style={{ display: 'block', padding: '16px 20px', fontSize: 15, color: 'rgba(240,239,235,0.8)', touchAction: 'manipulation', textDecoration: 'none' }}>
                {l.label}
              </a>
            ))}
            <div style={{ margin: '4px 20px 0', borderTop: '1px solid rgba(240,239,235,0.06)', paddingTop: 12, paddingBottom: 4, display: 'flex', gap: 16 }}>
              <a href="https://www.tiktok.com/@sondar_app?_r=1&_t=ZN-96PSe9Lbswg" target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(240,239,235,0.45)' }}>
                <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 14, height: 14 }}><path d={TK_PATH} /></svg>
                TikTok
              </a>
              <a href="https://www.instagram.com/sondarhq?igsh=MTNnbmhydW92NWgwYQ%3D%3D&utm_source=qr" target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(240,239,235,0.45)' }}>
                <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 14, height: 14 }}><path d={IG_PATH} /></svg>
                Instagram
              </a>
            </div>
          </div>
        )}
      </header>
    </>
  )
}
