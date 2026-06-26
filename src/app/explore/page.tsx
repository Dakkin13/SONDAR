'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import type { NearbyMusician } from '@/types'
import BottomNav from '@/components/ui/BottomNav'
import { useToast } from '@/components/ui/Toast'

const DEFAULT_LAT = 40.4168
const DEFAULT_LNG = -3.7038

const INSTRUMENT_EMOJI: Record<string, string> = {
  guitar: '🎸', bass: '🎸', drums: '🥁', keys: '🎹', piano: '🎹',
  violin: '🎻', cello: '🎻', trumpet: '🎺', saxophone: '🎷', flute: '🪈',
  vocals: '🎤', producer: '🎚️', dj: '🎧', other: '🎵',
}

const OBJECTIVE_OPTIONS = [
  { value: '', label: 'Any objective' },
  { value: 'jam', label: 'Jam sessions' },
  { value: 'band', label: 'Start a band' },
  { value: 'record', label: 'Record music' },
  { value: 'teach', label: 'Teaching' },
  { value: 'learn', label: 'Learning' },
  { value: 'collab', label: 'Collaborate' },
]

const INSTRUMENT_OPTIONS = [
  { value: '', label: 'Any instrument' },
  { value: 'guitar', label: 'Guitar' },
  { value: 'bass', label: 'Bass' },
  { value: 'drums', label: 'Drums' },
  { value: 'keys', label: 'Keys / Piano' },
  { value: 'violin', label: 'Violin' },
  { value: 'cello', label: 'Cello' },
  { value: 'trumpet', label: 'Trumpet' },
  { value: 'saxophone', label: 'Saxophone' },
  { value: 'flute', label: 'Flute' },
  { value: 'vocals', label: 'Vocals' },
  { value: 'producer', label: 'Producer' },
  { value: 'dj', label: 'DJ' },
  { value: 'other', label: 'Other' },
]

function fuzzyLocation(lat: number, lng: number): { lat: number; lng: number } {
  const jitter = () => (Math.random() - 0.5) * 0.01
  return { lat: lat + jitter(), lng: lng + jitter() }
}

function isActiveToday(lastActive: string | null): boolean {
  if (!lastActive) return false
  const d = new Date(lastActive)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

function isNewMusician(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  return new Date(createdAt) >= sevenDaysAgo
}

function formatLastSeen(lastActive: string | null): string {
  if (!lastActive) return 'Offline'
  const d = new Date(lastActive)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 5) return 'LIVE'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  const diffWeeks = Math.floor(diffDays / 7)
  if (diffWeeks < 5) return `${diffWeeks}w ago`
  return 'Offline'
}

const PAGE_SIZE = 12

// ── Skeleton card ──────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="glass animate-pulse rounded-2xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-12 w-12 shrink-0 rounded-full bg-[rgba(240,239,235,0.06)]" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-24 rounded bg-[rgba(240,239,235,0.06)]" />
          <div className="h-2 w-16 rounded bg-[rgba(240,239,235,0.04)]" />
        </div>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        <div className="h-5 w-14 rounded-full bg-[rgba(255,85,0,0.08)]" />
        <div className="h-5 w-12 rounded-full bg-[rgba(240,239,235,0.05)]" />
        <div className="h-5 w-16 rounded-full bg-[rgba(240,239,235,0.05)]" />
      </div>
    </div>
  )
}

// ── Profile card (backstage pass aesthetic) ────────────────────────────────────
function MusicianProfileCard({
  musician: m,
  index,
  connectedIds,
  currentUserId,
  userInstruments,
  onMessage,
}: {
  musician: NearbyMusician
  index: number
  connectedIds: Set<string>
  currentUserId: string | null
  userInstruments: string[]
  onMessage: (id: string) => void
}) {
  const active = isActiveToday(m.last_active)
  const isNew = isNewMusician(m.created_at)
  const isConnected = connectedIds.has(m.id)
  const isOwnCard = currentUserId !== null && currentUserId === m.id
  const primaryInstrument = m.instruments?.[0] ?? ''
  const sharedInstruments = isOwnCard ? [] : (m.instruments ?? []).filter(i => userInstruments.includes(i))

  // Build ordered photo list: avatar first, then extras
  const allPhotos = [
    ...(m.avatar_url ? [m.avatar_url] : []),
    ...(m.photo_urls ?? []).filter((u) => u && u !== m.avatar_url),
  ]
  const hasMultiple = allPhotos.length > 1

  const [photoIndex, setPhotoIndex] = useState(0)
  const [hovered, setHovered] = useState(false)

  const currentPhoto = allPhotos[photoIndex] ?? null

  function prevPhoto(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setPhotoIndex((i) => (i - 1 + allPhotos.length) % allPhotos.length)
  }
  function nextPhoto(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setPhotoIndex((i) => (i + 1) % allPhotos.length)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: Math.min(index * 0.06, 0.5), ease: [0.25, 0.46, 0.45, 0.94] }}
      className="overflow-hidden rounded-2xl"
      style={{
        background: 'rgba(10,10,10,0.92)',
        border: '1px solid rgba(240,239,235,0.08)',
        boxShadow: active ? '0 0 20px rgba(255,92,0,0.10)' : 'none',
      }}
    >
      <Link
        href={`/profile/${m.id}`}
        className="block transition-transform duration-200 hover:scale-[1.012]"
      >
        {/* Card header: SONDAR label + badges */}
        <div className="flex items-start justify-between px-3 pt-3 pb-2">
          <div className="flex items-center gap-2">
            <div>
              <p className="text-[13px] leading-none tracking-[0.10em] text-[#F0EFEB]"
                style={{ fontFamily: 'var(--font-bebas)' }}>SONDAR</p>
              <div className="mt-1 h-px w-8 bg-[#FF5C00]" />
            </div>
            {isOwnCard && (
              <span
                className="rounded-full px-1.5 py-0.5 text-[6px] font-semibold tracking-[0.15em]"
                style={{ background: 'rgba(240,239,235,0.10)', border: '1px solid rgba(240,239,235,0.2)', color: 'rgba(240,239,235,0.6)', lineHeight: 1.4 }}
              >
                YOU
              </span>
            )}
            {isNew && !isOwnCard && (
              <span
                className="rounded-full px-1.5 py-0.5 text-[6px] font-semibold tracking-[0.15em] text-black"
                style={{ background: '#FF5C00', lineHeight: 1.4 }}
              >
                NEW
              </span>
            )}
            {isConnected && (
              <span
                className="rounded-full px-1.5 py-0.5 text-[6px] tracking-[0.12em]"
                style={{
                  background: 'rgba(184,255,0,0.12)',
                  border: '1px solid rgba(184,255,0,0.3)',
                  color: '#B8FF00',
                  lineHeight: 1.4,
                }}
              >
                ⚡ CONNECTED
              </span>
            )}
            {sharedInstruments.length > 0 && (
              <span
                className="rounded-full px-1.5 py-0.5 text-[6px] tracking-[0.12em]"
                style={{
                  background: 'rgba(255,85,0,0.15)',
                  border: '1px solid rgba(255,85,0,0.35)',
                  color: '#FF5C00',
                  lineHeight: 1.4,
                }}
              >
                🎵 {sharedInstruments[0].toUpperCase()}
              </span>
            )}
          </div>
          {active ? (
            <div className="flex items-center gap-1 rounded-full border border-[#B8FF00] px-2 py-0.5 opacity-90">
              <span className="h-1.5 w-1.5 rounded-full bg-[#B8FF00]" />
              <span className="text-[6px] tracking-[0.15em] text-[#B8FF00]">LIVE</span>
            </div>
          ) : (
            <span className="text-[6.5px] tracking-[0.14em] text-[rgba(240,239,235,0.25)]">
              {formatLastSeen(m.last_active)}
            </span>
          )}
        </div>

        {/* Avatar zone with corner brackets + photo nav */}
        <div
          className="relative mx-3 h-[260px] overflow-hidden rounded-lg bg-[#080808]"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <span className="absolute left-1.5 top-1.5 z-10 block h-2.5 w-2.5 border-l border-t border-[rgba(240,239,235,0.2)]" />
          <span className="absolute right-1.5 top-1.5 z-10 block h-2.5 w-2.5 border-r border-t border-[rgba(240,239,235,0.2)]" />
          <span className="absolute bottom-1.5 left-1.5 z-10 block h-2.5 w-2.5 border-b border-l border-[rgba(240,239,235,0.2)]" />
          <span className="absolute bottom-1.5 right-1.5 z-10 block h-2.5 w-2.5 border-b border-r border-[rgba(240,239,235,0.2)]" />

          {/* Glow */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-16 w-16 rounded-full bg-[#FF5C00] opacity-20 blur-2xl" />
          </div>

          {currentPhoto ? (
            <img
              src={currentPhoto}
              alt={m.display_name ?? 'Musician'}
              className="absolute inset-0 h-full w-full object-cover opacity-90 transition-opacity duration-200"
            />
          ) : (
            <svg className="absolute inset-0 m-auto" width="64" height="78" viewBox="0 0 96 116" fill="none" aria-hidden>
              <defs>
                <linearGradient id={`silFill-${m.id}`} x1="48" y1="0" x2="48" y2="116" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="rgba(255,130,0,0.7)" />
                  <stop offset="100%" stopColor="rgba(255,55,0,0.35)" />
                </linearGradient>
              </defs>
              <circle cx="48" cy="26" r="17" fill={`url(#silFill-${m.id})`} />
              <path d="M12 98Q12 60 48 60Q84 60 84 98L84 116L12 116Z" fill={`url(#silFill-${m.id})`} />
              <line x1="12" y1="75" x2="2" y2="63" stroke={`url(#silFill-${m.id})`} strokeWidth="7" strokeLinecap="round" />
              <line x1="84" y1="75" x2="94" y2="63" stroke={`url(#silFill-${m.id})`} strokeWidth="7" strokeLinecap="round" />
            </svg>
          )}

          {/* Photo navigation arrows — visible on hover when multiple photos */}
          {hasMultiple && hovered && (
            <>
              <button
                type="button"
                onClick={prevPhoto}
                className="absolute left-2 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-white transition-opacity"
                style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
                aria-label="Previous photo"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M9 2L4 7l5 5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                type="button"
                onClick={nextPhoto}
                className="absolute right-2 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-white transition-opacity"
                style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
                aria-label="Next photo"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M5 2l5 5-5 5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {/* Dot indicators */}
              <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 gap-1">
                {allPhotos.map((_, i) => (
                  <span
                    key={i}
                    className="block rounded-full transition-all duration-150"
                    style={{
                      width: i === photoIndex ? 14 : 5,
                      height: 5,
                      background: i === photoIndex ? '#FF5C00' : 'rgba(240,239,235,0.4)',
                    }}
                  />
                ))}
              </div>
            </>
          )}

          {/* Bottom overlays */}
          <p className="absolute bottom-1.5 left-2 z-10 text-[6.5px] tracking-widest text-[rgba(240,239,235,0.3)]">
            {m.city ? m.city.toUpperCase() : '·'}
          </p>
          {primaryInstrument && (
            <p className="absolute bottom-1.5 right-2 z-10 text-[6.5px] tracking-widest text-[#FF5C00]">
              {primaryInstrument.toUpperCase()}
            </p>
          )}
        </div>

        {/* Name + meta */}
        <div className="px-3 pt-2.5 pb-3">
          <h3
            className="truncate text-[22px] leading-none tracking-[0.04em] text-[#F0EFEB]"
            style={{ fontFamily: 'var(--font-bebas)' }}
          >
            {(m.display_name ?? 'ANONYMOUS').toUpperCase()}
          </h3>
          {m.distance_km != null && (
            <p className="mt-1">
              <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(255,255,255,0.06)] px-2 py-0.5 text-[10px] font-medium text-[rgba(240,239,235,0.5)]">
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#FF5C00', display: 'inline-block', opacity: 0.7 }} />
                {m.distance_km < 1 ? `${Math.round(m.distance_km * 1000)} m away` : `${m.distance_km.toFixed(1)} km away`}
              </span>
            </p>
          )}

          {/* Instrument + genre chips */}
          <div className="mt-2 flex flex-wrap gap-1">
            {(m.instruments ?? []).slice(0, 2).map((inst) => (
              <span
                key={inst}
                className="rounded-full px-2 py-0.5 text-[8px] font-semibold tracking-wider text-black"
                style={{ background: '#FF5C00' }}
              >
                {inst.toUpperCase()}
              </span>
            ))}
            {(m.genres ?? []).slice(0, 2).map((g) => (
              <span
                key={g}
                className="rounded-full px-2 py-0.5 text-[8px] tracking-wider text-[rgba(240,239,235,0.55)]"
                style={{ border: '1px solid rgba(240,239,235,0.12)' }}
              >
                {g.toUpperCase()}
              </span>
            ))}
          </div>

          {/* Stats row */}
          <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-[rgba(240,239,235,0.05)] pt-2">
            {m.city && (
              <span className="rounded-full bg-[rgba(255,255,255,0.05)] px-2.5 py-0.5 text-[9px] text-[rgba(240,239,235,0.45)]">
                📍 {m.city}
              </span>
            )}
            {m.objective && (
              <span className="rounded-full bg-[rgba(255,255,255,0.05)] px-2.5 py-0.5 text-[9px] text-[rgba(240,239,235,0.45)]">
                🎯 {m.objective}
              </span>
            )}
          </div>

          {/* Influences row */}
          {(m.influences?.length ?? 0) > 0 && (
            <div className="mt-2 flex flex-wrap gap-1 border-t border-[rgba(240,239,235,0.04)] pt-2">
              <span className="self-center text-[8px] tracking-wider text-[rgba(240,239,235,0.25)] uppercase mr-0.5">likes</span>
              {m.influences!.slice(0, 3).map((artist) => (
                <span
                  key={artist}
                  className="rounded-full px-2 py-0.5 text-[8px] text-[rgba(240,239,235,0.5)]"
                  style={{ border: '1px solid rgba(255,92,0,0.18)', background: 'rgba(255,92,0,0.05)' }}
                >
                  {artist}
                </span>
              ))}
              {(m.influences!.length > 3) && (
                <span className="text-[8px] text-[rgba(240,239,235,0.25)] self-center">+{m.influences!.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </Link>

      {/* Message CTA — only show for other users, not own card */}
      {!isOwnCard && currentUserId && (
        <div className="px-3 pb-3">
          <button
            onClick={(e) => { e.stopPropagation(); onMessage(m.id) }}
            onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); onMessage(m.id) }}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[11px] font-semibold tracking-[0.08em] transition-all duration-150"
            style={
              isConnected
                ? {
                    background: 'rgba(255,92,0,0.18)',
                    border: '1px solid rgba(255,92,0,0.45)',
                    color: '#FF5C00',
                  }
                : {
                    background: '#FF5C00',
                    border: '1px solid rgba(255,92,0,0.6)',
                    color: '#000',
                    boxShadow: '0 0 14px rgba(255,92,0,0.25)',
                  }
            }
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {isConnected ? 'CONTINUE CHAT' : 'SEND MESSAGE'}
          </button>
        </div>
      )}
    </motion.div>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────────
function EmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6 py-24 text-center">
      {/* Sondar SVG logo mark */}
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" aria-hidden>
        <circle cx="40" cy="40" r="38" stroke="rgba(240,239,235,0.06)" strokeWidth="1.5" />
        <circle cx="32" cy="40" r="14" stroke="rgba(255,92,0,0.35)" strokeWidth="1.5" />
        <circle cx="48" cy="40" r="14" stroke="rgba(91,33,182,0.35)" strokeWidth="1.5" />
        <circle cx="40" cy="40" r="3" fill="rgba(240,239,235,0.3)" />
        <line x1="40" y1="8" x2="40" y2="14" stroke="rgba(240,239,235,0.15)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="40" y1="66" x2="40" y2="72" stroke="rgba(240,239,235,0.15)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="8" y1="40" x2="14" y2="40" stroke="rgba(240,239,235,0.15)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="66" y1="40" x2="72" y2="40" stroke="rgba(240,239,235,0.15)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <div>
        <p className="text-[rgba(240,239,235,0.5)] text-sm">
          {hasFilters ? 'No musicians match these filters.' : 'No musicians found in this area yet.'}
        </p>
        <p className="text-xs text-[rgba(240,239,235,0.25)] mt-1">
          Be the first to show up on the map.
        </p>
      </div>
      {hasFilters && (
        <button
          onClick={onClear}
          className="rounded-full border border-[rgba(240,239,235,0.12)] px-4 py-2 text-sm text-[rgba(240,239,235,0.55)] transition-colors hover:text-[#F0EFEB]"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function ExplorePage() {
  const { toast } = useToast()
  const router = useRouter()
  const [musicians, setMusicians] = useState<NearbyMusician[]>([])
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set())
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [userInstruments, setUserInstruments] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [instrument, setInstrument] = useState('')
  const [objective, setObjective] = useState('')
  const [activeOnly, setActiveOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const lastFetchLatRef = useRef(DEFAULT_LAT)
  const lastFetchLngRef = useRef(DEFAULT_LNG)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pullStartYRef = useRef(0)

  // ── Data fetching ────────────────────────────────────────────────────────────
  const fetchMusicians = useCallback(async (lat: number, lng: number, silent = false) => {
    if (!silent) setLoading(true)
    lastFetchLatRef.current = lat
    lastFetchLngRef.current = lng
    const supabase = createClient()

    const { data: rpcData, error: rpcError } = await supabase
      .rpc('get_nearby_musicians', { user_lat: lat, user_lng: lng, radius_km: 100 })

    if (!rpcError && rpcData && rpcData.length > 0) {
      // RPC doesn't include influences — fetch it separately and merge
      const ids = (rpcData as { id: string }[]).map((m) => m.id)
      const { data: influencesRows } = await supabase
        .from('profiles')
        .select('id, influences')
        .in('id', ids)
      const influencesMap = new Map(
        (influencesRows ?? []).map((r) => [r.id, (r.influences as string[] | null)])
      )
      const merged = (rpcData as NearbyMusician[]).map((m) => ({
        ...m,
        influences: influencesMap.get(m.id) ?? null,
      }))
      setMusicians(merged)
      setPage(0)
      setLoading(false)
      setRefreshing(false)
      return
    }

    // Fallback: direct profiles query when RPC fails or returns nothing
    const { data: fallbackData } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, photo_urls, instruments, genres, objective, bio, city, last_active, created_at, influences')
      .eq('is_onboarded', true)
      .eq('is_archived', false)
      .limit(60)

    if (fallbackData && fallbackData.length > 0) {
      const withCoords = fallbackData.map((p, i) => ({
        ...p,
        lat: DEFAULT_LAT + (i % 5) * 0.008,
        lng: DEFAULT_LNG + Math.floor(i / 5) * 0.012,
        distance_km: i * 0.3,
      }))
      setMusicians(withCoords as NearbyMusician[])
      setPage(0)
    }

    setLoading(false)
    setRefreshing(false)
  }, [])

  // ── On mount ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setCurrentUserId(user.id)
      void supabase.rpc('touch_last_active')
      supabase.from('profiles').select('instruments').eq('id', user.id).single()
        .then(({ data }) => setUserInstruments((data?.instruments as string[]) ?? []))

      // Fetch conversation partners (users this person has exchanged messages with)
      const [{ data: sent }, { data: received }] = await Promise.all([
        supabase
          .from('messages')
          .select('to_id')
          .eq('from_id', user.id),
        supabase
          .from('messages')
          .select('from_id')
          .eq('to_id', user.id),
      ])
      const ids = new Set<string>()
      ;(sent ?? []).forEach((r) => ids.add(r.to_id))
      ;(received ?? []).forEach((r) => ids.add(r.from_id))
      setConnectedIds(ids)
    })

    // Fetch immediately — don't wait for geolocation
    void fetchMusicians(DEFAULT_LAT, DEFAULT_LNG)

    navigator.geolocation?.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        const fuzz = fuzzyLocation(lat, lng)
        const supabaseForLocation = createClient()
        const { data: { user } } = await supabaseForLocation.auth.getUser()
        if (user) {
          void supabaseForLocation.rpc('set_user_location', {
            user_id: user.id,
            lat: fuzz.lat,
            lng: fuzz.lng,
          })
        }
        void fetchMusicians(fuzz.lat, fuzz.lng)
      },
      () => {
        toast('Enable location for better results — using your profile city instead.', 'default')
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Reset page when filters change ──────────────────────────────────────────
  useEffect(() => {
    setPage(0)
  }, [instrument, objective, activeOnly, search])

  // ── Pull-to-refresh ──────────────────────────────────────────────────────────
  function handleTouchStart(e: React.TouchEvent) {
    pullStartYRef.current = e.touches[0].clientY
  }
  function handleTouchEnd(e: React.TouchEvent) {
    const delta = e.changedTouches[0].clientY - pullStartYRef.current
    if (delta > 60 && !refreshing && scrollRef.current?.scrollTop === 0) {
      setRefreshing(true)
      void fetchMusicians(lastFetchLatRef.current, lastFetchLngRef.current, true)
    }
  }

  // ── Client-side filtering ────────────────────────────────────────────────────
  const allFiltered = musicians.filter((m) => {
    if (instrument && !(m.instruments ?? []).includes(instrument as never)) return false
    if (objective && m.objective !== objective) return false
    if (activeOnly && !isActiveToday(m.last_active)) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      const nameMatch = (m.display_name ?? '').toLowerCase().includes(q)
      const cityMatch = (m.city ?? '').toLowerCase().includes(q)
      if (!nameMatch && !cityMatch) return false
    }
    return true
  })

  const visibleCount = (page + 1) * PAGE_SIZE
  const filtered = allFiltered.slice(0, visibleCount)
  const canLoadMore = allFiltered.length > visibleCount

  const hasFilters = !!(instrument || objective || activeOnly || search.trim())

  function clearFilters() {
    setInstrument('')
    setObjective('')
    setActiveOnly(false)
    setSearch('')
    setPage(0)
  }

  function loadMore() {
    setPage((p) => p + 1)
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="relative bg-[#0D0D0D]" style={{ minHeight: '100dvh' }}>
      {/* Ambient orbs */}
      <div
        aria-hidden
        className="pointer-events-none fixed right-0 top-0"
        style={{
          zIndex: -1,
          width: 640,
          height: 640,
          background: 'radial-gradient(circle at top right, rgba(255,85,0,0.16) 0%, transparent 65%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed bottom-0 left-0"
        style={{
          zIndex: -1,
          width: 520,
          height: 520,
          background: 'radial-gradient(circle at bottom left, rgba(91,33,182,0.14) 0%, transparent 65%)',
        }}
      />

      {/* ── Fixed top bar ── */}
      <div className="fixed left-0 right-0 top-0 z-20 px-3 pt-3 sm:px-4 sm:pt-4">
        <div
          className="glass flex min-w-0 flex-col gap-2.5 rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3"
          style={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
        >
          {/* Row 1: wordmark + active toggle + count */}
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="flex-shrink-0 text-[22px] leading-none tracking-[0.08em] text-[#F0EFEB]"
              style={{ fontFamily: 'var(--font-bebas)' }}
            >
              SONDAR
            </Link>
            <div className="flex flex-1 items-center justify-end gap-2 min-w-0">
              <button
                onClick={() => setActiveOnly((v) => !v)}
                className="shrink-0 rounded-xl border px-2.5 py-1 text-[10px] font-medium transition-all duration-150"
                style={
                  activeOnly
                    ? { borderColor: 'rgba(184,255,0,0.4)', background: 'rgba(184,255,0,0.10)', color: '#B8FF00' }
                    : { borderColor: 'rgba(240,239,235,0.10)', background: 'rgba(240,239,235,0.05)', color: 'rgba(240,239,235,0.55)' }
                }
              >
                Active today
              </button>
              <span className="shrink-0 text-[11px] text-[rgba(240,239,235,0.35)]">
                {loading ? '…' : `${allFiltered.length} musician${allFiltered.length !== 1 ? 's' : ''}`}
              </span>
            </div>
          </div>

          {/* Row 2: search */}
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
              width={13} height={13} viewBox="0 0 24 24" fill="none"
              stroke="rgba(240,239,235,0.35)" strokeWidth={2.2} strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or city…"
              className="w-full rounded-xl border border-[rgba(240,239,235,0.10)] bg-[rgba(240,239,235,0.05)] py-1.5 pl-8 pr-3 text-[11px] text-[rgba(240,239,235,0.8)] placeholder-[rgba(240,239,235,0.3)] outline-none focus:border-[rgba(255,92,0,0.4)]"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgba(240,239,235,0.3)] hover:text-[#F0EFEB]"
                style={{ fontSize: 14, lineHeight: 1 }}
              >×</button>
            )}
          </div>

          {/* Row 3: instrument + objective dropdowns + clear */}
          <div className="flex items-center gap-2">
            <select
              value={instrument}
              onChange={(e) => setInstrument(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-[rgba(240,239,235,0.10)] bg-[rgba(240,239,235,0.05)] px-2.5 py-1.5 text-[11px] text-[rgba(240,239,235,0.7)] outline-none focus:border-[rgba(255,92,0,0.4)]"
              style={{ appearance: 'none' }}
            >
              {INSTRUMENT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[#1A1A1A] text-[#F0EFEB]">
                  {opt.label}
                </option>
              ))}
            </select>

            <select
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-[rgba(240,239,235,0.10)] bg-[rgba(240,239,235,0.05)] px-2.5 py-1.5 text-[11px] text-[rgba(240,239,235,0.7)] outline-none focus:border-[rgba(255,92,0,0.4)]"
              style={{ appearance: 'none' }}
            >
              {OBJECTIVE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[#1A1A1A] text-[#F0EFEB]">
                  {opt.label}
                </option>
              ))}
            </select>

            {hasFilters && (
              <button
                onClick={clearFilters}
                className="shrink-0 rounded-xl border border-[rgba(240,239,235,0.10)] bg-transparent px-2.5 py-1.5 text-[11px] text-[rgba(240,239,235,0.4)] transition-colors hover:text-[#F0EFEB]"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Scrollable card grid ── */}
      <div
        ref={scrollRef}
        className="px-3 pb-[calc(64px+env(safe-area-inset-bottom,0px)+16px)] sm:px-4"
        style={{ paddingTop: 'calc(178px + env(safe-area-inset-top, 0px))' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Pull-to-refresh spinner */}
        {refreshing && (
          <div className="mb-4 flex justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[rgba(240,239,235,0.12)] border-t-[#FF5500]" />
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : allFiltered.length === 0 ? (
          <EmptyState hasFilters={hasFilters} onClear={clearFilters} />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((m, i) => (
                <MusicianProfileCard key={m.id} musician={m} index={i} connectedIds={connectedIds} currentUserId={currentUserId} userInstruments={userInstruments} onMessage={(id) => router.push(`/messages/${id}`)} />
              ))}
            </div>
            {canLoadMore && (
              <div className="mt-6 flex justify-center pb-2">
                <button
                  onClick={loadMore}
                  className="rounded-full border px-6 py-2.5 text-[11px] font-medium tracking-[0.10em] transition-all duration-150"
                  style={{
                    borderColor: 'rgba(255,92,0,0.35)',
                    background: 'rgba(255,92,0,0.07)',
                    color: '#FF5C00',
                    fontFamily: 'var(--font-bebas)',
                    fontSize: 13,
                  }}
                >
                  LOAD MORE
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Dev debug panel */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-[72px] right-3 z-50 rounded-lg bg-black/80 px-3 py-2 font-mono text-[10px] text-[rgba(240,239,235,0.7)] backdrop-blur-sm">
          <p>lat {lastFetchLatRef.current.toFixed(4)} lng {lastFetchLngRef.current.toFixed(4)}</p>
          <p className={musicians.length > 0 ? 'text-[#B8FF00]' : 'text-[#FF5500]'}>
            {musicians.length} loaded · {allFiltered.length} matched · {filtered.length} shown
          </p>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
