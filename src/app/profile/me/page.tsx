'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'
import BottomNav from '@/components/ui/BottomNav'
import { useToast } from '@/components/ui/Toast'

type ProfileData = Pick<
  Profile,
  | 'id' | 'display_name' | 'avatar_url' | 'bio' | 'instruments' | 'genres' | 'objective'
  | 'level' | 'city' | 'audio_url' | 'instagram_url' | 'last_active' | 'photo_urls'
  | 'influences' | 'profile_views'
>

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
    <span className="flex items-center gap-2 rounded-full px-2 py-1"
      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
      <span style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
        border: showImg ? '1px solid rgba(255,92,0,0.35)' : 'none',
        background: showImg ? 'transparent' : 'rgba(255,92,0,0.25)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        {showImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl!} alt={name} onError={() => setImgFailed(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
        ) : (
          <span style={{ fontSize: 10, fontWeight: 700, color: '#FF5C00' }}>{name[0]?.toUpperCase()}</span>
        )}
      </span>
      <span style={{ fontSize: 11, color: 'rgba(240,239,235,0.85)', fontWeight: 500 }}>{name}</span>
    </span>
  )
}

const INSTRUMENT_EMOJI: Record<string, string> = {
  guitar: '🎸', bass: '🎸', drums: '🥁', keys: '🎹', piano: '🎹',
  violin: '🎻', cello: '🎻', trumpet: '🎺', saxophone: '🎷', flute: '🪈',
  vocals: '🎤', producer: '🎚️', dj: '🎧', other: '🎵',
}

const OBJECTIVE_LABEL: Record<string, string> = {
  casual_jam: 'Casual jam', form_band: 'Form a band',
  studio_sessions: 'Studio sessions', live_gigs: 'Live gigs',
  jam: 'Casual jam', 'form-band': 'Form a band',
  record: 'Studio sessions', 'perform-live': 'Live gigs',
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

const MAX_ADDITIONAL = 6

export default function MyProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [addingPhoto, setAddingPhoto] = useState(false)
  const [influenceImages, setInfluenceImages] = useState<Record<string, string | null>>({})
  const [profileViews, setProfileViews] = useState<number | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const addPhotoRef = useRef<HTMLInputElement>(null)
  const fetchedRef = useRef(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, bio, instruments, genres, objective, level, city, audio_url, instagram_url, last_active, photo_urls, influences, profile_views')
        .eq('id', user.id)
        .single()

      if (data) {
        setProfile(data as ProfileData)
        setPhotoUrls((data as ProfileData).photo_urls ?? [])
        setProfileViews((data as Record<string, unknown>).profile_views as number | null ?? null)

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
      }
      setLoading(false)
    }
    void load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAddPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !userId || photoUrls.length >= MAX_ADDITIONAL) return
    setAddingPhoto(true)
    try {
      const ts   = Date.now()
      const ext  = file.name.split('.').pop() ?? 'jpg'
      const path = `${userId}/photos/${ts}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}.${ext}`
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const next = [...photoUrls, data.publicUrl]
      setPhotoUrls(next)
      await supabase.from('profiles').update({ photo_urls: next }).eq('id', userId)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Photo upload failed', 'error')
    } finally {
      setAddingPhoto(false)
      if (addPhotoRef.current) addPhotoRef.current.value = ''
    }
  }

  async function handleDeletePhoto(idx: number) {
    if (!userId) return
    const next = photoUrls.filter((_, i) => i !== idx)
    setPhotoUrls(next)
    await supabase.from('profiles').update({ photo_urls: next }).eq('id', userId)
  }

  async function shareProfile() {
    const url = `${window.location.origin}/profile/${profile!.id}`
    if (navigator.share) {
      try { await navigator.share({ title: `${profile!.display_name} on Sondar`, url }) } catch {}
    } else {
      await navigator.clipboard.writeText(url)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '100dvh' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[rgba(240,239,235,0.12)] border-t-[#FF5500]" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 text-[#F0EFEB]" style={{ minHeight: '100dvh' }}>
        <p className="font-[family-name:var(--font-bebas)] text-3xl tracking-widest text-[rgba(240,239,235,0.3)]">
          NO PROFILE YET
        </p>
        <button onClick={() => router.push('/onboarding')} className="text-sm text-[#FF5500] underline">
          Complete onboarding →
        </button>
        <BottomNav />
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

  return (
    <div className="relative overflow-y-auto" style={{ minHeight: '100dvh', paddingBottom: 100, zIndex: 1, overflowX: 'clip' }}>

      {/* Image lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center bg-black/95"
          onClick={() => setLightboxUrl(null)}
          style={{ backdropFilter: 'blur(10px)' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="Photo"
            style={{ maxWidth: '95vw', maxHeight: '90dvh', objectFit: 'contain', borderRadius: 12 }}
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-white"
            style={{ background: 'rgba(255,255,255,0.12)', fontSize: 18 }}
            aria-label="Close"
          >
            ×
          </button>
        </div>
      )}

      {/* Ambient orbs */}
      <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: 500, height: 500,
          background: 'radial-gradient(circle at 80% 10%, rgba(255,92,0,0.18) 0%, transparent 60%)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: '10%', left: 0, width: 400, height: 400,
          background: 'radial-gradient(circle at 20% 80%, rgba(139,92,246,0.14) 0%, transparent 60%)', borderRadius: '50%' }} />
      </div>

      {/* Top action bar */}
      <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-4 pt-5">
        <button onClick={() => router.push('/home')}
          className="flex items-center gap-1.5 rounded-full border border-[rgba(240,239,235,0.10)] bg-[rgba(13,13,13,0.65)] px-3 py-2 text-[12px] font-medium text-[rgba(240,239,235,0.55)] backdrop-blur-xl transition-colors hover:border-[rgba(240,239,235,0.2)] hover:text-[#F0EFEB]">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Home
        </button>
        <div className="flex gap-1.5">
          <button onClick={() => void shareProfile()}
            className="rounded-full border border-[rgba(240,239,235,0.10)] bg-[rgba(13,13,13,0.65)] px-3 py-2 text-[11px] font-medium text-[rgba(240,239,235,0.5)] backdrop-blur-xl transition-colors hover:border-[rgba(240,239,235,0.2)] hover:text-[#F0EFEB]">
            Share
          </button>
          <button onClick={() => router.push('/settings')}
            className="rounded-full border border-[rgba(255,92,0,0.3)] bg-[rgba(255,92,0,0.08)] px-3 py-2 text-[11px] font-medium text-[#FF5500] backdrop-blur-xl transition-colors hover:bg-[rgba(255,92,0,0.15)]">
            Edit profile
          </button>
        </div>
      </div>

      {/* ── Main card ── */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto px-4 pt-16"
        style={{ maxWidth: 480 }}
      >
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
            {activeStatus && (
              <div className="flex items-center gap-1.5 rounded-full border border-[#B8FF00] px-2.5 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[#B8FF00]" />
                <span className="text-[7px] tracking-[0.15em] text-[#B8FF00] uppercase">{activeStatus}</span>
              </div>
            )}
          </div>

          {/* Avatar zone — full-width photo, corner brackets, same style as explore cards */}
          <div className="relative mx-4 mb-0 h-[260px] overflow-hidden rounded-xl bg-[#060606]">
            {/* Corner brackets */}
            <span className="absolute left-2 top-2 z-10 block h-3 w-3 border-l border-t border-[rgba(240,239,235,0.22)]" />
            <span className="absolute right-2 top-2 z-10 block h-3 w-3 border-r border-t border-[rgba(240,239,235,0.22)]" />
            <span className="absolute bottom-2 left-2 z-10 block h-3 w-3 border-b border-l border-[rgba(240,239,235,0.22)]" />
            <span className="absolute bottom-2 right-2 z-10 block h-3 w-3 border-b border-r border-[rgba(240,239,235,0.22)]" />

            {/* Ambient glow */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div style={{ width: 80, height: 80, borderRadius: '50%',
                background: 'rgba(255,92,0,0.2)', position: 'absolute', filter: 'blur(40px)' }} />
            </div>

            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.display_name ?? 'Me'}
                className="absolute inset-0 h-full w-full object-cover"
                style={{ opacity: 0.92 }}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex items-center justify-center"
                  style={{ width: 88, height: 88, borderRadius: '50%', background: '#1a1a1a',
                    border: '2px solid rgba(255,92,0,0.5)', position: 'relative', zIndex: 1 }}>
                  <span className="font-[family-name:var(--font-bebas)] text-3xl tracking-widest text-[rgba(240,239,235,0.5)]">
                    {initials}
                  </span>
                </div>
              </div>
            )}

            <p className="absolute bottom-2 left-3 z-10 text-[7px] tracking-widest text-[rgba(240,239,235,0.3)]">
              ID # SDR-{shortId(profile.id)}
            </p>
            {profile.instruments?.[0] && (
              <p className="absolute bottom-2 right-3 z-10 text-[7px] tracking-widest text-[#FF5C00] uppercase">
                {profile.instruments[0]} · {LEVEL_LABEL[profile.level ?? ''] ?? profile.level ?? '—'}
              </p>
            )}
          </div>

          {/* Name & city */}
          <div className="px-5 pt-3 pb-2">
            <h1 className="text-[28px] leading-none tracking-[0.04em] text-[#F0EFEB]"
              style={{ fontFamily: 'var(--font-bebas)' }}>
              {profile.display_name ?? 'YOUR NAME'}
            </h1>
            {profile.city && (
              <p className="mt-0.5 text-[9px] tracking-[0.14em] text-[rgba(240,239,235,0.38)] uppercase">{profile.city}</p>
            )}
          </div>

          {/* Tags row */}
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
          <div className="mx-5 mb-3 grid grid-cols-3 gap-2 border-t border-[rgba(240,239,235,0.06)] pt-3">
            {profile.city && (
              <div className="rounded-xl bg-[rgba(255,255,255,0.04)] px-2.5 py-2">
                <p className="text-[7px] tracking-[0.16em] text-[rgba(240,239,235,0.3)] uppercase">City</p>
                <p className="mt-0.5 text-[9px] font-semibold text-[#F0EFEB] uppercase truncate">{profile.city}</p>
              </div>
            )}
            {profile.objective && (
              <div className="rounded-xl bg-[rgba(255,255,255,0.04)] px-2.5 py-2">
                <p className="text-[7px] tracking-[0.16em] text-[rgba(240,239,235,0.3)] uppercase">Goal</p>
                <p className="mt-0.5 text-[9px] font-semibold text-[#F0EFEB] truncate">{OBJECTIVE_LABEL[profile.objective] ?? profile.objective}</p>
              </div>
            )}
            {profile.level && (
              <div className="rounded-xl bg-[rgba(255,255,255,0.04)] px-2.5 py-2">
                <p className="text-[7px] tracking-[0.16em] text-[rgba(240,239,235,0.3)] uppercase">Level</p>
                <p className="mt-0.5 text-[9px] font-semibold text-[#F0EFEB] truncate">{LEVEL_LABEL[profile.level] ?? profile.level}</p>
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
              <p className="mb-2.5 text-[7px] tracking-[0.18em] uppercase text-[rgba(240,239,235,0.32)]">Sounds like</p>
              <div className="flex flex-wrap gap-2">
                {profile.influences!.map(artist => (
                  <ArtistChip key={artist} name={artist} imageUrl={influenceImages[artist] ?? null} />
                ))}
              </div>
            </div>
          )}

          {/* Photo strip (editable) */}
          <div className="mx-5 mb-3 border-t border-[rgba(240,239,235,0.06)] pt-3">
            <p className="mb-2 text-[7px] tracking-[0.18em] uppercase text-[rgba(240,239,235,0.32)]">Photos</p>
            <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
              {photoUrls.map((url, i) => (
                <div key={url + i} className="relative flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Photo ${i + 1}`}
                    className="h-[90px] w-[90px] rounded-lg object-cover cursor-pointer"
                    style={{ border: '1px solid rgba(240,239,235,0.08)' }}
                    onClick={() => setLightboxUrl(url)} />
                  <button onClick={() => void handleDeletePhoto(i)}
                    className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black text-[10px] font-bold text-white"
                    style={{ border: '1px solid rgba(240,239,235,0.3)' }}
                    aria-label="Remove photo">×</button>
                </div>
              ))}
              {photoUrls.length < MAX_ADDITIONAL && (
                <button onClick={() => addPhotoRef.current?.click()} disabled={addingPhoto}
                  className="flex h-[90px] w-[90px] flex-shrink-0 items-center justify-center rounded-lg"
                  style={{ border: '1.5px dashed rgba(240,239,235,0.14)', background: 'rgba(240,239,235,0.03)' }}
                  aria-label="Add photo">
                  {addingPhoto
                    ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                    : <span className="text-xl text-[rgba(240,239,235,0.2)]">+</span>
                  }
                </button>
              )}
            </div>
            <input ref={addPhotoRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => void handleAddPhoto(e)} />
          </div>

          {/* Audio */}
          {audioType === 'youtube' && ytEmbed && (
            <div className="mx-5 mb-3 border-t border-[rgba(240,239,235,0.06)] pt-3">
              <p className="mb-1.5 text-[7px] tracking-[0.18em] uppercase text-[rgba(240,239,235,0.32)]">Music</p>
              <div className="aspect-video overflow-hidden rounded-xl">
                <iframe src={ytEmbed} title="YouTube" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="h-full w-full border-0" />
              </div>
            </div>
          )}
          {audioType === 'soundcloud' && scEmbed && (
            <div className="mx-5 mb-3 border-t border-[rgba(240,239,235,0.06)] pt-3">
              <p className="mb-1.5 text-[7px] tracking-[0.18em] uppercase text-[rgba(240,239,235,0.32)]">Music</p>
              <div className="overflow-hidden rounded-xl">
                <iframe title="SoundCloud" scrolling="no" allow="autoplay" src={scEmbed} className="h-[100px] w-full border-0" />
              </div>
            </div>
          )}

          {/* Card footer */}
          <div className="mx-5 flex items-end justify-between border-t border-[rgba(240,239,235,0.06)] pb-5 pt-3">
            <div>
              <p className="text-[7px] tracking-[0.12em] text-[rgba(240,239,235,0.2)]">SDR-{shortId(profile.id)}</p>
              {(profileViews ?? 0) > 0 && (
                <p className="mt-0.5 text-[8px] tracking-[0.08em] text-[rgba(240,239,235,0.3)]">
                  {profileViews!.toLocaleString()} profile view{profileViews !== 1 ? 's' : ''}
                </p>
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
        </div>

        {/* Sign out */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="mt-4 pb-4"
        >
          <button onClick={() => void handleSignOut()}
            className="w-full rounded-full border border-[rgba(240,239,235,0.08)] py-3 text-sm text-[rgba(240,239,235,0.35)] transition-colors hover:text-[rgba(240,239,235,0.65)]">
            Sign out
          </button>
        </motion.div>
      </motion.div>

      <BottomNav />
    </div>
  )
}
