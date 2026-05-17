'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import type { NearbyMusician, Instrument } from '@/types'
import type { SpacePin } from '@/components/map/SpacesMap'
import BottomNav from '@/components/ui/BottomNav'
import CompleteProfileModal from '@/components/profile/CompleteProfileModal'

const SpacesMap = dynamic(() => import('@/components/map/SpacesMap'), { ssr: false })

const INSTRUMENT_EMOJI: Record<string, string> = {
  guitar: '🎸', bass: '🎸', drums: '🥁', keys: '🎹', piano: '🎹',
  violin: '🎻', cello: '🎻', trumpet: '🎺', saxophone: '🎷', flute: '🪈',
  vocals: '🎤', producer: '🎚️', dj: '🎧', other: '🎵',
}

const MADRID_SPACES = [
  { name: 'Rockschool Madrid',        area: 'Malasaña',     price: 'from €5/hr' },
  { name: 'Sala de Ensayo Lavapiés',  area: 'Lavapiés',     price: 'from €8/hr' },
  { name: 'StudiOne Madrid',          area: 'Chamberí',     price: 'from €6/hr' },
]

const BERLIN_SPACES = [
  { name: 'Pirate Studios Berlin',    area: 'Tempelhof',     price: 'from €8/hr' },
  { name: 'noisy at RAW',             area: 'Friedrichshain', price: 'from €7/hr' },
  { name: 'Proberaum Berlin',         area: 'Mitte',         price: 'from €6/hr' },
]

const SPACE_PINS: SpacePin[] = [
  { name: 'Rockschool Madrid',       neighborhood: 'Malasaña',      city: 'Madrid', price: 'from €5/hr', lat: 40.4248, lng: -3.7014 },
  { name: 'Sala de Ensayo Lavapiés', neighborhood: 'Lavapiés',      city: 'Madrid', price: 'from €8/hr', lat: 40.4079, lng: -3.7043 },
  { name: 'StudiOne Madrid',         neighborhood: 'Chamberí',      city: 'Madrid', price: 'from €6/hr', lat: 40.4352, lng: -3.7097 },
  { name: 'Pirate Studios Berlin',   neighborhood: 'Tempelhof',     city: 'Berlin', price: 'from €8/hr', lat: 52.4703, lng: 13.3976 },
  { name: 'noisy at RAW',            neighborhood: 'Friedrichshain',city: 'Berlin', price: 'from €7/hr', lat: 52.5123, lng: 13.4539 },
  { name: 'Proberaum Berlin',        neighborhood: 'Mitte',         city: 'Berlin', price: 'from €6/hr', lat: 52.5192, lng: 13.3986 },
]

interface ProfileRow {
  id: string
  display_name: string | null
  city: string | null
  avatar_url: string | null
  bio: string | null
  audio_url: string | null
  instruments: Instrument[]
  genres: string[]
  years_practicing: string | null
  age_range: string | null
  band_experience: string | null
  influences: string[] | null
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

// Score is based only on the 7 fields that onboarding + the complete-profile
// modal actually collect. Reaching 100 % should be possible after both flows.
// bio, audio_url, avatar_url are optional extras not counted here.
function profileScore(p: ProfileRow): number {
  const fields = [
    !!p.display_name?.trim(),
    (p.instruments?.length ?? 0) > 0,
    (p.genres?.length ?? 0) > 0,
    !!p.years_practicing,
    !!p.age_range,
    !!p.band_experience,
    (p.influences?.length ?? 0) > 0,
  ]
  const filled = fields.filter(Boolean).length
  return Math.round((filled / fields.length) * 100)
}

function isActiveToday(lastActive: string | null): boolean {
  if (!lastActive) return false
  return Date.now() - new Date(lastActive).getTime() < 86400000
}

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const } },
}
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } }

export default function HomePage() {
  const router   = useRouter()
  const supabase = createClient()

  const [profile,           setProfile]           = useState<ProfileRow | null>(null)
  const [musicians,         setMusicians]         = useState<NearbyMusician[]>([])
  const [loading,           setLoading]           = useState(true)
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [currentUserId,     setCurrentUserId]     = useState<string | null>(null)

  async function refreshProfile(uid?: string) {
    const id = uid ?? currentUserId
    if (!id) return
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, city, avatar_url, bio, audio_url, instruments, genres, years_practicing, age_range, band_experience, influences')
      .eq('id', id)
      .single()
    if (data) setProfile(data as ProfileRow)
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setCurrentUserId(user.id)

      const { data: prof } = await supabase
        .from('profiles')
        .select('id, display_name, city, avatar_url, bio, audio_url, instruments, genres, years_practicing, age_range, band_experience, influences')
        .eq('id', user.id)
        .single()

      if (prof) setProfile(prof as ProfileRow)

      const { data: nearby } = await supabase.rpc('get_nearby_musicians', {
        user_id:    user.id,
        radius_km:  50,
        max_results: 10,
      })
      // Filter out the current user from the musicians list
      if (nearby) setMusicians((nearby as NearbyMusician[]).filter(m => m.id !== user.id))

      setLoading(false)
    }
    void load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex items-center justify-center bg-[#0D0D0D]" style={{ minHeight: '100dvh' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[rgba(240,239,235,0.12)] border-t-[#FF5500]" />
      </div>
    )
  }

  const firstName = (profile?.display_name ?? '').split(' ')[0] || 'there'
  const city      = profile?.city ?? ''
  const score     = profile ? profileScore(profile) : 0
  const spaces    = city.toLowerCase().includes('berlin') ? BERLIN_SPACES : MADRID_SPACES
  const initials  = (profile?.display_name ?? '?').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div
      className="relative overflow-x-hidden overflow-y-auto"
      style={{ minHeight: '100dvh', paddingBottom: 90, zIndex: 1 }}
    >
      {/* Ambient light orbs — fixed behind all page content */}
      <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute', top: '-10%', right: '-5%',
          width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,92,0,0.18) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }} />
        <div style={{
          position: 'absolute', bottom: '10%', left: '-10%',
          width: 350, height: 350, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }} />
      </div>
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        style={{ paddingTop: 56, paddingLeft: 20, paddingRight: 20 }}
      >

        {/* ── Header ── floating, transparent */}
        <motion.div variants={fadeUp} className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm text-[rgba(240,239,235,0.4)]"
              style={{ fontFamily: 'var(--font-dm-sans)' }}>{greeting()},</p>
            <h1 className="font-[family-name:var(--font-bebas)] tracking-widest text-[#F0EFEB]"
              style={{ fontSize: 'clamp(1.8rem,8vw,2.4rem)' }}>
              {firstName.toUpperCase()}
            </h1>
            {city && (
              <p className="mt-0.5 text-xs text-[rgba(240,239,235,0.3)]">
                Here&apos;s what&apos;s happening in {city}
              </p>
            )}
          </div>
          <button
            onClick={() => router.push('/profile/me')}
            className="flex-shrink-0"
            aria-label="My profile"
          >
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt={profile.display_name ?? 'Me'}
                style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover',
                  border: '2px solid #8B5CF6', boxShadow: '0 0 0 4px rgba(139,92,246,0.20), 0 0 16px rgba(139,92,246,0.30)' }} />
            ) : (
              <div className="flex items-center justify-center"
                style={{ width: 48, height: 48, borderRadius: '50%', background: '#1a1a1a',
                  border: '2px solid rgba(139,92,246,0.5)', boxShadow: '0 0 0 4px rgba(139,92,246,0.15)' }}>
                <span className="font-[family-name:var(--font-bebas)] text-lg text-[rgba(240,239,235,0.5)]">
                  {initials}
                </span>
              </div>
            )}
          </button>
        </motion.div>

        {/* ── Complete profile card — glass-apple with orange left border ── */}
        {score < 100 && (
          <motion.div variants={fadeUp} className="mb-8">
            <button
              onClick={() => setShowCompleteModal(true)}
              className="w-full text-left"
            >
              <div
                className="glass-apple p-5"
                style={{ borderLeft: '2px solid #FF5C00' }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-[#F0EFEB]">Complete your profile</p>
                  <span className="text-xs font-bold text-[#FF5500]">{score}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[rgba(240,239,235,0.08)]">
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${score}%` }}
                    transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                      background: 'linear-gradient(90deg, #FF5C00 0%, #8B5CF6 100%)',
                      boxShadow: '0 0 8px rgba(255,85,0,0.5)',
                    }}
                  />
                </div>
                <p className="mt-2.5 text-xs text-[rgba(240,239,235,0.4)]">
                  A complete profile gets 3× more connection requests
                </p>
              </div>
            </button>
          </motion.div>
        )}

        {/* ── Musicians near you ── */}
        {musicians.length > 0 && (
          <motion.div variants={fadeUp} className="mb-8">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[rgba(240,239,235,0.3)]">
                Musicians near you
              </p>
              <button
                onClick={() => router.push('/explore')}
                className="text-xs text-[rgba(255,92,0,0.7)] transition-colors hover:text-[#FF5C00]"
              >
                See all →
              </button>
            </div>

            {/* Scroll container — glass-apple-subtle */}
            <div
              className="glass-apple-subtle"
              style={{ padding: '12px 8px' }}
            >
              <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {musicians.slice(0, 6).map((m) => {
                  const active = isActiveToday(m.last_active)
                  const initials2 = (m.display_name ?? '?').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
                  return (
                    <button
                      key={m.id}
                      onClick={() => router.push(`/profile/${m.id}`)}
                      className="group flex-shrink-0 flex flex-col items-center gap-2 p-3 text-center transition-all duration-200"
                      style={{
                        width: 88,
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 50%, rgba(255,255,255,0.07) 100%)',
                        backdropFilter: 'blur(48px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(48px) saturate(180%)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderBottomColor: 'rgba(255,255,255,0.05)',
                        borderRightColor: 'rgba(255,255,255,0.05)',
                        borderRadius: 16,
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), 0 4px 16px rgba(0,0,0,0.20)',
                      }}
                      onMouseEnter={e => {
                        const el = e.currentTarget
                        el.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.25), 0 0 0 1px rgba(255,92,0,0.3), 0 12px 40px rgba(0,0,0,0.30), 0 0 20px rgba(255,92,0,0.08)'
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget
                        el.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.18), 0 4px 16px rgba(0,0,0,0.20)'
                      }}
                    >
                      <div style={{ position: 'relative' }}>
                        {m.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.avatar_url} alt={m.display_name ?? ''}
                            style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover',
                              border: active ? '2px solid rgba(255,92,0,0.7)' : '2px solid rgba(240,239,235,0.12)' }} />
                        ) : (
                          <div className="flex items-center justify-center text-xl"
                            style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,0.06)',
                              border: active ? '2px solid rgba(255,92,0,0.7)' : '2px solid rgba(240,239,235,0.12)' }}>
                            {INSTRUMENT_EMOJI[m.instruments[0]] ?? '🎵'}
                          </div>
                        )}
                        {active && (
                          <span style={{ position: 'absolute', bottom: 1, right: 1, width: 10, height: 10,
                            borderRadius: '50%', background: '#34d399', border: '1.5px solid #0D0D0D' }} />
                        )}
                      </div>
                      <p className="w-full truncate text-xs font-medium text-[rgba(240,239,235,0.85)]">
                        {m.display_name ?? initials2}
                      </p>
                      <p className="text-[10px] text-[rgba(240,239,235,0.35)]">
                        {INSTRUMENT_EMOJI[m.instruments[0]] ?? '🎵'} {m.distance_km != null ? `${Math.round(m.distance_km)}km` : m.city ?? ''}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Rehearsal spaces ── */}
        <motion.div variants={fadeUp} className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[rgba(240,239,235,0.3)]">
              Rehearsal spaces near you
            </p>
            <button
              onClick={() => router.push('/spaces')}
              className="text-xs text-[rgba(255,92,0,0.7)] transition-colors hover:text-[#FF5C00]"
            >
              Show more →
            </button>
          </div>
          <div className="flex flex-col gap-2.5">
            {spaces.map((s) => (
              <div
                key={s.name}
                className="glass-apple flex items-center justify-between p-4"
              >
                <div>
                  <p className="text-[15px] leading-tight text-[#F0EFEB]"
                    style={{ fontFamily: 'var(--font-bebas)', letterSpacing: '0.06em' }}>
                    {s.name}
                  </p>
                  <p className="mt-0.5 text-xs text-[rgba(240,239,235,0.4)]">{s.area}</p>
                </div>
                <span className="text-xs font-semibold text-[#FF5500]">{s.price}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Rehearsal spaces map ── */}
        <motion.div variants={fadeUp} className="mt-2 mb-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] tracking-[0.16em] uppercase text-[rgba(240,239,235,0.35)]">
              Map
            </p>
            <Link href="/spaces/map"
              style={{
                fontSize: 11, fontWeight: 600, letterSpacing: '0.10em',
                color: '#FF5500', textDecoration: 'none',
              }}>
              OPEN MAP →
            </Link>
          </div>
          <SpacesMap
            spaces={SPACE_PINS.filter(s =>
              city.toLowerCase().includes('berlin') ? s.city === 'Berlin' : s.city === 'Madrid'
            )}
            centerCity={city.toLowerCase().includes('berlin') ? 'Berlin' : 'Madrid'}
          />
        </motion.div>

        {/* ── Events near you ── */}
        <motion.div variants={fadeUp} className="mb-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[rgba(240,239,235,0.3)]">
            Events near you
          </p>
          <div className="glass-apple p-4">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-xl"
                style={{ background: 'rgba(255,92,0,0.12)' }}
              >
                🎵
              </div>
              <div>
                <p className="text-sm font-medium text-[#F0EFEB]">Sondar Open Jam</p>
                <p className="text-xs text-[rgba(240,239,235,0.4)]">Coming soon</p>
              </div>
            </div>
          </div>
        </motion.div>

      </motion.div>

      <AnimatePresence>
        {showCompleteModal && (
          <CompleteProfileModal
            onClose={() => setShowCompleteModal(false)}
            onComplete={async () => {
              setShowCompleteModal(false)
              if (currentUserId) {
                const { data: fresh } = await supabase
                  .from('profiles')
                  .select('*')
                  .eq('id', currentUserId)
                  .single()
                if (fresh) {
                  setProfile(fresh as ProfileRow)
                  console.log('[Home] Fresh profile after modal:', {
                    influences: fresh.influences,
                    years_practicing: fresh.years_practicing,
                    age_range: fresh.age_range,
                    band_experience: fresh.band_experience,
                    score: profileScore(fresh as ProfileRow),
                  })
                }
              }
            }}
          />
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  )
}
