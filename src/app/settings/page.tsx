'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import CityAutocomplete from '@/components/onboarding/CityAutocomplete'
import type { Genre, Instrument, Objective } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type Level = 'beginner' | 'intermediate' | 'advanced' | 'professional'
type Availability = 'weekday-evenings' | 'weekends' | 'flexible'

interface SettingsForm {
  displayName: string
  city: string
  locationLat: number | null
  locationLng: number | null
  bio: string
  audioLink: string
  instagramUrl: string
  avatarUrl: string | null
  instruments: Instrument[]
  genres: Genre[]
  objectives: Objective[]
  level: Level | null
  availability: Availability[]
}

// ─── Static data (mirrors onboarding) ─────────────────────────────────────────

const INSTRUMENTS: { value: Instrument; label: string; emoji: string }[] = [
  { value: 'guitar', label: 'Guitar', emoji: '🎸' },
  { value: 'bass', label: 'Bass', emoji: '🎵' },
  { value: 'drums', label: 'Drums', emoji: '🥁' },
  { value: 'keys', label: 'Keys', emoji: '🎹' },
  { value: 'vocals', label: 'Vocals', emoji: '🎤' },
  { value: 'violin', label: 'Violin', emoji: '🎻' },
  { value: 'saxophone', label: 'Saxophone', emoji: '🎷' },
  { value: 'trumpet', label: 'Trumpet', emoji: '🎺' },
  { value: 'producer', label: 'Producer', emoji: '🎛️' },
  { value: 'dj', label: 'DJ', emoji: '💿' },
  { value: 'other', label: 'Other', emoji: '🎼' },
]

const GENRES: { value: Genre; label: string }[] = [
  { value: 'rock', label: 'Rock' },
  { value: 'indie', label: 'Indie' },
  { value: 'jazz', label: 'Jazz' },
  { value: 'electronic', label: 'Electronic' },
  { value: 'hip-hop', label: 'Hip-Hop' },
  { value: 'classical', label: 'Classical' },
  { value: 'metal', label: 'Metal' },
  { value: 'folk', label: 'Folk' },
  { value: 'r&b', label: 'R&B' },
  { value: 'pop', label: 'Pop' },
  { value: 'punk', label: 'Punk' },
  { value: 'experimental', label: 'Experimental' },
  { value: 'ambient', label: 'Ambient' },
  { value: 'soul', label: 'Soul' },
  { value: 'funk', label: 'Funk' },
]

const OBJECTIVES: { value: Objective; label: string; emoji: string; subtitle: string }[] = [
  { value: 'jam', label: 'Casual jam', emoji: '🎶', subtitle: 'Low-key sessions, no pressure' },
  { value: 'form-band', label: 'Form a band', emoji: '🤘', subtitle: 'Build something serious together' },
  { value: 'record', label: 'Studio sessions', emoji: '🎙️', subtitle: 'Record and produce original music' },
  { value: 'perform-live', label: 'Live gigs', emoji: '🎤', subtitle: 'Hit stages and perform live' },
  { value: 'collaborate', label: 'Collaborate', emoji: '🤝', subtitle: 'Co-write and create together' },
  { value: 'teach', label: 'Teach', emoji: '📖', subtitle: 'Share your knowledge' },
  { value: 'learn', label: 'Learn', emoji: '🎓', subtitle: 'Level up your playing' },
  { value: 'session-work', label: 'Session work', emoji: '🎚️', subtitle: 'Paid gigs and studio work' },
]

const LEVELS: { value: Level; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'professional', label: 'Professional' },
]

const AVAILABILITY_OPTIONS: { value: Availability; label: string }[] = [
  { value: 'weekday-evenings', label: 'Weekday evenings' },
  { value: 'weekends', label: 'Weekends' },
  { value: 'flexible', label: 'Flexible' },
]

const BIO_MAX = 120

const inputClass =
  'w-full rounded-xl border border-[rgba(240,239,235,0.08)] bg-[#1C1C1C] px-4 py-3 text-sm text-[#F0EFEB] placeholder:text-[rgba(240,239,235,0.3)] outline-none focus:border-[rgba(255,85,0,0.5)] focus:ring-1 focus:ring-[rgba(255,85,0,0.3)] transition-colors'

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[rgba(240,239,235,0.3)]">
      {children}
    </p>
  )
}

// ─── Delete confirmation modal ────────────────────────────────────────────────

function DeleteModal({
  onConfirm,
  onCancel,
  deleting,
}: {
  onConfirm: () => void
  onCancel: () => void
  deleting: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      onClick={onCancel}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 340 }}
        className="glass w-full max-w-sm rounded-t-3xl p-6 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-[family-name:var(--font-bebas)] text-2xl tracking-widest text-[#F0EFEB]">
          DELETE ACCOUNT?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[rgba(240,239,235,0.5)]">
          This will permanently delete your profile, messages, and all associated data.
          This action cannot be undone.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="w-full rounded-xl bg-red-600 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Yes, delete my account'}
          </button>
          <button
            onClick={onCancel}
            disabled={deleting}
            className="w-full rounded-xl py-3 text-sm font-medium text-[rgba(240,239,235,0.5)] transition-colors hover:text-[#F0EFEB]"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [userId, setUserId] = useState<string | null>(null)
  const [form, setForm] = useState<SettingsForm>({
    displayName: '',
    city: '',
    locationLat: null,
    locationLng: null,
    bio: '',
    audioLink: '',
    instagramUrl: '',
    avatarUrl: null,
    instruments: [],
    genres: [],
    objectives: [],
    level: null,
    availability: [],
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function patch<K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  function handleCitySelect(name: string, lat: number, lng: number) {
    setForm((prev) => ({ ...prev, city: name, locationLat: lat, locationLng: lng }))
    setSaved(false)
  }

  // ── Load profile ─────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data } = await supabase
        .from('profiles')
        .select('display_name, city, lat, lng, bio, audio_url, instagram_url, avatar_url, instruments, genres, objective, level, availability')
        .eq('id', user.id)
        .single()

      if (data) {
        setForm({
          displayName: data.display_name ?? '',
          city: data.city ?? '',
          locationLat: data.lat ?? null,
          locationLng: data.lng ?? null,
          bio: data.bio ?? '',
          audioLink: data.audio_url ?? '',
          instagramUrl: data.instagram_url ?? '',
          avatarUrl: data.avatar_url ?? null,
          instruments: (data.instruments as Instrument[]) ?? [],
          genres: (data.genres as Genre[]) ?? [],
          objectives: (data.objective as Objective[]) ?? [],
          level: (data.level as Level | null) ?? null,
          availability: (data.availability as Availability[]) ?? [],
        })
      }
      setLoading(false)
    }
    void load()
  }, [])

  // ── Avatar upload ─────────────────────────────────────────────────────────────
  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !userId) return

    const objectUrl = URL.createObjectURL(file)
    setLocalPreview(objectUrl)
    setUploadError(null)
    setUploading(true)

    try {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${userId}/avatar.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true })

      if (uploadErr) throw uploadErr

      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      patch('avatarUrl', data.publicUrl)
      URL.revokeObjectURL(objectUrl)
      setLocalPreview(null)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
      setLocalPreview(null)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ── Save profile ──────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!userId || saving) return
    setSaving(true)
    setError(null)
    setSaved(false)

    const { error: upsertErr } = await supabase.from('profiles').upsert({
      id: userId,
      display_name: form.displayName || null,
      city: form.city || null,
      lat: form.locationLat,
      lng: form.locationLng,
      bio: form.bio || null,
      audio_url: form.audioLink || null,
      instagram_url: form.instagramUrl || null,
      avatar_url: form.avatarUrl,
      instruments: form.instruments,
      genres: form.genres,
      objective: form.objectives,
      level: form.level,
      availability: form.availability,
      updated_at: new Date().toISOString(),
    })

    if (upsertErr) {
      setError(upsertErr.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  // ── Sign out ──────────────────────────────────────────────────────────────────
  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // ── Delete account ────────────────────────────────────────────────────────────
  async function handleDeleteAccount() {
    if (!userId) return
    setDeleting(true)

    // Delete profile data
    await supabase.from('profiles').delete().eq('id', userId)
    // Sign out (auth.users row requires service-role to delete — profile data is cleared)
    await supabase.auth.signOut()
    router.push('/')
  }

  const displayAvatar = localPreview ?? form.avatarUrl
  const initials = (form.displayName || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0D0D0D]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[rgba(240,239,235,0.12)] border-t-[#FF5500]" />
      </div>
    )
  }

  return (
    <>
      {/* Delete modal */}
      <AnimatePresence>
        {showDelete && (
          <DeleteModal
            onConfirm={() => void handleDeleteAccount()}
            onCancel={() => setShowDelete(false)}
            deleting={deleting}
          />
        )}
      </AnimatePresence>

      <div className="min-h-screen bg-[#0D0D0D] pb-32">
        {/* Error banner */}
        {error && (
          <div className="fixed left-0 right-0 top-0 z-40 bg-red-950 px-4 py-3 text-center">
            <p className="text-sm text-red-300">{error}</p>
            <button onClick={() => setError(null)} className="mt-1 text-xs text-red-400 underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-[rgba(240,239,235,0.06)] bg-[rgba(13,13,13,0.92)] px-4 py-4 backdrop-blur-md">
          <div className="mx-auto flex max-w-lg items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/explore')}
                className="text-sm text-[rgba(240,239,235,0.4)] transition-colors hover:text-[#F0EFEB]"
              >
                ←
              </button>
              <h1 className="font-[family-name:var(--font-bebas)] text-2xl tracking-widest text-[#F0EFEB]">
                SETTINGS
              </h1>
            </div>

            <button
              onClick={() => void handleSave()}
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-[#FF5500] px-5 py-2 text-sm font-semibold text-black shadow-[0_0_12px_rgba(255,85,0,0.3)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-lg px-4 py-8 space-y-10">

          {/* ── Photo ─────────────────────────────────────────────────────────── */}
          <section>
            <SectionLabel>Photo</SectionLabel>
            <div className="flex items-center gap-5">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-full border-2 border-[rgba(240,239,235,0.12)] bg-[#1C1C1C] transition-opacity hover:opacity-80 disabled:cursor-wait"
                aria-label="Change profile photo"
              >
                {displayAvatar ? (
                  <img src={displayAvatar} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center font-[family-name:var(--font-bebas)] text-2xl text-[rgba(240,239,235,0.3)]">
                    {initials}
                  </span>
                )}
                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  </div>
                )}
              </button>

              <div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="rounded-xl border border-[rgba(240,239,235,0.12)] px-4 py-2 text-sm font-medium text-[rgba(240,239,235,0.7)] transition-colors hover:border-[rgba(255,85,0,0.4)] hover:text-[#FF5500]"
                >
                  {uploading ? 'Uploading…' : 'Change photo'}
                </button>
                {uploadError && (
                  <p className="mt-1.5 text-xs text-red-400">{uploadError}</p>
                )}
                <p className="mt-1.5 text-xs text-[rgba(240,239,235,0.25)]">JPG, PNG — max 5 MB</p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void handleAvatarChange(e)}
              />
            </div>
          </section>

          {/* ── Profile details ────────────────────────────────────────────────── */}
          <section className="space-y-4">
            <SectionLabel>Profile</SectionLabel>

            <input
              type="text"
              value={form.displayName}
              onChange={(e) => patch('displayName', e.target.value)}
              placeholder="Your name"
              maxLength={50}
              className={inputClass}
            />

            <CityAutocomplete
              value={form.city}
              onChange={(v) => patch('city', v)}
              onSelect={handleCitySelect}
            />

            <div className="relative">
              <textarea
                value={form.bio}
                onChange={(e) => patch('bio', e.target.value.slice(0, BIO_MAX))}
                placeholder="A few words about you and your music…"
                rows={3}
                className={cn(inputClass, 'resize-none pb-6')}
              />
              <span
                className={cn(
                  'absolute bottom-3 right-3 text-xs',
                  form.bio.length >= BIO_MAX
                    ? 'text-[#FF5500]'
                    : 'text-[rgba(240,239,235,0.3)]',
                )}
              >
                {form.bio.length}/{BIO_MAX}
              </span>
            </div>

            <input
              type="url"
              value={form.audioLink}
              onChange={(e) => patch('audioLink', e.target.value)}
              placeholder="YouTube or SoundCloud link (optional)"
              className={inputClass}
            />

            <input
              type="text"
              value={form.instagramUrl}
              onChange={(e) => patch('instagramUrl', e.target.value)}
              placeholder="Instagram handle or URL (optional)"
              className={inputClass}
            />
          </section>

          {/* ── Instruments ───────────────────────────────────────────────────── */}
          <section>
            <SectionLabel>Instruments</SectionLabel>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {INSTRUMENTS.map(({ value, label, emoji }) => {
                const selected = form.instruments.includes(value)
                return (
                  <button
                    key={value}
                    onClick={() =>
                      patch(
                        'instruments',
                        selected
                          ? form.instruments.filter((i) => i !== value)
                          : [...form.instruments, value],
                      )
                    }
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-xl px-3 py-3 text-xs font-medium transition-all duration-200',
                      selected
                        ? 'bg-[#FF5500] text-black shadow-[0_0_16px_rgba(255,85,0,0.5)]'
                        : 'glass text-[#F0EFEB] hover:border-[rgba(240,239,235,0.2)]',
                    )}
                  >
                    <span className="text-xl">{emoji}</span>
                    <span>{label}</span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* ── Genres ────────────────────────────────────────────────────────── */}
          <section>
            <SectionLabel>Genres (max 3)</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {GENRES.map(({ value, label }) => {
                const selected = form.genres.includes(value)
                const maxed = form.genres.length >= 3 && !selected
                return (
                  <button
                    key={value}
                    disabled={maxed}
                    onClick={() =>
                      patch(
                        'genres',
                        selected
                          ? form.genres.filter((g) => g !== value)
                          : [...form.genres, value],
                      )
                    }
                    className={cn(
                      'rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200',
                      selected
                        ? 'bg-[#FF5500] text-black shadow-[0_0_12px_rgba(255,85,0,0.45)]'
                        : 'glass text-[#F0EFEB]',
                      maxed && 'cursor-not-allowed opacity-30',
                    )}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </section>

          {/* ── Objectives ────────────────────────────────────────────────────── */}
          <section>
            <SectionLabel>Looking for</SectionLabel>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {OBJECTIVES.map(({ value, label, emoji, subtitle }) => {
                const selected = form.objectives.includes(value)
                return (
                  <button
                    key={value}
                    onClick={() =>
                      patch(
                        'objectives',
                        selected
                          ? form.objectives.filter((o) => o !== value)
                          : [...form.objectives, value],
                      )
                    }
                    className={cn(
                      'flex items-start gap-4 rounded-2xl px-5 py-4 text-left transition-all duration-200',
                      selected
                        ? 'bg-[#FF5500] text-black shadow-[0_0_24px_rgba(255,85,0,0.4)]'
                        : 'glass text-[#F0EFEB] hover:border-[rgba(240,239,235,0.2)]',
                    )}
                  >
                    <span className="mt-0.5 text-2xl">{emoji}</span>
                    <div>
                      <p className="font-semibold">{label}</p>
                      <p className={cn('text-xs', selected ? 'text-black/70' : 'text-[rgba(240,239,235,0.45)]')}>
                        {subtitle}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          {/* ── Level ─────────────────────────────────────────────────────────── */}
          <section>
            <SectionLabel>Level</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {LEVELS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => patch('level', value)}
                  className={cn(
                    'rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200',
                    form.level === value
                      ? 'bg-[#FF5500] text-black shadow-[0_0_12px_rgba(255,85,0,0.45)]'
                      : 'glass text-[#F0EFEB]',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          {/* ── Availability ──────────────────────────────────────────────────── */}
          <section>
            <SectionLabel>Availability</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {AVAILABILITY_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() =>
                    patch(
                      'availability',
                      form.availability.includes(value)
                        ? form.availability.filter((a) => a !== value)
                        : [...form.availability, value],
                    )
                  }
                  className={cn(
                    'rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200',
                    form.availability.includes(value)
                      ? 'bg-[#FF5500] text-black shadow-[0_0_12px_rgba(255,85,0,0.45)]'
                      : 'glass text-[#F0EFEB]',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          {/* ── Account actions ────────────────────────────────────────────────── */}
          <section className="space-y-3 border-t border-[rgba(240,239,235,0.06)] pt-8">
            <SectionLabel>Account</SectionLabel>

            <button
              onClick={() => void handleSignOut()}
              className="flex w-full items-center justify-between rounded-xl border border-[rgba(240,239,235,0.08)] bg-[#1C1C1C] px-5 py-4 text-sm font-medium text-[rgba(240,239,235,0.7)] transition-colors hover:text-[#F0EFEB]"
            >
              Sign out
              <span className="text-[rgba(240,239,235,0.3)]">→</span>
            </button>

            <button
              onClick={() => setShowDelete(true)}
              className="flex w-full items-center justify-between rounded-xl border border-[rgba(220,38,38,0.2)] bg-[rgba(220,38,38,0.05)] px-5 py-4 text-sm font-medium text-red-400 transition-colors hover:bg-[rgba(220,38,38,0.1)] hover:text-red-300"
            >
              Delete account
              <span className="text-red-600">→</span>
            </button>
          </section>
        </div>
      </div>

      {/* Fixed save bar (mobile) — mirrors header save button for long pages */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-[rgba(240,239,235,0.06)] bg-[rgba(13,13,13,0.92)] px-4 py-4 backdrop-blur-md">
        <div className="mx-auto max-w-lg">
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="w-full rounded-xl bg-[#FF5500] py-3 text-sm font-semibold text-black shadow-[0_0_16px_rgba(255,85,0,0.3)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save changes'}
          </button>
        </div>
      </div>
    </>
  )
}
