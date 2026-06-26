'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
  website: string | null
}

const SPACES: SpaceDetail[] = [
  // ── Madrid ──────────────────────────────────────────────────────────────────
  {
    name: "Pandora's Vox",
    neighborhood: 'Arganzuela',
    city: 'Madrid',
    price: 'desde €11/hr',
    lat: 40.4037, lng: -3.6958,
    description: '6 salas equipadas a 40m de Atocha Renfe. La mejor acústica del centro. Oferta 3×2 en mañanas L–V. Café incluido. Bono 15h desde 7€/h.',
    hours: 'L–D · todo el día',
    capacity: 'Hasta 6 músicos',
    tags: ['Backline incluido', 'A 40m de Atocha', 'Bono 15h desde 7€/h'],
    website: 'https://pandorasvox.es',
  },
  {
    name: 'UrbanStart',
    neighborhood: 'La Latina',
    city: 'Madrid',
    price: 'desde €12.50/hr',
    lat: 40.4098, lng: -3.7091,
    description: 'En pleno corazón de La Latina. Acústica optimizada, alta calidad. GameZone para descansos. Comunidad de músicos activa.',
    hours: 'L–D · todo el día',
    capacity: 'Hasta 6 músicos',
    tags: ['Acústica optimizada', 'GameZone', 'Comunidad activa'],
    website: 'https://urbanstart.es',
  },
  {
    name: 'Locales Underground',
    neighborhood: 'Salamanca',
    city: 'Madrid',
    price: 'Consultar',
    lat: 40.4339, lng: -3.6665,
    description: '36 salas de 16–35m². Grabación profesional, streaming en directo, bar, tienda de accesorios y luthier en las instalaciones. Vigilancia 24h.',
    hours: 'L–D · 24h',
    capacity: '36 salas (16–35m²)',
    tags: ['Grabación', 'Streaming en directo', 'Luthier'],
    website: 'https://localesunderground.com',
  },
  {
    name: 'IFAMA Artes Escénicas',
    neighborhood: 'Lavapiés',
    city: 'Madrid',
    price: 'Consultar',
    lat: 40.4076, lng: -3.7019,
    description: 'Salas de ensayo a 3 min del metro Embajadores. También disponibles para teatro y danza.',
    hours: 'L–D · todo el día',
    capacity: 'Varias salas',
    tags: ['A 3 min de Embajadores', 'Teatro y danza', 'Centro'],
    website: 'https://ifamartesescenicas.com',
  },
  {
    name: 'El Rompeolas',
    neighborhood: 'Madrid Centro',
    city: 'Madrid',
    price: 'Consultar',
    lat: 40.4060, lng: -3.6990,
    description: '3 locales con insonorización box-in-box — la mejor del mercado. Sin filtración de sonido entre salas.',
    hours: 'L–D · todo el día',
    capacity: '3 salas',
    tags: ['Box-in-box', 'Sin filtración', 'Insonorización premium'],
    website: null,
  },
  {
    name: 'Ensayos Jendrix',
    neighborhood: 'Alcobendas',
    city: 'Madrid',
    price: 'desde €12/hr',
    lat: 40.5513, lng: -3.6396,
    description: '7 locales + sala principal con escenario. Abierto todos los días 10:00–00:00. Parking. A 20 min del centro por A1/M40.',
    hours: 'L–D · 10:00–00:00',
    capacity: 'Hasta 8 músicos',
    tags: ['Sala con escenario', 'Parking gratuito', 'A 20 min del centro'],
    website: 'https://ensayosjendrix.es',
  },
  // ── Berlin ──────────────────────────────────────────────────────────────────
  {
    name: 'Pirate Studios Berlin',
    neighborhood: 'Tempelhof',
    city: 'Berlin',
    price: 'from €8/hr',
    lat: 52.4703, lng: 13.3976,
    description: '24/7 self-service studios at Tempelhof. Book via app, walk in any hour. All rooms include backline — no setup time wasted.',
    hours: '24 / 7',
    capacity: 'Up to 5 musicians',
    tags: ['24/7 access', 'App booking', 'Self-service'],
    website: 'https://piratestudios.com',
  },
  {
    name: 'noisy at RAW',
    neighborhood: 'Friedrichshain',
    city: 'Berlin',
    price: 'from €7/hr',
    lat: 52.5123, lng: 13.4539,
    description: 'Underground rehearsal complex inside the legendary RAW Gelände. Raw industrial vibes, professional sound. Bands only.',
    hours: 'Mon–Sun · 12:00–04:00',
    capacity: 'Up to 6 musicians',
    tags: ['RAW complex', 'Underground', 'Night-friendly'],
    website: 'https://noisyraw.de',
  },
  {
    name: 'Proberaum Berlin',
    neighborhood: 'Mitte',
    city: 'Berlin',
    price: 'from €6/hr',
    lat: 52.5192, lng: 13.3986,
    description: 'Central Berlin location in Mitte. Eight rehearsal rooms, professional PA, climate control. Monthly storage included.',
    hours: 'Mon–Fri · 10:00–22:00 · Sat–Sun · 10:00–20:00',
    capacity: 'Up to 5 musicians',
    tags: ['Central Berlin', 'U-Bahn 2 min', 'Professional PA'],
    website: 'https://proberaum-berlin.de',
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

function SpacesMapContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const initialCity = (() => {
    const c = searchParams.get('city')
    if (c === 'Madrid' || c === 'Berlin') return c as City
    return 'All' as City
  })()

  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])

  const [city, setCity] = useState<City>(initialCity)
  const [selected, setSelected] = useState<SpaceDetail | null>(null)

  const visibleSpaces = city === 'All' ? SPACES : SPACES.filter(s => s.city === city)

  // ── Create map once ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    mapboxgl.accessToken = TOKEN

    const isAll = initialCity === 'All'
    const cityKey = isAll ? 'Madrid' : initialCity
    const { center, zoom } = CITY_CENTERS[cityKey as 'Madrid' | 'Berlin']

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: isAll ? [5.0, 48.0] : center,
      zoom: isAll ? 4 : zoom,
      attributionControl: false,
      logoPosition: 'bottom-right',
    })
    mapRef.current = map

    return () => {
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []
      map.remove()
      mapRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Re-render markers when visibleSpaces changes ───────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    function renderMarkers() {
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []

      visibleSpaces.forEach(space => {
        const el = createMarkerEl(space, () => setSelected(space))
        const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([space.lng, space.lat])
          .addTo(map!)
        markersRef.current.push(marker)
      })
    }

    if (map.loaded()) renderMarkers()
    else map.once('load', renderMarkers)
  }, [visibleSpaces]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fly when city filter changes ───────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (city === 'All') {
      map.flyTo({ center: [5.0, 48.0], zoom: 4, duration: 900 })
    } else {
      const { center, zoom } = CITY_CENTERS[city]
      map.flyTo({ center, zoom, duration: 900 })
    }
    // Clear selection when city changes
    setSelected(null)
  }, [city])

  // ── Fly to selected space ──────────────────────────────────────────────────
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
                {selected.website ? (
                  <a
                    href={selected.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'block', width: '100%', padding: '14px 20px', borderRadius: 999,
                      background: '#FF5500', cursor: 'pointer',
                      fontSize: 14, fontWeight: 700, color: '#000', textAlign: 'center',
                      boxShadow: '0 0 24px rgba(255,85,0,0.4)', textDecoration: 'none',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    Visit website →
                  </a>
                ) : (
                  <button
                    type="button"
                    style={{
                      width: '100%', padding: '14px 20px', borderRadius: 999,
                      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                      cursor: 'default', fontSize: 14, fontWeight: 600,
                      color: 'rgba(240,239,235,0.35)',
                    }}
                  >
                    No website — contact directly
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function SpacesMapPage() {
  return (
    <Suspense>
      <SpacesMapContent />
    </Suspense>
  )
}
