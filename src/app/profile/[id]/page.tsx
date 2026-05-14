'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import type { Instrument, Genre, Objective } from '@/types'

interface ProfileData {
  id: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  instruments: Instrument[]
  genres: Genre[]
  objective: Objective[]
  level: string | null
  city: string | null
  audio_url: string | null
  instagram_url: string | null
  last_active: string | null
}

const INSTRUMENT_EMOJI: Record<string, string> = {
  guitar: '🎸', bass: '🎸', drums: '🥁', keys: '🎹', piano: '🎹',
  violin: '🎻', cello: '🎻', trumpet: '🎺', saxophone: '🎷', flute: '🪈',
  vocals: '🎤', producer: '🎚️', dj: '🎧', other: '🎵',
}

const OBJECTIVE_LABEL: Record<string, string> = {
  jam: 'Jam sessions',
  'form-band': 'Form a band',
  record: 'Record',
  'perform-live': 'Perform live',
  teach: 'Teach',
  learn: 'Learn',
  collaborate: 'Collaborate',
  'session-work': 'Session work',
}

const LEVEL_LABEL: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  professional: 'Professional',
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
  if (!m) return null
  return `https://www.youtube.com/embed/${m[1]}`
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

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.10 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const } },
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, bio, instruments, genres, objective, level, city, audio_url, instagram_url, last_active')
        .eq('id', id)
        .single()

      if (error || !data) {
        setNotFound(true)
      } else {
        setProfile(data as ProfileData)
      }
      setLoading(false)
    }
    void load()
  }, [id])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0D0D0D]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[rgba(240,239,235,0.12)] border-t-[#FF5500]" />
      </div>
    )
  }

  if (notFound || !profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0D0D0D] text-[#F0EFEB]">
        <p className="font-[family-name:var(--font-bebas)] text-4xl tracking-widest text-[rgba(240,239,235,0.3)]">
          MUSICIAN NOT FOUND
        </p>
        <button
          onClick={() => router.push('/explore')}
          className="text-sm text-[rgba(240,239,235,0.4)] underline hover:text-[#F0EFEB]"
        >
          ← Back to Explore
        </button>
      </div>
    )
  }

  const audioType = detectAudio(profile.audio_url)
  const ytEmbed = profile.audio_url ? getYouTubeEmbedUrl(profile.audio_url) : null
  const scEmbed = profile.audio_url ? getSoundCloudEmbedUrl(profile.audio_url) : null
  const activeStatus = formatLastActive(profile.last_active)

  const initials = (profile.display_name ?? '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="min-h-screen bg-[#0D0D0D] pb-28">

      {/* Header */}
      <div className="relative h-64 overflow-hidden">
        {/* Blurred background image */}
        {profile.avatar_url ? (
          <div
            className="absolute inset-0 scale-110"
            style={{
              backgroundImage: `url(${profile.avatar_url})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(32px) brightness(0.25)',
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-[#1a1a1a]" />
        )}

        {/* Orange ambient glow */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 60% 80% at 50% 120%, rgba(255,85,0,0.18) 0%, transparent 70%)',
          }}
        />

        {/* Dark-to-page gradient at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-[#0D0D0D]" />

        {/* Back button */}
        <button
          onClick={() => router.push('/explore')}
          className="absolute left-4 top-4 z-10 flex items-center gap-1.5 rounded-xl bg-[rgba(13,13,13,0.6)] px-3 py-2 text-sm font-medium text-[rgba(240,239,235,0.7)] backdrop-blur-md transition-colors hover:text-[#F0EFEB]"
        >
          ← Explore
        </button>

        {/* Circular avatar — overlaps header/content boundary */}
        <div className="absolute -bottom-14 left-1/2 -translate-x-1/2">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.display_name ?? 'Musician'}
              className="h-28 w-28 rounded-full object-cover"
              style={{
                border: '2px solid rgba(255,85,0,0.5)',
                boxShadow: '0 0 24px rgba(255,85,0,0.35)',
              }}
            />
          ) : (
            <div
              className="flex h-28 w-28 items-center justify-center rounded-full bg-[#1a1a1a]"
              style={{
                border: '2px solid rgba(255,85,0,0.5)',
                boxShadow: '0 0 24px rgba(255,85,0,0.35)',
              }}
            >
              <span className="font-[family-name:var(--font-bebas)] text-3xl tracking-widest text-[rgba(240,239,235,0.5)]">
                {initials}
              </span>
            </div>
          )}
          {activeStatus && (
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[rgba(13,13,13,0.9)] px-2.5 py-0.5 text-[10px] font-medium text-emerald-400 backdrop-blur-sm">
              <span className="mr-1 inline-block h-1.5 w-1.5 translate-y-[-1px] rounded-full bg-emerald-400" />
              {activeStatus}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="mx-auto mt-20 max-w-lg px-4"
      >
        {/* Name + location */}
        <motion.div variants={fadeUp} className="mb-6 text-center">
          <h1 className="font-[family-name:var(--font-bebas)] text-5xl tracking-widest text-[#F0EFEB]">
            {profile.display_name ?? 'UNKNOWN ARTIST'}
          </h1>
          {profile.city && (
            <p className="mt-1 text-sm text-[rgba(240,239,235,0.4)]">{profile.city}</p>
          )}
        </motion.div>

        {/* Level + objectives */}
        {(profile.level || (profile.objective?.length ?? 0) > 0) && (
          <motion.div variants={fadeUp} className="mb-6 flex flex-wrap justify-center gap-2">
            {profile.level && (
              <span className="rounded-full border border-[rgba(255,85,0,0.35)] bg-[rgba(255,85,0,0.08)] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#FF5500]">
                {LEVEL_LABEL[profile.level] ?? profile.level}
              </span>
            )}
            {(profile.objective ?? []).map((obj) => (
              <span
                key={obj}
                className="rounded-full border border-[rgba(91,33,182,0.4)] bg-[rgba(91,33,182,0.1)] px-3 py-1 text-xs font-medium text-[rgba(200,180,255,0.85)]"
              >
                {OBJECTIVE_LABEL[obj] ?? obj}
              </span>
            ))}
          </motion.div>
        )}

        {/* Instruments */}
        {(profile.instruments?.length ?? 0) > 0 && (
          <motion.div variants={fadeUp} className="mb-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[rgba(240,239,235,0.3)]">
              Instruments
            </p>
            <div className="flex flex-wrap gap-2">
              {profile.instruments.map((inst) => (
                <span
                  key={inst}
                  className="flex items-center gap-1.5 rounded-xl bg-[rgba(255,85,0,0.12)] px-3 py-1.5 text-xs font-medium text-[#FF5500]"
                >
                  <span>{INSTRUMENT_EMOJI[inst] ?? '🎵'}</span>
                  <span className="capitalize">{inst}</span>
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Genres */}
        {(profile.genres?.length ?? 0) > 0 && (
          <motion.div variants={fadeUp} className="mb-6">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[rgba(240,239,235,0.3)]">
              Genres
            </p>
            <div className="flex flex-wrap gap-2">
              {profile.genres.map((genre) => (
                <span
                  key={genre}
                  className="rounded-xl border border-[rgba(240,239,235,0.12)] px-3 py-1.5 text-xs font-medium capitalize text-[rgba(240,239,235,0.6)]"
                >
                  {genre}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Bio */}
        {profile.bio && (
          <motion.div variants={fadeUp} className="mb-6">
            <div className="glass rounded-2xl p-4">
              <p className="text-sm leading-relaxed text-[rgba(240,239,235,0.75)]">{profile.bio}</p>
            </div>
          </motion.div>
        )}

        {/* Audio / links */}
        {(audioType === 'youtube' && ytEmbed) && (
          <motion.div variants={fadeUp} className="mb-6">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[rgba(240,239,235,0.3)]">
              Music
            </p>
            <div className="aspect-video overflow-hidden rounded-2xl">
              <iframe
                src={ytEmbed}
                title="YouTube player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full border-0"
              />
            </div>
          </motion.div>
        )}

        {(audioType === 'soundcloud' && scEmbed) && (
          <motion.div variants={fadeUp} className="mb-6">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[rgba(240,239,235,0.3)]">
              Music
            </p>
            <div className="overflow-hidden rounded-2xl">
              <iframe
                title="SoundCloud player"
                scrolling="no"
                allow="autoplay"
                src={scEmbed}
                className="h-[120px] w-full border-0"
              />
            </div>
          </motion.div>
        )}

        {/* Instagram link (could be in audio_url or instagram_url) */}
        {(() => {
          const igUrl = profile.instagram_url ?? (audioType === 'instagram' ? profile.audio_url : null)
          const extUrl = audioType === 'link' ? profile.audio_url : null
          if (!igUrl && !extUrl) return null
          return (
            <motion.div variants={fadeUp} className="mb-6 flex flex-wrap gap-2">
              {igUrl && (
                <a
                  href={igUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-xl border border-[rgba(240,239,235,0.12)] px-4 py-2.5 text-sm text-[rgba(240,239,235,0.6)] transition-colors hover:border-[rgba(255,85,0,0.4)] hover:text-[#FF5500]"
                >
                  <InstagramIcon />
                  Instagram
                </a>
              )}
              {extUrl && (
                <a
                  href={extUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-xl border border-[rgba(240,239,235,0.12)] px-4 py-2.5 text-sm text-[rgba(240,239,235,0.6)] transition-colors hover:border-[rgba(255,85,0,0.4)] hover:text-[#FF5500]"
                >
                  <LinkIcon />
                  Listen
                </a>
              )}
            </motion.div>
          )
        })()}
      </motion.div>

      {/* Fixed bottom — Send message */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-[rgba(240,239,235,0.06)] bg-[rgba(13,13,13,0.92)] px-4 py-4 backdrop-blur-md">
        <button
          onClick={() => router.push(`/messages/${id}`)}
          className="w-full rounded-xl bg-[#FF5500] py-3 text-sm font-semibold text-black shadow-[0_0_20px_rgba(255,85,0,0.35)] transition-opacity hover:opacity-90 active:opacity-80"
        >
          Send message
        </button>
      </div>
    </div>
  )
}
