'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import type { Instrument, Genre, Objective } from '@/types'
import BottomNav from '@/components/ui/BottomNav'
import { useToast } from '@/components/ui/Toast'

async function fetchArtistThumb(name: string): Promise<string | null> {
  try {
    const r = await fetch(
      `https://www.theaudiodb.com/api/v1/json/2/search.php?s=${encodeURIComponent(name)}`,
      { signal: AbortSignal.timeout(4000) }
    )
    const d = await r.json()
    return (d?.artists?.[0]?.strArtistThumb as string) ?? null
  } catch {
    return null
  }
}

function ArtistChip({ name, imageUrl }: { name: string; imageUrl: string | null }) {
  const [imgFailed, setImgFailed] = useState(false)
  const showImg = imageUrl && !imgFailed

  return (
    <span
      className="flex items-center gap-2 rounded-full px-2 py-1"
      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
    >
      <span style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
        border: showImg ? '1px solid rgba(255,92,0,0.35)' : 'none',
        background: showImg ? 'transparent' : 'rgba(255,92,0,0.25)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        {showImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl!}
            alt={name}
            onError={() => setImgFailed(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
          />
        ) : (
          <span style={{ fontSize: 10, fontWeight: 700, color: '#FF5C00' }}>
            {name[0]?.toUpperCase()}
          </span>
        )}
      </span>
      <span style={{ fontSize: 11, color: 'rgba(240,239,235,0.85)', fontWeight: 500 }}>{name}</span>
    </span>
  )
}

interface ProfileData {
  id: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  instruments: Instrument[]
  genres: Genre[]
  objective: Objective | null
  level: string | null
  city: string | null
  audio_url: string | null
  instagram_url: string | null
  last_active: string | null
  photo_urls: string[]
  influences: string[] | null
  profile_views: number | null
  created_at: string | null
}

const INSTRUMENT_EMOJI: Record<string, string> = {
  guitar: '🎸', bass: '🎸', drums: '🥁', keys: '🎹', piano: '🎹',
  violin: '🎻', cello: '🎻', trumpet: '🎺', saxophone: '🎷', flute: '🪈',
  vocals: '🎤', producer: '🎚️', dj: '🎧', other: '🎵',
}

const OBJECTIVE_LABEL: Record<string, string> = {
  jam: 'Casual jam', 'form-band': 'Form a band',
  record: 'Studio sessions', 'perform-live': 'Live gigs',
  casual_jam: 'Casual jam', form_band: 'Form a band',
  studio_sessions: 'Studio sessions', live_gigs: 'Live gigs',
}

const LEVEL_LABEL: Record<string, string> = {
  beginner: 'Beginner', intermediate: 'Intermediate',
  advanced: 'Advanced', professional: 'Professional',
}

function formatLastActive(iso: string | null): string | null {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days < 1) return 'Active today'
  if (days < 7) return 'Active this week'
  return null
}

function getYouTubeEmbedUrl(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  return m ? `https://www.youtube.com/embed/${m[1]}` : null
}

function getSoundCloudEmbedUrl(url: string): string | null {
  if (!url.includes('soundcloud.com')) return null
  return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23FF5500&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`
}

type AudioType = 'youtube' | 'soundcloud' | 'instagram' | 'link' | null
function detectAudio(url: string | null): AudioType {
  if (!url) return null
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
  if (url.includes('soundcloud.com')) return 'soundcloud'
  if (url.includes('instagram.com')) return 'instagram'
  return 'link'
}

function shortId(id: string): string {
  return id.replace(/-/g, '').slice(0, 6).toUpperCase()
}

function isNewProfile(createdAt: string | null): boolean {
  if (!createdAt) return false
  return Date.now() - new Date(createdAt).getTime() < 7 * 86400000
}

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [distanceKm, setDistanceKm] = useState<number | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [influenceImages, setInfluenceImages] = useState<Record<string, string | null>>({})
  const fetchedRef = useRef(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id ?? null)

      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, bio, instruments, genres, objective, level, city, audio_url, instagram_url, last_active, photo_urls, influences, location, profile_views, created_at')
        .eq('id', id)
        .single()

      if (error || !data) { setNotFound(true) }
      else {
        setProfile(data as ProfileData)

        // Fetch artist thumbnails for influences in the background
        const influences = (data as ProfileData).influences ?? []
        if (influences.length > 0 && !fetchedRef.current) {
          fetchedRef.current = true
          void Promise.all(
            influences.map(async (artist) => {
              const url = await fetchArtistThumb(artist)
              setInfluenceImages(prev => ({ ...prev, [artist]: url }))
            })
          )
        }

        // Increment view counter — only if viewing someone else's profile
        if (user && user.id !== id) {
          void supabase.rpc('increment_profile_views', { profile_id: id })
        }
        // Compute approximate distance if we can get user's position and musician's location
        const loc = (data as Record<string, unknown>).location as { type?: string; coordinates?: [number, number] } | null
        if (loc?.type === 'Point' && Array.isArray(loc.coordinates) && loc.coordinates.length === 2) {
          const [mLng, mLat] = loc.coordinates
          navigator.geolocation?.getCurrentPosition(
            (pos) => {
              const R = 6371
              const dLat = (mLat - pos.coords.latitude) * Math.PI / 180
              const dLng = (mLng - pos.coords.longitude) * Math.PI / 180
              const a = Math.sin(dLat/2)**2 + Math.cos(pos.coords.latitude * Math.PI/180) * Math.cos(mLat * Math.PI/180) * Math.sin(dLng/2)**2
              setDistanceKm(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)))
            },
            () => {},
            { enableHighAccuracy: false, timeout: 5000, maximumAge: 600000 },
          )
        }
      }
      setLoading(false)
    }
    void load()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '100dvh', background: '#0D0D0D' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[rgba(240,239,235,0.12)] border-t-[#FF5500]" />
      </div>
    )
  }

  if (notFound || !profile) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 text-[#F0EFEB]" style={{ minHeight: '100dvh', background: '#0D0D0D' }}>
        <p className="font-[family-name:var(--font-bebas)] text-4xl tracking-widest text-[rgba(240,239,235,0.3)]">
          MUSICIAN NOT FOUND
        </p>
        <button onClick={() => router.push('/explore')}
          className="text-sm text-[rgba(240,239,235,0.4)] underline hover:text-[#F0EFEB]">
          ← Back to Explore
        </button>
      </div>
    )
  }

  const audioType    = detectAudio(profile.audio_url)
  const ytEmbed      = profile.audio_url ? getYouTubeEmbedUrl(profile.audio_url) : null
  const scEmbed      = profile.audio_url ? getSoundCloudEmbedUrl(profile.audio_url) : null
  const activeStatus = formatLastActive(profile.last_active)
  const initials     = (profile.display_name ?? '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  const igUrl        = profile.instagram_url ?? (audioType === 'instagram' ? profile.audio_url : null)
  const extUrl       = audioType === 'link' ? profile.audio_url : null
  const isNew        = isNewProfile(profile.created_at)
  const isOwnProfile = currentUserId === profile.id

  function handleShare() {
    const url = `${window.location.origin}/profile/${profile!.id}`
    if (navigator.share) {
      void navigator.share({ title: `${profile!.display_name ?? 'Musician'} on Sondar`, url }).catch(() => {})
    } else {
      void navigator.clipboard.writeText(url).then(() => toast('Profile link copied!', 'default'))
    }
  }

  function handleReport() {
    const subject = encodeURIComponent(`Report: ${profile!.id}`)
    const body = encodeURIComponent(`I want to report this profile:\nUser ID: ${profile!.id}\nName: ${profile!.display_name ?? 'Unknown'}\n\nReason:\n`)
    window.open(`mailto:hello@sondar.app?subject=${subject}&body=${body}`)
  }

  return (
    <div className="relative overflow-y-auto" style={{ minHeight: '100dvh', paddingBottom: 90, zIndex: 1, overflowX: 'clip' }}>

      {/* Ambient orbs */}
      <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: 500, height: 500,
          background: 'radial-gradient(circle at 80% 10%, rgba(255,92,0,0.18) 0%, transparent 60%)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: '10%', left: 0, width: 400, height: 400,
          background: 'radial-gradient(circle at 20% 80%, rgba(139,92,246,0.14) 0%, transparent 60%)', borderRadius: '50%' }} />
      </div>

      {/* Back button */}
      <button onClick={() => router.push('/explore')}
        className="absolute left-4 top-4 z-10 rounded-xl bg-[rgba(13,13,13,0.6)] px-3 py-2 text-sm font-medium text-[rgba(240,239,235,0.6)] backdrop-blur-md transition-colors hover:text-[#F0EFEB]"
        style={{ backdropFilter: 'blur(20px)' }}>
        ← Explore
      </button>

      {/* ── Main card ── */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto px-4 pt-16"
        style={{ maxWidth: 480 }}
      >
        {/* Profile card */}
        <div
          className="relative overflow-hidden rounded-2xl"
          style={{
            background: 'rgba(10,10,10,0.96)',
            border: '1px solid rgba(240,239,235,0.08)',
            boxShadow: '0 0 60px rgba(255,92,0,0.10), 0 24px 80px rgba(0,0,0,0.6)',
          }}
        >
          {/* Corner brackets */}
          <span className="absolute left-3 top-3 block h-4 w-4 border-l border-t border-[rgba(240,239,235,0.18)]" />
          <span className="absolute right-3 top-3 block h-4 w-4 border-r border-t border-[rgba(240,239,235,0.18)]" />
          <span className="absolute bottom-3 left-3 block h-4 w-4 border-b border-l border-[rgba(240,239,235,0.18)]" />
          <span className="absolute bottom-3 right-3 block h-4 w-4 border-b border-r border-[rgba(240,239,235,0.18)]" />

          {/* Card header strip */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div>
              <p className="text-[14px] leading-none tracking-[0.12em] text-[#F0EFEB]"
                style={{ fontFamily: 'var(--font-bebas)' }}>SONDAR</p>
              <p className="mt-0.5 text-[7px] tracking-[0.22em] text-[rgba(240,239,235,0.35)]">BACKSTAGE · ALL AREAS</p>
              <div className="mt-1.5 h-px w-8 bg-[#FF5C00]" />
            </div>
            <div className="flex items-center gap-2">
              {isNew && (
                <div className="flex items-center gap-1 rounded-full border border-[rgba(255,92,0,0.4)] bg-[rgba(255,92,0,0.12)] px-2 py-0.5">
                  <span className="text-[6.5px] font-bold tracking-[0.15em] text-[#FF5C00]">NEW</span>
                </div>
              )}
              {activeStatus && (
                <div className="flex items-center gap-1.5 rounded-full border border-[#B8FF00] px-2.5 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#B8FF00]" />
                  <span className="text-[7px] tracking-[0.15em] text-[#B8FF00] uppercase">{activeStatus}</span>
                </div>
              )}
            </div>
          </div>

          {/* Avatar section */}
          <div className="relative mx-4 mb-0 h-[160px] overflow-hidden rounded-xl bg-[#060606]">
            {profile.avatar_url && (
              <Image src={profile.avatar_url} alt="" aria-hidden fill
                className="object-cover"
                style={{ opacity: 0.15, filter: 'blur(20px)', transform: 'scale(1.1)' }} />
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              <div style={{ width: 80, height: 80, borderRadius: '50%',
                background: 'rgba(255,92,0,0.15)', position: 'absolute', filter: 'blur(30px)' }} />
              {profile.avatar_url ? (
                <Image src={profile.avatar_url} alt={profile.display_name ?? 'Musician'}
                  width={88} height={88}
                  style={{ borderRadius: '50%', objectFit: 'cover',
                    border: '2px solid rgba(255,92,0,0.6)',
                    boxShadow: '0 0 24px rgba(255,92,0,0.35)', position: 'relative', zIndex: 1 }} />
              ) : (
                <div className="flex items-center justify-center"
                  style={{ width: 88, height: 88, borderRadius: '50%', background: '#1a1a1a',
                    border: '2px solid rgba(255,92,0,0.5)', position: 'relative', zIndex: 1 }}>
                  <span className="font-[family-name:var(--font-bebas)] text-3xl tracking-widest text-[rgba(240,239,235,0.5)]">
                    {initials}
                  </span>
                </div>
              )}
            </div>
            <p className="absolute bottom-2 left-3 text-[7px] tracking-widest text-[rgba(240,239,235,0.3)]">
              ID # SDR-{shortId(profile.id)}
            </p>
            {profile.instruments?.[0] && (
              <p className="absolute bottom-2 right-3 text-[7px] tracking-widest text-[#FF5C00] uppercase">
                {profile.instruments[0]} · {LEVEL_LABEL[profile.level ?? ''] ?? profile.level ?? '—'}
              </p>
            )}
          </div>

          {/* Name & city */}
          <div className="px-5 pt-3 pb-2">
            <h1 className="text-[28px] leading-none tracking-[0.04em] text-[#F0EFEB]"
              style={{ fontFamily: 'var(--font-bebas)' }}>
              {profile.display_name ?? 'UNKNOWN ARTIST'}
            </h1>
            {profile.city && (
              <p className="mt-0.5 text-[9px] tracking-[0.14em] text-[rgba(240,239,235,0.38)] uppercase">{profile.city}</p>
            )}
          </div>

          {/* Tags row — instruments + genres compact */}
          {((profile.instruments?.length ?? 0) > 0 || (profile.genres?.length ?? 0) > 0) && (
            <div className="px-5 pb-3">
              <div className="flex flex-wrap gap-1.5">
                {profile.instruments?.slice(0, 3).map(inst => (
                  <span key={inst}
                    className="rounded-full px-2.5 py-0.5 text-[8px] font-semibold tracking-wider"
                    style={{ background: 'rgba(255,92,0,0.18)', color: '#FF5C00', border: '1px solid rgba(255,92,0,0.3)' }}>
                    {INSTRUMENT_EMOJI[inst] ?? ''} {inst.toUpperCase()}
                  </span>
                ))}
                {profile.genres?.slice(0, 4).map(g => (
                  <span key={g}
                    className="rounded-full px-2.5 py-0.5 text-[8px] tracking-wider capitalize"
                    style={{ border: '1px solid rgba(240,239,235,0.14)', color: 'rgba(240,239,235,0.6)' }}>
                    {g}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Stats grid */}
          <div className="mx-5 mb-3 grid grid-cols-3 gap-1 border-t border-[rgba(240,239,235,0.06)] pt-3">
            {profile.city && (
              <div>
                <p className="text-[6.5px] tracking-[0.18em] text-[rgba(240,239,235,0.28)] uppercase">City</p>
                <p className="mt-0.5 text-[9px] font-semibold tracking-wide text-[#F0EFEB] uppercase">{profile.city}</p>
              </div>
            )}
            {profile.objective && (
              <div>
                <p className="text-[6.5px] tracking-[0.18em] text-[rgba(240,239,235,0.28)] uppercase">Looking for</p>
                <p className="mt-0.5 text-[9px] font-semibold tracking-wide text-[#F0EFEB]">{OBJECTIVE_LABEL[profile.objective] ?? profile.objective}</p>
              </div>
            )}
            {profile.level && (
              <div>
                <p className="text-[6.5px] tracking-[0.18em] text-[rgba(240,239,235,0.28)] uppercase">Level</p>
                <p className="mt-0.5 text-[9px] font-semibold tracking-wide text-[#F0EFEB]">{LEVEL_LABEL[profile.level] ?? profile.level}</p>
              </div>
            )}
            {distanceKm !== null && (
              <div>
                <p className="text-[6.5px] tracking-[0.18em] text-[rgba(240,239,235,0.28)] uppercase">Distance</p>
                <p className="mt-0.5 text-[9px] font-semibold tracking-wide text-[#F0EFEB]">
                  ~{distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`}
                </p>
              </div>
            )}
          </div>

          {/* Bio */}
          {profile.bio && (
            <div className="mx-5 mb-3 border-t border-[rgba(240,239,235,0.06)] pt-3">
              <p className="text-[11px] leading-relaxed text-[rgba(240,239,235,0.6)]">{profile.bio}</p>
            </div>
          )}

          {/* Influences */}
          {(profile.influences?.length ?? 0) > 0 && (
            <div className="mx-5 mb-3 border-t border-[rgba(240,239,235,0.06)] pt-3">
              <p className="mb-2.5 text-[7px] tracking-[0.2em] uppercase text-[rgba(240,239,235,0.28)]">Sounds like</p>
              <div className="flex flex-wrap gap-2">
                {profile.influences!.map(artist => (
                  <ArtistChip
                    key={artist}
                    name={artist}
                    imageUrl={influenceImages[artist] ?? null}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Photo strip */}
          {(profile.photo_urls?.length ?? 0) > 0 && (
            <div className="mx-5 mb-3 border-t border-[rgba(240,239,235,0.06)] pt-3">
              <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
                {profile.photo_urls.map((url, i) => (
                  <Image key={url + i} src={url} alt={`Photo ${i + 1}`}
                    width={90} height={90}
                    className="flex-shrink-0 rounded-lg object-cover"
                    style={{ border: '1px solid rgba(240,239,235,0.08)' }} />
                ))}
              </div>
            </div>
          )}

          {/* Audio */}
          {audioType === 'youtube' && ytEmbed && (
            <div className="mx-5 mb-3 border-t border-[rgba(240,239,235,0.06)] pt-3">
              <p className="mb-1.5 text-[7px] tracking-[0.2em] uppercase text-[rgba(240,239,235,0.28)]">Music</p>
              <div className="aspect-video overflow-hidden rounded-xl">
                <iframe src={ytEmbed} title="YouTube player" loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen className="h-full w-full border-0" />
              </div>
            </div>
          )}
          {audioType === 'soundcloud' && scEmbed && (
            <div className="mx-5 mb-3 border-t border-[rgba(240,239,235,0.06)] pt-3">
              <p className="mb-1.5 text-[7px] tracking-[0.2em] uppercase text-[rgba(240,239,235,0.28)]">Music</p>
              <div className="overflow-hidden rounded-xl">
                <iframe title="SoundCloud player" loading="lazy" scrolling="no" allow="autoplay" src={scEmbed}
                  className="h-[100px] w-full border-0" />
              </div>
            </div>
          )}

          {/* Card footer */}
          <div className="mx-5 border-t border-[rgba(240,239,235,0.06)] pb-5 pt-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="text-[7px] tracking-[0.12em] text-[rgba(240,239,235,0.2)]">SDR-{shortId(profile.id)}</p>
                {(profile.profile_views ?? 0) > 0 && isOwnProfile && (
                  <p className="text-[7px] tracking-[0.1em] text-[rgba(240,239,235,0.2)]">· {profile.profile_views} views</p>
                )}
              </div>
              <div className="flex gap-2">
                {igUrl && (
                  <a href={igUrl} target="_blank" rel="noopener noreferrer"
                    className="rounded-full border border-[rgba(240,239,235,0.12)] px-3 py-1 text-[9px] tracking-wider text-[rgba(240,239,235,0.5)] transition-colors hover:border-[rgba(255,85,0,0.4)] hover:text-[#FF5500]">
                    IG
                  </a>
                )}
                {extUrl && (
                  <a href={extUrl} target="_blank" rel="noopener noreferrer"
                    className="rounded-full border border-[rgba(240,239,235,0.12)] px-3 py-1 text-[9px] tracking-wider text-[rgba(240,239,235,0.5)] transition-colors hover:border-[rgba(255,85,0,0.4)] hover:text-[#FF5500]">
                    LISTEN
                  </a>
                )}
              </div>
            </div>
            {/* Share + Report row */}
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleShare}
                className="flex-1 rounded-full border border-[rgba(240,239,235,0.10)] py-2 text-[10px] font-medium tracking-wider text-[rgba(240,239,235,0.45)] transition-colors hover:border-[rgba(240,239,235,0.25)] hover:text-[#F0EFEB]"
              >
                Share profile
              </button>
              {!isOwnProfile && (
                <button
                  onClick={handleReport}
                  className="rounded-full border border-[rgba(240,239,235,0.07)] py-2 px-4 text-[10px] font-medium tracking-wider text-[rgba(240,239,235,0.2)] transition-colors hover:border-[rgba(255,80,80,0.3)] hover:text-[rgba(255,100,100,0.7)]"
                >
                  Report
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Send message CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="mt-4"
        >
          <button
            onClick={() => router.push(`/messages/${id}`)}
            className="w-full rounded-full bg-[#FF5500] py-3.5 text-base font-semibold text-black shadow-[0_0_24px_rgba(255,85,0,0.4)] transition-opacity hover:opacity-90 active:opacity-80"
          >
            Send message
          </button>
        </motion.div>
      </motion.div>

      <BottomNav />
    </div>
  )
}
