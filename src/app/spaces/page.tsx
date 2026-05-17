'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import dynamic from 'next/dynamic'
import BottomNav from '@/components/ui/BottomNav'
import type { SpacePin } from '@/components/map/SpacesMap'

const SpacesMap = dynamic(() => import('@/components/map/SpacesMap'), { ssr: false })

interface Space {
  name: string
  neighborhood: string
  city: 'Madrid' | 'Berlin'
  price: string
  instruments: string[]
  description: string
  website: string
  lat: number
  lng: number
}

const SPACES: Space[] = [
  {
    name: 'Rockschool Madrid',
    neighborhood: 'Malasaña',
    city: 'Madrid',
    price: 'from €5/hr',
    instruments: ['guitar', 'drums', 'bass', 'keys'],
    description: 'Fully equipped rehearsal rooms in the heart of Malasaña. PA, backline, and great acoustics. Hourly and monthly rates available.',
    website: 'https://rockschoolmadrid.com',
    lat: 40.4248, lng: -3.7014,
  },
  {
    name: 'Sala de Ensayo Lavapiés',
    neighborhood: 'Lavapiés',
    city: 'Madrid',
    price: 'from €8/hr',
    instruments: ['drums', 'bass', 'guitar', 'vocals'],
    description: 'Community-driven rehearsal space in Lavapiés. Five rooms, pro-grade drum kits, and a recording booth on request.',
    website: 'https://salaensayo.es',
    lat: 40.4079, lng: -3.7043,
  },
  {
    name: 'StudiOne Madrid',
    neighborhood: 'Chamberí',
    city: 'Madrid',
    price: 'from €6/hr',
    instruments: ['keys', 'guitar', 'vocals', 'producer'],
    description: 'Modern studios in Chamberí with top-of-the-line soundproofing. Perfect for bands and solo artists alike. Flexible booking.',
    website: 'https://studione.es',
    lat: 40.4352, lng: -3.7097,
  },
  {
    name: 'Pirate Studios Berlin',
    neighborhood: 'Tempelhof',
    city: 'Berlin',
    price: 'from €8/hr',
    instruments: ['drums', 'guitar', 'bass', 'dj'],
    description: '24/7 self-service studios at Tempelhof. Book via app, walk in any hour. All rooms include backline — no setup time wasted.',
    website: 'https://piratestudios.com',
    lat: 52.4703, lng: 13.3976,
  },
  {
    name: 'noisy at RAW',
    neighborhood: 'Friedrichshain',
    city: 'Berlin',
    price: 'from €7/hr',
    instruments: ['drums', 'bass', 'guitar', 'producer'],
    description: 'Underground rehearsal complex inside the legendary RAW Gelände. Raw industrial vibes, professional sound. Bands only.',
    website: 'https://noisyraw.de',
    lat: 52.5123, lng: 13.4539,
  },
  {
    name: 'Proberaum Berlin',
    neighborhood: 'Mitte',
    city: 'Berlin',
    price: 'from €6/hr',
    instruments: ['guitar', 'bass', 'keys', 'drums'],
    description: 'Central Berlin location in Mitte. Eight rehearsal rooms, professional PA, climate control. Monthly storage included.',
    website: 'https://proberaum-berlin.de',
    lat: 52.5192, lng: 13.3986,
  },
]

const INSTRUMENT_EMOJI: Record<string, string> = {
  guitar: '🎸', bass: '🎸', drums: '🥁', keys: '🎹', piano: '🎹',
  violin: '🎻', cello: '🎻', trumpet: '🎺', saxophone: '🎷', flute: '🪈',
  vocals: '🎤', producer: '🎚️', dj: '🎧', other: '🎵',
}

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.35, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] as const },
  }),
}

export default function SpacesPage() {
  const router = useRouter()
  const [city, setCity] = useState<'Madrid' | 'Berlin' | 'All'>('All')

  const filtered = city === 'All' ? SPACES : SPACES.filter(s => s.city === city)

  const mapPins: SpacePin[] = filtered.map(s => ({
    name: s.name,
    neighborhood: s.neighborhood,
    city: s.city,
    price: s.price,
    lat: s.lat,
    lng: s.lng,
  }))

  return (
    <div style={{ minHeight: '100dvh', background: '#0D0D0D' }}>

      {/* Header */}
      <div
        className="sticky top-0 z-10 px-4 py-4"
        style={{
          background: 'rgba(13,13,13,0.92)',
          backdropFilter: 'blur(48px) saturate(180%)',
          WebkitBackdropFilter: 'blur(48px) saturate(180%)',
          borderBottom: '0.5px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="mx-auto max-w-lg">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="flex h-8 w-8 items-center justify-center rounded-full"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
              aria-label="Go back"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 14, height: 14, color: 'rgba(240,239,235,0.6)' }}>
                <path fillRule="evenodd" clipRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" />
              </svg>
            </button>
            <div>
              <h1
                className="text-[#F0EFEB]"
                style={{ fontFamily: 'var(--font-bebas)', fontSize: 28, letterSpacing: '0.08em' }}
              >
                REHEARSAL SPACES
              </h1>
              <p className="text-[11px] text-[rgba(240,239,235,0.3)]">{filtered.length} spaces available</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 pt-4 pb-24">

        {/* City filter */}
        <div className="mb-4 flex gap-2">
          {(['All', 'Madrid', 'Berlin'] as const).map(c => (
            <button
              key={c}
              onClick={() => setCity(c)}
              style={{
                padding: '6px 16px',
                borderRadius: 99,
                fontSize: 13,
                fontWeight: city === c ? 600 : 400,
                color: city === c ? '#FF5500' : 'rgba(240,239,235,0.45)',
                background: city === c ? 'rgba(255,85,0,0.12)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${city === c ? 'rgba(255,85,0,0.3)' : 'rgba(255,255,255,0.08)'}`,
                transition: 'all 0.15s ease',
              }}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Map */}
        <div className="mb-5">
          <SpacesMap spaces={mapPins} centerCity={city} />
        </div>

        {/* Space cards */}
        <div className="flex flex-col gap-3">
          {filtered.map((space, i) => (
            <motion.div
              key={space.name}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              style={{
                borderRadius: 16,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                overflow: 'hidden',
              }}
            >
              {/* Card header */}
              <div style={{ padding: '14px 16px 10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <p
                      style={{
                        fontFamily: 'var(--font-bebas)',
                        fontSize: 20,
                        letterSpacing: '0.06em',
                        color: '#F0EFEB',
                        lineHeight: 1.1,
                      }}
                    >
                      {space.name}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <span style={{
                        fontSize: 11, color: 'rgba(240,239,235,0.5)',
                        background: 'rgba(255,255,255,0.06)',
                        padding: '1px 8px', borderRadius: 99,
                      }}>
                        {space.neighborhood}
                      </span>
                      <span style={{ fontSize: 11, color: 'rgba(240,239,235,0.3)' }}>
                        · {space.city}
                      </span>
                    </div>
                  </div>
                  <span style={{
                    fontSize: 13, fontWeight: 700, color: '#FF5500',
                    background: 'rgba(255,85,0,0.10)',
                    padding: '4px 10px', borderRadius: 99, flexShrink: 0,
                  }}>
                    {space.price}
                  </span>
                </div>

                <p style={{ fontSize: 13, color: 'rgba(240,239,235,0.45)', lineHeight: 1.5, marginBottom: 10 }}>
                  {space.description}
                </p>

                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
                  {space.instruments.map(inst => (
                    <span
                      key={inst}
                      style={{
                        fontSize: 11, color: 'rgba(240,239,235,0.5)',
                        background: 'rgba(255,255,255,0.06)',
                        padding: '2px 8px', borderRadius: 99,
                      }}
                    >
                      {INSTRUMENT_EMOJI[inst] ?? '🎵'} {inst}
                    </span>
                  ))}
                </div>
              </div>

              {/* Card footer */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '10px 16px' }}>
                <a
                  href={space.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: 12, fontWeight: 600, color: '#FF5500',
                    textDecoration: 'none',
                  }}
                >
                  Visit website
                  <svg viewBox="0 0 12 12" fill="none" style={{ width: 10, height: 10 }}>
                    <path d="M2 10L10 2M10 2H4M10 2V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
