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
  address?: string
  city: 'Madrid' | 'Berlin'
  price_from: number | null
  price_currency: '€'
  price_unit: 'hr'
  website: string | null
  phone: string | null
  description: string
  instruments: string[]
  lat: number
  lng: number
}

interface JamVenue {
  name: string
  neighborhood: string
  address: string
  city: 'Madrid'
  website: string | null
  phone: string | null
  description: string
  capacity?: number
  has_jam_sessions: true
  lat: number
  lng: number
}

const REHEARSAL_SPACES: Space[] = [
  // ── Madrid ──────────────────────────────────────────────
  {
    name: "Pandora's Vox",
    neighborhood: 'Arganzuela',
    address: 'Calle Rafael de Riego, 8, 28045 Madrid',
    city: 'Madrid',
    price_from: 11,
    price_currency: '€',
    price_unit: 'hr',
    website: 'https://pandorasvox.es',
    phone: '912 30 01 74',
    description: '6 salas equipadas a 40m de Atocha Renfe. La mejor acústica del centro. Oferta 3×2 en mañanas L–V. Café incluido. Bono 15h desde 7€/h. 4.7★',
    instruments: ['guitar', 'drums', 'bass', 'keys', 'vocals'],
    lat: 40.4037, lng: -3.6958,
  },
  {
    name: 'UrbanStart',
    neighborhood: 'La Latina',
    address: 'Plaza de Cascorro, 2, 28005 Madrid',
    city: 'Madrid',
    price_from: 12.50,
    price_currency: '€',
    price_unit: 'hr',
    website: 'https://urbanstart.es',
    phone: '683 601 001',
    description: 'En pleno corazón de La Latina. Acústica optimizada, alta calidad. GameZone para descansos. Comunidad de músicos activa. 4.8★',
    instruments: ['guitar', 'drums', 'bass', 'keys', 'vocals'],
    lat: 40.4098, lng: -3.7091,
  },
  {
    name: 'Locales Underground',
    neighborhood: 'Salamanca',
    address: 'Calle del Marqués de Monteagudo, 22, 28028 Madrid',
    city: 'Madrid',
    price_from: null,
    price_currency: '€',
    price_unit: 'hr',
    website: 'https://localesunderground.com',
    phone: null,
    description: '36 salas de 16–35m². Grabación profesional, streaming en directo, bar, tienda de accesorios y luthier en las instalaciones. Vigilancia 24h.',
    instruments: ['guitar', 'drums', 'bass', 'keys', 'producer'],
    lat: 40.4339, lng: -3.6665,
  },
  {
    name: 'IFAMA Artes Escénicas',
    neighborhood: 'Lavapiés',
    address: 'Calle Provisiones, 26, Madrid',
    city: 'Madrid',
    price_from: null,
    price_currency: '€',
    price_unit: 'hr',
    website: 'https://ifamartesescenicas.com',
    phone: null,
    description: 'Salas de ensayo a 3 min del metro Embajadores. También disponibles para teatro y danza.',
    instruments: ['guitar', 'drums', 'bass', 'keys', 'vocals'],
    lat: 40.4076, lng: -3.7019,
  },
  {
    name: 'El Rompeolas',
    neighborhood: 'Madrid Centro',
    address: 'Calle de Tarragona, 18, Madrid',
    city: 'Madrid',
    price_from: null,
    price_currency: '€',
    price_unit: 'hr',
    website: null,
    phone: null,
    description: '3 locales con insonorización box-in-box — la mejor del mercado. Sin filtración de sonido entre salas.',
    instruments: ['guitar', 'drums', 'bass', 'keys'],
    lat: 40.4060, lng: -3.6990,
  },
  {
    name: 'Ensayos Jendrix',
    neighborhood: 'Alcobendas',
    address: 'Calle La Granja, 60, 28108 Alcobendas',
    city: 'Madrid',
    price_from: 12,
    price_currency: '€',
    price_unit: 'hr',
    website: 'https://ensayosjendrix.es',
    phone: '91 490 53 72',
    description: '7 locales + sala principal con escenario. Abierto todos los días 10:00–00:00. Parking. A 20 min del centro por A1/M40.',
    instruments: ['guitar', 'drums', 'bass', 'keys', 'vocals'],
    lat: 40.5513, lng: -3.6396,
  },
  // ── Berlin ──────────────────────────────────────────────
  {
    name: 'Pirate Studios Berlin',
    neighborhood: 'Tempelhof',
    city: 'Berlin',
    price_from: 8,
    price_currency: '€',
    price_unit: 'hr',
    website: 'https://piratestudios.com',
    phone: null,
    description: '24/7 self-service studios at Tempelhof. Book via app, walk in any hour. All rooms include backline — no setup time wasted.',
    instruments: ['drums', 'guitar', 'bass', 'dj'],
    lat: 52.4703, lng: 13.3976,
  },
  {
    name: 'noisy at RAW',
    neighborhood: 'Friedrichshain',
    city: 'Berlin',
    price_from: 7,
    price_currency: '€',
    price_unit: 'hr',
    website: 'https://noisyraw.de',
    phone: null,
    description: 'Underground rehearsal complex inside the legendary RAW Gelände. Raw industrial vibes, professional sound. Bands only.',
    instruments: ['drums', 'bass', 'guitar', 'producer'],
    lat: 52.5123, lng: 13.4539,
  },
  {
    name: 'Proberaum Berlin',
    neighborhood: 'Mitte',
    city: 'Berlin',
    price_from: 6,
    price_currency: '€',
    price_unit: 'hr',
    website: 'https://proberaum-berlin.de',
    phone: null,
    description: 'Central Berlin location in Mitte. Eight rehearsal rooms, professional PA, climate control. Monthly storage included.',
    instruments: ['guitar', 'bass', 'keys', 'drums'],
    lat: 52.5192, lng: 13.3986,
  },
]

const JAM_VENUES: JamVenue[] = [
  {
    name: 'Honky Tonk',
    neighborhood: 'Alonso Martínez',
    address: 'Calle Covarrubias, 24, Madrid',
    city: 'Madrid',
    website: null,
    phone: null,
    description: 'Bar histórico de rock con jam sessions semanales. Rock, blues, soul. Muy abierto a músicos emergentes — contactar directamente para alquiler o colaboración.',
    has_jam_sessions: true,
    lat: 40.4302, lng: -3.6982,
  },
  {
    name: 'Sala El Juglar',
    neighborhood: 'Lavapiés',
    address: 'Calle de Lavapiés, 37, 28012 Madrid',
    city: 'Madrid',
    website: 'https://salajuglar.com',
    phone: null,
    description: 'Jam sessions cada miércoles desde hace más de 5 años. Todos los estilos. Disponible en alquiler. Público joven y alternativo en Lavapiés.',
    capacity: 150,
    has_jam_sessions: true,
    lat: 40.4070, lng: -3.7023,
  },
  {
    name: 'Sala Siroco',
    neighborhood: 'Malasaña',
    address: 'Calle de San Dimas, 3, Madrid',
    city: 'Madrid',
    website: null,
    phone: null,
    description: 'Sala de culto en Malasaña. Indie, soul, jazz, electrónica. Dos plantas: conciertos abajo, bar arriba. Disponible para alquiler para bandas emergentes.',
    capacity: 200,
    has_jam_sessions: true,
    lat: 40.4238, lng: -3.7083,
  },
  {
    name: 'Café La Palma',
    neighborhood: 'Malasaña',
    address: 'Calle de la Palma, 62, Madrid',
    city: 'Madrid',
    website: null,
    phone: null,
    description: 'Histórica del indie madrileño desde los 90. Vetusta Morla empezaron aquí. Formato íntimo y cercano. Ideal para un primer evento con 50–80 personas.',
    capacity: 80,
    has_jam_sessions: true,
    lat: 40.4249, lng: -3.7059,
  },
  {
    name: 'BarCo',
    neighborhood: 'Madrid Centro',
    address: 'Calle del Barco, 34, Madrid',
    city: 'Madrid',
    website: null,
    phone: null,
    description: 'Asociada a la Escuela de Música Creativa. Jam sessions regulares de rock y músicas negras. Muy abierta a propuestas de músicos nuevos.',
    capacity: 200,
    has_jam_sessions: true,
    lat: 40.4196, lng: -3.7029,
  },
  {
    name: 'La Tabacalera',
    neighborhood: 'Lavapiés',
    address: 'Calle de Embajadores, 53, 28012 Madrid',
    city: 'Madrid',
    website: null,
    phone: null,
    description: 'Centro social y cultural inmenso. Eventos gratuitos o muy baratos. Muy abierto a propuestas de comunidades culturales — ideal para una primera jam session sin coste.',
    has_jam_sessions: true,
    lat: 40.4080, lng: -3.7000,
  },
  {
    name: 'Sala Wurlitzer Ballroom',
    neighborhood: 'Gran Vía',
    address: 'Calle de las Tres Cruces, 12, Madrid',
    city: 'Madrid',
    website: null,
    phone: null,
    description: 'Rock sin tonterías. Aforo pequeño, acústica cruda, muy intensa. Bandas emergentes nacionales e internacionales. La más auténtica del centro.',
    has_jam_sessions: true,
    lat: 40.4179, lng: -3.7020,
  },
  {
    name: 'Sala Maravillas',
    neighborhood: 'Malasaña',
    address: 'Malasaña, Madrid',
    city: 'Madrid',
    website: null,
    phone: null,
    description: 'Fusión de sala de conciertos y local nocturno. Indie, pop-rock, electrónica. Conciertos que acaban en sesiones de DJ. Público juvenil.',
    capacity: 200,
    has_jam_sessions: true,
    lat: 40.4232, lng: -3.7075,
  },
]

const INSTRUMENT_EMOJI: Record<string, string> = {
  guitar: '🎸', bass: '🎸', drums: '🥁', keys: '🎹', piano: '🎹',
  violin: '🎻', cello: '🎻', trumpet: '🎺', saxophone: '🎷', flute: '🪈',
  vocals: '🎤', producer: '🎚️', dj: '🎧', other: '🎵',
}

function formatPrice(space: Space): string {
  if (space.price_from === null) return 'Consultar'
  return `desde ${space.price_currency}${space.price_from}/${space.price_unit}`
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

  const filteredSpaces = city === 'All' ? REHEARSAL_SPACES : REHEARSAL_SPACES.filter(s => s.city === city)
  const showJamVenues = city === 'All' || city === 'Madrid'

  const mapPins: SpacePin[] = filteredSpaces.map(s => ({
    name: s.name,
    neighborhood: s.neighborhood,
    city: s.city,
    price: formatPrice(s),
    lat: s.lat,
    lng: s.lng,
  }))

  return (
    <div style={{ minHeight: '100dvh' }}>

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
              <p className="text-[11px] text-[rgba(240,239,235,0.3)]">
                {filteredSpaces.length} spaces{showJamVenues ? ` · ${JAM_VENUES.length} jam venues` : ''}
              </p>
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
        <div className="mb-2">
          <SpacesMap spaces={mapPins} centerCity={city} />
        </div>

        {/* View full map link */}
        <div className="mb-5 flex justify-end">
          <button
            onClick={() => router.push(`/spaces/map?city=${city}`)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 12, fontWeight: 600,
              color: '#FF5500',
              background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
            }}
          >
            View full map
            <svg viewBox="0 0 12 12" fill="none" style={{ width: 10, height: 10 }}>
              <path d="M2 10L10 2M10 2H4M10 2V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Rehearsal space cards */}
        <div className="flex flex-col gap-3">
          {filteredSpaces.map((space, i) => (
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
                  <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
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
                    {space.address && (
                      <p style={{ fontSize: 11, color: 'rgba(240,239,235,0.25)', marginTop: 3 }}>
                        {space.address}
                      </p>
                    )}
                  </div>
                  <span style={{
                    fontSize: 13, fontWeight: 700,
                    color: space.price_from !== null ? '#FF5500' : 'rgba(240,239,235,0.4)',
                    background: space.price_from !== null ? 'rgba(255,85,0,0.10)' : 'rgba(255,255,255,0.04)',
                    padding: '4px 10px', borderRadius: 99, flexShrink: 0, whiteSpace: 'nowrap',
                  }}>
                    {formatPrice(space)}
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
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                {space.website ? (
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
                ) : (
                  <span style={{ fontSize: 12, color: 'rgba(240,239,235,0.25)' }}>No website</span>
                )}
                {space.phone && (
                  <a
                    href={`tel:${space.phone.replace(/\s/g, '')}`}
                    style={{ fontSize: 12, color: 'rgba(240,239,235,0.35)', textDecoration: 'none' }}
                  >
                    {space.phone}
                  </a>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Jam session venues section */}
        {showJamVenues && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            {/* Section header */}
            <div style={{ marginTop: 36, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 22 }}>🎸</span>
                <h2
                  style={{
                    fontFamily: 'var(--font-bebas)',
                    fontSize: 22,
                    letterSpacing: '0.08em',
                    color: '#F0EFEB',
                  }}
                >
                  JAM SESSION VENUES
                </h2>
              </div>
              <p style={{ fontSize: 12, color: 'rgba(240,239,235,0.3)', lineHeight: 1.5 }}>
                Spaces where you can host or join live music events and jam sessions in Madrid Centro.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {JAM_VENUES.map((venue, i) => (
                <motion.div
                  key={venue.name}
                  custom={i}
                  variants={fadeUp}
                  initial="hidden"
                  animate="show"
                  style={{
                    borderRadius: 16,
                    background: 'rgba(5,4,10,0.7)',
                    border: '1px solid rgba(255,85,0,0.12)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Card header */}
                  <div style={{ padding: '14px 16px 10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 16 }}>🎸</span>
                          <p
                            style={{
                              fontFamily: 'var(--font-bebas)',
                              fontSize: 20,
                              letterSpacing: '0.06em',
                              color: '#F0EFEB',
                              lineHeight: 1.1,
                            }}
                          >
                            {venue.name}
                          </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                          <span style={{
                            fontSize: 11, color: 'rgba(240,239,235,0.5)',
                            background: 'rgba(255,255,255,0.05)',
                            padding: '1px 8px', borderRadius: 99,
                          }}>
                            {venue.neighborhood}
                          </span>
                        </div>
                        <p style={{ fontSize: 11, color: 'rgba(240,239,235,0.2)', marginTop: 3 }}>
                          {venue.address}
                        </p>
                      </div>
                      {/* JAM SESSIONS badge */}
                      <span style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                        color: '#FF5500',
                        background: 'rgba(255,85,0,0.14)',
                        border: '1px solid rgba(255,85,0,0.25)',
                        padding: '3px 8px', borderRadius: 99, flexShrink: 0,
                      }}>
                        JAM SESSIONS
                      </span>
                    </div>

                    <p style={{ fontSize: 13, color: 'rgba(240,239,235,0.4)', lineHeight: 1.5, marginBottom: 10 }}>
                      {venue.description}
                    </p>

                    {venue.capacity && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                        <span style={{
                          fontSize: 11, color: 'rgba(240,239,235,0.35)',
                          background: 'rgba(255,255,255,0.04)',
                          padding: '2px 8px', borderRadius: 99,
                        }}>
                          👥 {venue.capacity} personas
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card footer */}
                  <div style={{ borderTop: '1px solid rgba(255,85,0,0.08)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    {venue.website ? (
                      <a
                        href={venue.website}
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
                    ) : (
                      <span style={{ fontSize: 12, color: 'rgba(240,239,235,0.2)' }}>Contactar directamente</span>
                    )}
                    {venue.phone && (
                      <a
                        href={`tel:${venue.phone.replace(/\s/g, '')}`}
                        style={{ fontSize: 12, color: 'rgba(240,239,235,0.35)', textDecoration: 'none' }}
                      >
                        {venue.phone}
                      </a>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

      </div>

      <BottomNav />
    </div>
  )
}
