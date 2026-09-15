'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import CityAutocomplete from '@/components/onboarding/CityAutocomplete'
import type { Availability, Genre, Instrument, Level, Objective } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SettingsForm {
  displayName: string
  city: string
  locationLat: number | null
  locationLng: number | null
  bio: string
  audioLink: string
  instagramUrl: string
  avatarUrl: string | null
  photoUrls: string[]
  instruments: Instrument[]
  genres: Genre[]
  objective: Objective | null
  level: Level | null
  availability: Availability[]
  influences: string[]
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

// Only the 4 values that exist in the DB objective_type enum
const OBJECTIVES: { value: Objective; label: string; emoji: string; subtitle: string }[] = [
  { value: 'jam', label: 'Casual jam', emoji: '🎶', subtitle: 'Low-key sessions, no pressure' },
  { value: 'form-band', label: 'Form a band', emoji: '🤘', subtitle: 'Build something serious together' },
  { value: 'record', label: 'Studio sessions', emoji: '🎙️', subtitle: 'Record and produce original music' },
  { value: 'perform-live', label: 'Live gigs', emoji: '🎤', subtitle: 'Hit stages and perform live' },
]

// Maps form values → DB enum values (objective_type uses underscores)
function toObjectiveEnum(value: Objective | null): string | null {
  if (!value) return null
  const map: Record<string, string> = {
    'jam':          'casual_jam',
    'casual-jam':   'casual_jam',
    'form-band':    'form_band',
    'record':       'studio_sessions',
    'perform-live': 'live_gigs',
  }
  return map[value] ?? value
}

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

function SectionLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[rgba(240,239,235,0.3)]">
      {children}
      {required && <span style={{ color: '#FF5500', marginLeft: 3 }}>*</span>}
    </p>
  )
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <p className="mb-1.5 text-xs font-medium text-[rgba(240,239,235,0.38)]">
      {children}
      {required && <span style={{ color: '#FF5500', marginLeft: 2 }}>*</span>}
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

const MAX_ADDITIONAL = 6

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef  = useRef<HTMLInputElement>(null)
  const addPhotoRef   = useRef<HTMLInputElement>(null)

  const [userId, setUserId] = useState<string | null>(null)
  const [influenceInput, setInfluenceInput] = useState('')
  const [form, setForm] = useState<SettingsForm>({
    displayName: '',
    city: '',
    locationLat: null,
    locationLng: null,
    bio: '',
    audioLink: '',
    instagramUrl: '',
    avatarUrl: null,
    photoUrls: [],
    instruments: [],
    genres: [],
    objective: null,
    level: null,
    availability: [],
    influences: [],
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading]         = useState(false)
  const [uploadError, setUploadError]     = useState<string | null>(null)
  const [localPreview, setLocalPreview]   = useState<string | null>(null)
  const [addingPhoto, setAddingPhoto]     = useState(false)
  const [showDelete, setShowDelete]       = useState(false)
  const [deleting, setDeleting]           = useState(false)
  const [blockedIds, setBlockedIds]       = useState<string[]>([])
  const [blockedProfiles, setBlockedProfiles] = useState<{ id: string; display_name: string | null; avatar_url: string | null }[]>([])

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
        .select('display_name, city, bio, audio_url, instagram_url, avatar_url, photo_urls, instruments, genres, objective, level, availability, influences')
        .eq('id', user.id)
        .single()

      if (data) {
        setForm({
          displayName: data.display_name ?? '',
          city: data.city ?? '',
          locationLat: null,
          locationLng: null,
          bio: data.bio ?? '',
          audioLink: data.audio_url ?? '',
          instagramUrl: data.instagram_url ?? '',
          avatarUrl: data.avatar_url ?? null,
          photoUrls: (data.photo_urls as string[]) ?? [],
          instruments: (data.instruments as Instrument[]) ?? [],
          genres: (data.genres as Genre[]) ?? [],
          objective: (data.objective as Objective | null) ?? null,
          level: (data.level as Level | null) ?? null,
          availability: (data.availability as Availability[]) ?? [],
          influences: (data.influences as string[]) ?? [],
        })
      }
      setLoading(false)
    }
    void load()
  }, [])

  // ── Load blocked users ────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const ids: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith('blocked_')) ids.push(key.replace('blocked_', ''))
      }
      setBlockedIds(ids)
      if (ids.length > 0) {
        void supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', ids)
          .then(({ data }) => setBlockedProfiles(data ?? []))
      }
    } catch { /* ignore */ }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Additional photo upload ───────────────────────────────────────────────────
  const handleAddPhoto = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId || form.photoUrls.length >= MAX_ADDITIONAL) return
    setAddingPhoto(true)
    try {
      const ts   = Date.now()
      const ext  = file.name.split('.').pop() ?? 'jpg'
      const path = `${userId}/photos/${ts}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}.${ext}`
      const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (uploadErr) throw uploadErr
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      patch('photoUrls', [...form.photoUrls, data.publicUrl])
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Photo upload failed')
    } finally {
      setAddingPhoto(false)
      if (addPhotoRef.current) addPhotoRef.current.value = ''
    }
  }, [userId, form.photoUrls, supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  function deletePhoto(idx: number) {
    patch('photoUrls', form.photoUrls.filter((_, i) => i !== idx))
    setSaved(false)
  }

  function movePhoto(from: number, to: number) {
    if (to < 0 || to >= form.photoUrls.length) return
    const arr = [...form.photoUrls]
    const [item] = arr.splice(from, 1)
    arr.splice(to, 0, item)
    patch('photoUrls', arr)
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
      bio: form.bio || null,
      audio_url: form.audioLink || null,
      instagram_url: form.instagramUrl || null,
      avatar_url: form.avatarUrl,
      photo_urls: form.photoUrls,
      instruments: form.instruments,
      genres: form.genres,
      objective: toObjectiveEnum(form.objective),
      level: form.level,
      availability: form.availability,
      influences: form.influences,
    })

    if (upsertErr) {
      setError(upsertErr.message)
      setSaving(false)
      return
    }

    // Update PostGIS location if coordinates changed
    if (form.locationLat !== null && form.locationLng !== null) {
      await supabase.rpc('set_user_location', {
        user_id: userId,
        lat: form.locationLat,
        lng: form.locationLng,
      })
    }

    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
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
    router.push('/login')
  }

  const displayAvatar = localPreview ?? form.avatarUrl
  const initials = (form.displayName || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const completeness = Math.round([
    !!form.displayName.trim(),
    form.instruments.length > 0,
    form.genres.length > 0,
    !!form.bio.trim(),
    !!form.level,
    !!form.city.trim(),
    form.availability.length > 0,
    form.influences.length > 0,
  ].filter(Boolean).length / 8 * 100)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
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

      <div className="min-h-screen pb-32">
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
                onClick={() => router.push('/home')}
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

        {/* Profile completeness bar */}
        <div className="border-b border-[rgba(240,239,235,0.05)] px-4 py-3">
          <div className="mx-auto max-w-lg flex items-center gap-3">
            <div className="flex-1 h-1 overflow-hidden rounded-full bg-[rgba(240,239,235,0.06)]">
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${completeness}%` }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                style={{ background: completeness === 100
                  ? 'linear-gradient(90deg,#22c55e,#16a34a)'
                  : 'linear-gradient(90deg,#FF5C00,#8B5CF6)',
                  boxShadow: '0 0 6px rgba(255,85,0,0.35)' }}
              />
            </div>
            <span className="shrink-0 text-[11px] font-semibold"
              style={{ color: completeness === 100 ? '#22c55e' : '#FF5C00' }}>
              {completeness}% complete
            </span>
          </div>
        </div>

        <div className="mx-auto max-w-lg px-4 pt-3 pb-1">
          <p className="text-[10px] text-[rgba(240,239,235,0.25)]">
            <span style={{ color: '#FF5500' }}>*</span> Required for profile completeness
          </p>
        </div>

        <div className="mx-auto max-w-lg px-4 py-5 space-y-6">

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
                  // eslint-disable-next-line @next/next/no-img-element
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

          {/* ── Additional photos ─────────────────────────────────────────────── */}
          <section>
            <SectionLabel>Additional photos <span className="normal-case font-normal text-[rgba(240,239,235,0.2)]">(up to {MAX_ADDITIONAL})</span></SectionLabel>
            <div className="flex flex-wrap gap-3">
              {form.photoUrls.map((url, i) => (
                <div key={url + i} className="relative h-20 w-20 group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Photo ${i + 1}`} className="h-full w-full rounded-xl object-cover" />
                  <button
                    onClick={() => deletePhoto(i)}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black text-[11px] font-bold text-white"
                    style={{ border: '1.5px solid rgba(240,239,235,0.3)' }}
                    aria-label="Remove photo"
                  >
                    ×
                  </button>
                  {/* Reorder arrows */}
                  <div className="absolute bottom-1 left-0 right-0 flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => movePhoto(i, i - 1)}
                      disabled={i === 0}
                      className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white disabled:opacity-30"
                      style={{ background: 'rgba(0,0,0,0.7)' }}
                      aria-label="Move left"
                    >
                      ←
                    </button>
                    <button
                      onClick={() => movePhoto(i, i + 1)}
                      disabled={i === form.photoUrls.length - 1}
                      className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white disabled:opacity-30"
                      style={{ background: 'rgba(0,0,0,0.7)' }}
                      aria-label="Move right"
                    >
                      →
                    </button>
                  </div>
                </div>
              ))}
              {form.photoUrls.length < MAX_ADDITIONAL && (
                <button
                  onClick={() => addPhotoRef.current?.click()}
                  disabled={addingPhoto}
                  className="flex h-20 w-20 items-center justify-center rounded-xl"
                  style={{ border: '1.5px dashed rgba(240,239,235,0.15)', background: 'rgba(240,239,235,0.03)' }}
                  aria-label="Add photo"
                >
                  {addingPhoto
                    ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                    : <span className="text-xl text-[rgba(240,239,235,0.2)]">+</span>
                  }
                </button>
              )}
            </div>
            <input ref={addPhotoRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => void handleAddPhoto(e)} />
          </section>

          {/* ── Profile details ────────────────────────────────────────────────── */}
          <section className="space-y-4">
            <SectionLabel>Profile</SectionLabel>

            <div>
              <FieldLabel required>Display name</FieldLabel>
              <input
                type="text"
                value={form.displayName}
                onChange={(e) => patch('displayName', e.target.value)}
                placeholder="Your name"
                maxLength={50}
                className={inputClass}
              />
            </div>

            <div>
              <FieldLabel required>City / location</FieldLabel>
              <CityAutocomplete
                value={form.city}
                onChange={(v) => patch('city', v)}
                onSelect={handleCitySelect}
              />
            </div>

            <div>
              <FieldLabel required>Bio</FieldLabel>
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
            </div>

            <div>
              <FieldLabel>Audio link</FieldLabel>
              <input
                type="url"
                value={form.audioLink}
                onChange={(e) => patch('audioLink', e.target.value)}
                placeholder="YouTube or SoundCloud link"
                className={inputClass}
              />
            </div>

            <div>
              <FieldLabel>Instagram</FieldLabel>
              <input
                type="text"
                value={form.instagramUrl}
                onChange={(e) => patch('instagramUrl', e.target.value)}
                placeholder="Handle or URL"
                className={inputClass}
              />
            </div>
          </section>

          {/* ── Instruments ───────────────────────────────────────────────────── */}
          <section>
            <SectionLabel required>Instruments</SectionLabel>
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
            <SectionLabel required>Genres (max 3)</SectionLabel>
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
                const selected = form.objective === value
                return (
                  <button
                    key={value}
                    onClick={() => patch('objective', selected ? null : value)}

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
            <SectionLabel required>Level</SectionLabel>
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
            <SectionLabel required>Availability</SectionLabel>
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

          {/* ── Artists I like ────────────────────────────────────────────────── */}
          <section>
            <SectionLabel>Artists I like <span className="normal-case font-normal text-[rgba(240,239,235,0.2)]">(up to 10)</span></SectionLabel>
            {/* Tag chips */}
            {form.influences.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {form.influences.map((artist) => (
                  <span
                    key={artist}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
                    style={{
                      background: 'rgba(255,85,0,0.10)',
                      border: '1px solid rgba(255,85,0,0.25)',
                      color: 'rgba(240,239,235,0.85)',
                    }}
                  >
                    {artist}
                    <button
                      onClick={() => patch('influences', form.influences.filter((a) => a !== artist))}
                      aria-label={`Remove ${artist}`}
                      className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[10px] text-[rgba(240,239,235,0.4)] hover:text-[#FF5500]"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            {/* Input row */}
            {form.influences.length < 10 && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={influenceInput}
                  onChange={(e) => setInfluenceInput(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ',') && influenceInput.trim()) {
                      e.preventDefault()
                      const name = influenceInput.trim().replace(/,$/, '')
                      if (name && !form.influences.includes(name) && form.influences.length < 10) {
                        patch('influences', [...form.influences, name])
                      }
                      setInfluenceInput('')
                    }
                  }}
                  placeholder="e.g. Radiohead, Portishead…"
                  className={cn(inputClass, 'flex-1')}
                />
                <button
                  onClick={() => {
                    const name = influenceInput.trim()
                    if (name && !form.influences.includes(name) && form.influences.length < 10) {
                      patch('influences', [...form.influences, name])
                    }
                    setInfluenceInput('')
                  }}
                  disabled={!influenceInput.trim()}
                  className="rounded-xl border border-[rgba(255,85,0,0.3)] bg-[rgba(255,85,0,0.08)] px-4 py-3 text-sm font-semibold text-[#FF5500] transition-opacity hover:opacity-80 disabled:opacity-30"
                >
                  Add
                </button>
              </div>
            )}
            <p className="mt-1.5 text-xs text-[rgba(240,239,235,0.2)]">Press Enter or comma to add · shows on your profile</p>
          </section>

          {/* ── Blocked users ──────────────────────────────────────────────────── */}
          {blockedIds.length > 0 && (
            <section className="space-y-2 border-t border-[rgba(240,239,235,0.06)] pt-4">
              <SectionLabel>Blocked users</SectionLabel>
              {blockedProfiles.map(p => {
                const initials = (p.display_name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                return (
                  <div key={p.id} className="flex items-center gap-3 rounded-xl border border-[rgba(240,239,235,0.08)] bg-[#1C1C1C] px-4 py-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full" style={{ background: '#2a2a2a', border: '1px solid rgba(240,239,235,0.1)' }}>
                      {p.avatar_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                        : <span className="font-[family-name:var(--font-bebas)] text-sm text-[rgba(240,239,235,0.4)]">{initials}</span>
                      }
                    </div>
                    <span className="flex-1 text-sm text-[rgba(240,239,235,0.7)]">{p.display_name ?? 'Unknown'}</span>
                    <button
                      onClick={() => {
                        try { localStorage.removeItem(`blocked_${p.id}`) } catch { /* ignore */ }
                        setBlockedIds(prev => prev.filter(id => id !== p.id))
                        setBlockedProfiles(prev => prev.filter(x => x.id !== p.id))
                      }}
                      className="rounded-full border border-[rgba(255,92,0,0.25)] px-3 py-1 text-xs font-medium text-[#FF5C00] transition-colors hover:bg-[rgba(255,92,0,0.08)]"
                    >
                      Unblock
                    </button>
                  </div>
                )
              })}
            </section>
          )}

          {/* ── Account actions ────────────────────────────────────────────────── */}
          <section className="space-y-3 border-t border-[rgba(240,239,235,0.06)] pt-4">
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
      <div className="fixed bottom-0 left-0 right-0 border-t border-[rgba(240,239,235,0.06)] bg-[rgba(13,13,13,0.92)] px-4 pt-4 backdrop-blur-md" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>
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
