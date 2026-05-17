'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

interface SpaceDetail {
  name: string
  neighborhood: string
  city: string
  price: string
  lat: number
  lng: number
  description: string
  hours: string
  capacity: string
  tags: string[]
}

const SPACES: SpaceDetail[] = [
  {
    name: 'Rockschool Madrid',
    neighborhood: 'Malasaña',
    city: 'Madrid',
    price: 'from €5/hr',
    lat: 40.4248,
    lng: -3.7014,
    description: 'Professional rehearsal rooms fully equipped with backline. Well-maintained gear in the heart of Malasaña — Madrid\'s most musical neighbourhood.',
    hours: 'Mon–Sun · 10:00–02:00',
    capacity: 'Up to 6 musicians',
    tags: ['Backline included', 'Air conditioned', 'Central'],
  },
  {
    name: 'Sala de Ensayo Lavapiés',
    neighborhood: 'Lavapiés',
    city: 'Madrid',
    price: 'from €8/hr',
    lat: 40.4079,
    lng: -3.7043,
    description: 'Creative rehearsal space in bohemian Lavapiés. Great acoustics, natural light, and a community of artists right at the door.',
    hours: 'Mon–Sat · 09:00–22:00',
    capacity: 'Up to 4 musicians',
    tags: ['PA system', 'Acoustic treatment', 'Café nearby'],
  },
  {
    name: 'StudiOne Madrid',
    neighborhood: 'Chamberí',
    city: 'Madrid',
    price: 'from €6/hr',
    lat: 40.4352,
    lng: -3.7097,
    description: 'Modern rehearsal studio with recording capabilities. Chamberí\'s go-to space for bands looking to track a demo while they rehearse.',
    hours: 'Mon–Sun · 08:00–24:00',
    capacity: 'Up to 8 musicians',
    tags: ['Recording booth', 'Grand piano', 'Parking'],
  },
  {
    name: 'Pirate Studios Berlin',
    neighborhood: 'Tempelhof',
    city: 'Berlin',
    price: 'from €8/hr',
    lat: 52.4703,
    lng: 13.3976,
    description: 'Self-service 24/7 rehearsal studios — book, enter, play. Pirate\'s smart-lock system lets you access gear any time with no staff required.',
    hours: '24 / 7',
    capacity: 'Up to 5 musicians',
    tags: ['24 / 7 access', 'Self-service', 'App booking'],
  },
  {
    name: 'noisy at RAW',
    neighborhood: 'Friedrichshain',
    city: 'Berlin',
    price: 'from €7/hr',
    lat: 52.5123,
    lng: 13.4539,
    description: 'Underground rehearsal space at the iconic RAW complex. Surrounded by clubs and creative studios — the most Berlin vibe you\'ll find.',
    hours: 'Mon–Sun · 12:00–04:00',
    capacity: 'Up to 6 musicians',
    tags: ['Underground feel', 'RAW complex', 'Night-friendly'],
  },
  {
    name: 'Proberaum Berlin',
    neighborhood: 'Mitte',
    city: 'Berlin',
    price: 'from €6/hr',
    lat: 52.5192,
    lng: 13.3986,
    description: 'Central rehearsal space right in Mitte. Easy to reach from anywhere in the city, with all the gear you need to get straight into it.',
    hours: 'Mon–Fri · 10:00–22:00 · Sat–Sun · 10:00–20:00',
    capacity: 'Up to 5 musicians',
    tags: ['Central location', 'U-Bahn 2 min', 'Clean gear'],
  },
]

type City = 'All' | 'Madrid' | 'Berlin'

const CITY_CENTERS: Record<'Madrid' | 'Berlin', { center: [number, number]; zoom: number }> = {
  Madrid: { center: [-3.7038, 40.4168], zoom: 12.5 },
  Berlin: { center: [13.4050, 52.5200], zoom: 11.5 },
}

function createMarkerEl(space: SpaceDetail, onClick: () => void): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.style.cssText = 'display:flex;flex-direction:column;align-items:center;cursor:pointer'

  const dot = document.createElement('div')
  dot.style.cssText = [
    'width:16px;height:16px;border-radius:50%',
    'background:#FF5500',
    'border:2.5px solid rgba(255,255,255,0.9)',
    'box-shadow:0 0 14px rgba(255,85,0,0.9)',
    'position:relative',
    'transition:transform 0.15s ease',
  ].join(';')

  const ring = document.createElement('div')
  ring.style.cssText = [
    'position:absolute;inset:-6px;border-radius:50%',
    'border:1.5px solid rgba(255,85,0,0.4)',
    'animation:sondar-ping 2.5s ease-out infinite',
  ].join(';')
  dot.appendChild(ring)

  const label = document.createElement('div')
  label.style.cssText = [
    'margin-top:4px;padding:3px 7px;border-radius:5px',
    'background:rgba(13,13,13,0.92);border:1px solid rgba(255,85,0,0.3)',
    'font-size:9px;font-weight:700;letter-spacing:0.08em',
    'color:#F0EFEB;white-space:nowrap',
    'backdrop-filter:blur(8px)',
  ].join(';')
  label.textContent = space.name

  wrapper.appendChild(dot)
  wrapper.appendChild(label)

  wrapper.addEventListener('mouseenter', () => { dot.style.transform = 'scale(1.2)' })
  wrapper.addEventListener('mouseleave', () => { dot.style.transform = '' })
  wrapper.addEventListener('click', onClick)

  return wrapper
}

export default function SpacesMapPage() {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)

  const [city, setCity] = useState<City>('All')
  const [selected, setSelected] = useState<SpaceDetail | null>(null)

  const visibleSpaces = city === 'All' ? SPACES : SPACES.filter(s => s.city === city)

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    mapboxgl.accessToken = TOKEN

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [5.0, 48.0],
      zoom: 4,
      attributionControl: false,
      logoPosition: 'bottom-right',
    })
    mapRef.current = map

    map.on('load', () => {
      SPACES.forEach(space => {
        const el = createMarkerEl(space, () => setSelected(space))
        new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([space.lng, space.lat])
          .addTo(map)
      })
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fly when city filter changes
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (city === 'All') {
      map.flyTo({ center: [5.0, 48.0], zoom: 4, duration: 900 })
    } else {
      const { center, zoom } = CITY_CENTERS[city]
      map.flyTo({ center, zoom, duration: 900 })
    }
  }, [city])

  // Fly to selected space
  useEffect(() => {
    if (!selected || !mapRef.current) return
    mapRef.current.flyTo({ center: [selected.lng, selected.lat], zoom: 14, duration: 600 })
  }, [selected])

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0D0D0D', zIndex: 50 }}>
      {/* Full-screen map */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Top bar — back + city filters */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'linear-gradient(to bottom, rgba(13,13,13,0.80) 0%, transparent 100%)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}>
        {/* Back */}
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(13,13,13,0.75)', border: '1px solid rgba(255,255,255,0.12)',
            color: '#F0EFEB', cursor: 'pointer', flexShrink: 0,
          }}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 16, height: 16 }}>
            <path fillRule="evenodd" clipRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" />
          </svg>
        </button>

        {/* City pills */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['All', 'Madrid', 'Berlin'] as City[]).map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setCity(c)}
              style={{
                padding: '6px 14px', borderRadius: 999, cursor: 'pointer',
                fontSize: 12, fontWeight: 600, letterSpacing: '0.05em',
                background: city === c ? '#FF5500' : 'rgba(13,13,13,0.75)',
                color: city === c ? '#000' : 'rgba(240,239,235,0.70)',
                border: city === c ? 'none' : '1px solid rgba(255,255,255,0.12)',
                boxShadow: city === c ? '0 0 16px rgba(255,85,0,0.4)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Space count */}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(240,239,235,0.35)', letterSpacing: '0.08em' }}>
          {visibleSpaces.length} spaces
        </span>
      </div>

      {/* Detail panel */}
      <AnimatePresence>
        {selected && (
          <>
            {/* Backdrop tap to dismiss */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelected(null)}
              style={{ position: 'absolute', inset: 0 }}
            />

            <motion.div
              key="panel"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                borderRadius: '20px 20px 0 0',
                background: 'rgba(16,16,16,0.97)',
                backdropFilter: 'blur(32px) saturate(160%)',
                WebkitBackdropFilter: 'blur(32px) saturate(160%)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderBottom: 'none',
                padding: '0 0 max(env(safe-area-inset-bottom), 20px)',
              }}
            >
              {/* Drag handle */}
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4 }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(240,239,235,0.18)' }} />
              </div>

              <div style={{ padding: '12px 20px 0' }}>
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div>
                    <h2 style={{
                      margin: 0, fontSize: 22, fontWeight: 700,
                      color: '#F0EFEB', letterSpacing: '0.02em',
                      fontFamily: 'var(--font-bebas)',
                    }}>
                      {selected.name}
                    </h2>
                    <p style={{ margin: 0, fontSize: 12, color: 'rgba(240,239,235,0.45)', marginTop: 2 }}>
                      {selected.neighborhood} · {selected.city}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: 'rgba(240,239,235,0.08)', border: 'none',
                      color: 'rgba(240,239,235,0.4)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 12, height: 12 }}>
                      <path fillRule="evenodd" clipRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
                    </svg>
                  </button>
                </div>

                {/* Price */}
                <p style={{ margin: '6px 0 12px', fontSize: 18, fontWeight: 700, color: '#FF5500' }}>
                  {selected.price}
                </p>

                {/* Description */}
                <p style={{ margin: '0 0 14px', fontSize: 13, lineHeight: 1.6, color: 'rgba(240,239,235,0.65)' }}>
                  {selected.description}
                </p>

                {/* Tags */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                  {selected.tags.map(tag => (
                    <span key={tag} style={{
                      fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
                      padding: '4px 10px', borderRadius: 999,
                      background: 'rgba(255,85,0,0.10)',
                      border: '1px solid rgba(255,85,0,0.25)',
                      color: 'rgba(255,120,0,0.9)',
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Meta row */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr',
                  gap: 8, marginBottom: 18,
                }}>
                  <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 12px' }}>
                    <p style={{ margin: 0, fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', color: 'rgba(240,239,235,0.30)', textTransform: 'uppercase' }}>Hours</p>
                    <p style={{ margin: '3px 0 0', fontSize: 11, color: 'rgba(240,239,235,0.70)', lineHeight: 1.4 }}>{selected.hours}</p>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 12px' }}>
                    <p style={{ margin: 0, fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', color: 'rgba(240,239,235,0.30)', textTransform: 'uppercase' }}>Capacity</p>
                    <p style={{ margin: '3px 0 0', fontSize: 11, color: 'rgba(240,239,235,0.70)', lineHeight: 1.4 }}>{selected.capacity}</p>
                  </div>
                </div>

                {/* CTA */}
                <button
                  type="button"
                  style={{
                    width: '100%', padding: '14px 20px', borderRadius: 999,
                    background: '#FF5500', border: 'none', cursor: 'pointer',
                    fontSize: 14, fontWeight: 700, color: '#000',
                    boxShadow: '0 0 24px rgba(255,85,0,0.4)',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  Book a session →
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
