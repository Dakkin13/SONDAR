'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { AnimatePresence, motion } from 'framer-motion'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import type { NearbyMusician, Profile } from '@/types'
import type { SpacePin } from '@/components/map/SpacesMap'
import BottomNav from '@/components/ui/BottomNav'
import Avatar from '@/components/ui/Avatar'
import { fetchBandSummaries } from '@/lib/data/bands'
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

const DEFAULT_LAT = 40.4168
const DEFAULT_LNG = -3.7038

type ProfileRow = Pick<
  Profile,
  | 'id' | 'display_name' | 'city' | 'lat' | 'lng' | 'avatar_url' | 'bio' | 'audio_url'
  | 'instruments' | 'genres' | 'years_practicing' | 'age_range' | 'band_experience' | 'influences'
>

interface BandSummary {
  id: string
  name: string
  avatar_url: string | null
  memberCount: number
  unreadCount: number
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
  const [myBands,           setMyBands]           = useState<BandSummary[]>([])

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
      if (!user.email_confirmed_at) { router.push('/verify-email'); return }
      setCurrentUserId(user.id)

      const { data: prof } = await supabase
        .from('profiles')
        .select('id, display_name, city, lat, lng, avatar_url, bio, audio_url, instruments, genres, years_practicing, age_range, band_experience, influences')
        .eq('id', user.id)
        .single()

      if (prof) setProfile(prof as ProfileRow)

      const userLat = (prof as ProfileRow | null)?.lat ?? DEFAULT_LAT
      const userLng = (prof as ProfileRow | null)?.lng ?? DEFAULT_LNG

      const { data: nearby } = await supabase.rpc('get_nearby_musicians', {
        user_lat: userLat,
        user_lng: userLng,
        radius_km: 50,
      })
      if (nearby) setMusicians((nearby as NearbyMusician[]).filter(m => m.id !== user.id))

      // ── Your Bands ──────────────────────────────────────────────────────
      const bandSummaries = await fetchBandSummaries(supabase, user.id)
      setMyBands(bandSummaries.map(s => ({
        id: s.band.id,
        name: s.band.name,
        avatar_url: s.band.avatar_url,
        memberCount: s.memberCount,
        unreadCount: s.unreadCount,
      })))

      setLoading(false)
    }
    void load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '100dvh' }}>
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
        className="mx-auto w-full max-w-3xl"
        style={{ paddingTop: 'calc(56px + env(safe-area-inset-top, 0px))', paddingLeft: 20, paddingRight: 20 }}
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
            className="flex-shrink-0 transition-transform active:scale-95"
            aria-label="My profile"
          >
            {profile?.avatar_url ? (
              <Image src={profile.avatar_url} alt={profile.display_name ?? 'Me'} width={48} height={48}
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

        {/* ── Complete profile card ── */}
        {score < 100 && (
          <motion.div variants={fadeUp} className="mb-6">
            <button onClick={() => setShowCompleteModal(true)} className="w-full text-left">
              <div className="glass-apple p-4" style={{ borderLeft: '2px solid #FF5C00' }}>
                <div className="mb-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#F0EFEB]">Complete your profile</span>
                  </div>
                  <span className="rounded-full bg-[rgba(255,85,0,0.12)] px-2 py-0.5 text-[11px] font-bold text-[#FF5500]">{score}%</span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-[rgba(240,239,235,0.07)]">
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${score}%` }}
                    transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                    style={{ background: 'linear-gradient(90deg, #FF5C00 0%, #8B5CF6 100%)', boxShadow: '0 0 8px rgba(255,85,0,0.4)' }}
                  />
                </div>
                <p className="mt-2 text-[11px] text-[rgba(240,239,235,0.35)]">
                  A complete profile gets 3× more connection requests
                </p>
              </div>
            </button>
          </motion.div>
        )}

        {/* ── Musicians near you ── */}
        {musicians.length === 0 && (
          <motion.div variants={fadeUp} className="mb-6">
            <div className="flex flex-col items-center gap-3 rounded-2xl py-8 text-center"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="font-[family-name:var(--font-bebas)] text-xl tracking-widest text-[rgba(240,239,235,0.2)]">
                NO MUSICIANS NEARBY YET
              </p>
              <p className="text-xs text-[rgba(240,239,235,0.3)]">Be the first to show up on the map.</p>
              <button
                onClick={() => router.push('/explore')}
                className="rounded-full border border-[rgba(255,92,0,0.3)] px-4 py-1.5 text-xs text-[rgba(255,92,0,0.7)] transition-colors hover:text-[#FF5C00]"
              >
                Browse all →
              </button>
            </div>
          </motion.div>
        )}
        {musicians.length > 0 && (
          <motion.div variants={fadeUp} className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span style={{ width: 18, height: 2, borderRadius: 1, background: '#FF5C00', opacity: 0.65, flexShrink: 0 }} />
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[rgba(240,239,235,0.4)]">
                  Musicians near you
                </p>
              </div>
              <button
                onClick={() => router.push('/explore')}
                className="flex items-center gap-1 rounded-full border border-[rgba(255,92,0,0.2)] bg-[rgba(255,92,0,0.06)] px-2.5 py-1 text-[10px] font-medium text-[rgba(255,92,0,0.75)] transition-all hover:border-[rgba(255,92,0,0.4)] hover:bg-[rgba(255,92,0,0.10)] hover:text-[#FF5C00]"
              >
                See all →
              </button>
            </div>

            <div style={{ padding: '10px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex gap-2.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
                {musicians.slice(0, 6).map((m) => {
                  const active = isActiveToday(m.last_active)
                  const initials2 = (m.display_name ?? '?').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
                  return (
                    <button
                      key={m.id}
                      onClick={() => router.push(`/profile/${m.id}`)}
                      className="flex-shrink-0 flex flex-col items-center gap-1.5 p-3 text-center transition-all duration-200 active:scale-95"
                      style={{
                        width: 96,
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.09)',
                        borderTopColor: 'rgba(255,255,255,0.15)',
                        borderRadius: 14,
                      }}
                    >
                      <div style={{ position: 'relative' }}>
                        {m.avatar_url ? (
                          <Image src={m.avatar_url} alt={m.display_name ?? ''} width={54} height={54}
                            style={{ width: 54, height: 54, borderRadius: '50%', objectFit: 'cover',
                              border: active ? '2px solid #FF5C00' : '2px solid rgba(240,239,235,0.1)',
                              boxShadow: active ? '0 0 10px rgba(255,92,0,0.35)' : 'none' }} />
                        ) : (
                          <div className="flex items-center justify-center"
                            style={{ width: 54, height: 54, borderRadius: '50%', background: 'rgba(255,255,255,0.06)',
                              border: active ? '2px solid #FF5C00' : '2px solid rgba(240,239,235,0.1)',
                              fontSize: 20 }}>
                            {INSTRUMENT_EMOJI[m.instruments[0]] ?? '🎵'}
                          </div>
                        )}
                        {active && (
                          <span style={{ position: 'absolute', bottom: 2, right: 2, width: 9, height: 9,
                            borderRadius: '50%', background: '#22c55e', border: '1.5px solid #0D0D0D',
                            boxShadow: '0 0 4px rgba(34,197,94,0.6)' }} />
                        )}
                      </div>
                      <p className="w-full truncate text-[11px] font-semibold text-[rgba(240,239,235,0.88)]">
                        {(m.display_name ?? initials2).split(' ')[0]}
                      </p>
                      <p className="text-[9px] text-[rgba(240,239,235,0.35)] leading-tight">
                        {m.instruments[0] ? m.instruments[0].toUpperCase() : ''}
                        {m.distance_km != null ? ` · ${Math.round(m.distance_km)}km` : m.city ? ` · ${m.city}` : ''}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Your Bands ── */}
        <motion.div variants={fadeUp} className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span style={{ width: 18, height: 2, borderRadius: 1, background: '#FF5C00', opacity: 0.65, flexShrink: 0 }} />
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[rgba(240,239,235,0.4)]">
                Your bands
              </p>
            </div>
            <button
              onClick={() => router.push('/bands')}
              className="flex items-center gap-1 rounded-full border border-[rgba(255,92,0,0.2)] bg-[rgba(255,92,0,0.06)] px-2.5 py-1 text-[10px] font-medium text-[rgba(255,92,0,0.75)] transition-all hover:border-[rgba(255,92,0,0.4)] hover:bg-[rgba(255,92,0,0.10)] hover:text-[#FF5C00]"
            >
              {myBands.length > 0 ? 'Show more →' : 'Create a band →'}
            </button>
          </div>
          {myBands.length > 0 ? (
            <div className="flex flex-col gap-2">
              {myBands.slice(0, 3).map((b) => (
                <button
                  key={b.id}
                  onClick={() => router.push(`/bands/${b.id}`)}
                  className="glass-apple flex w-full items-center gap-3 px-4 py-3.5 text-left"
                >
                  <Avatar
                    src={b.avatar_url}
                    alt={b.name}
                    size={36}
                    shape="rounded"
                    radius={12}
                    border={b.avatar_url ? undefined : '1px solid rgba(255,92,0,0.15)'}
                    background="rgba(255,92,0,0.10)"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,92,0,0.8)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-[13px] leading-tight text-[#F0EFEB]"
                      style={{ fontFamily: 'var(--font-bebas)', letterSpacing: '0.05em' }}>
                      {b.name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[rgba(240,239,235,0.38)]">
                      {b.memberCount} member{b.memberCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {b.unreadCount > 0 && (
                    <span className="flex-shrink-0 rounded-full bg-[rgba(255,85,0,0.12)] px-2.5 py-1 text-[10px] font-semibold text-[#FF5500]">
                      {b.unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <button
              onClick={() => router.push('/bands/new')}
              className="glass-apple flex w-full items-center gap-3 px-4 py-3.5 text-left"
            >
              <div
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
                style={{ background: 'rgba(255,92,0,0.10)', border: '1px solid rgba(255,92,0,0.15)' }}
              >
                <span className="text-base">🎸</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-[#F0EFEB]">Form a band</p>
                <p className="mt-0.5 text-[11px] text-[rgba(240,239,235,0.38)]">Turn a conversation into a group chat</p>
              </div>
            </button>
          )}
        </motion.div>

        {/* ── Rehearsal spaces ── */}
        <motion.div variants={fadeUp} className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span style={{ width: 18, height: 2, borderRadius: 1, background: '#FF5C00', opacity: 0.65, flexShrink: 0 }} />
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[rgba(240,239,235,0.4)]">
                Rehearsal spaces
              </p>
            </div>
            <button
              onClick={() => router.push('/spaces')}
              className="flex items-center gap-1 rounded-full border border-[rgba(255,92,0,0.2)] bg-[rgba(255,92,0,0.06)] px-2.5 py-1 text-[10px] font-medium text-[rgba(255,92,0,0.75)] transition-all hover:border-[rgba(255,92,0,0.4)] hover:bg-[rgba(255,92,0,0.10)] hover:text-[#FF5C00]"
            >
              Show more →
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {spaces.map((s) => (
              <div
                key={s.name}
                className="glass-apple flex items-center gap-3 px-4 py-3.5"
              >
                <div
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
                  style={{ background: 'rgba(255,92,0,0.10)', border: '1px solid rgba(255,92,0,0.15)' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,92,0,0.8)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-[13px] leading-tight text-[#F0EFEB]"
                    style={{ fontFamily: 'var(--font-bebas)', letterSpacing: '0.05em' }}>
                    {s.name}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[rgba(240,239,235,0.38)]">{s.area}</p>
                </div>
                <span className="flex-shrink-0 rounded-full bg-[rgba(255,85,0,0.12)] px-2.5 py-1 text-[10px] font-semibold text-[#FF5500]">
                  {s.price}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Rehearsal spaces map ── */}
        <motion.div variants={fadeUp} className="mt-2 mb-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span style={{ width: 18, height: 2, borderRadius: 1, background: '#FF5C00', opacity: 0.65, flexShrink: 0 }} />
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[rgba(240,239,235,0.4)]">Map</p>
            </div>
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
          <div className="mb-3 flex items-center gap-2">
            <span style={{ width: 18, height: 2, borderRadius: 1, background: '#FF5C00', opacity: 0.65, flexShrink: 0 }} />
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[rgba(240,239,235,0.4)]">
              Events near you
            </p>
          </div>
          <div className="glass-apple px-4 py-3.5">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-xl"
                style={{ background: 'rgba(255,92,0,0.10)', border: '1px solid rgba(255,92,0,0.15)' }}
              >
                🎸
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-[#F0EFEB]">Sondar Open Jam</p>
                <p className="text-[11px] text-[rgba(240,239,235,0.38)] mt-0.5">Madrid · Coming soon</p>
              </div>
              <span className="flex-shrink-0 rounded-full border border-[rgba(240,239,235,0.1)] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider text-[rgba(240,239,235,0.3)]">
                Soon
              </span>
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
                if (fresh) setProfile(fresh as ProfileRow)
              }
            }}
          />
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  )
}
