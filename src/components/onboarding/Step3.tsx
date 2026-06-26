'use client'

import { useRef, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import CityAutocomplete from './CityAutocomplete'

interface Step3Props {
  displayName: string
  city: string
  bio: string
  audioLink: string
  instagramUrl: string
  avatarUrl: string | null
  photoUrls: string[]
  influences: string[]
  onDisplayNameChange: (v: string) => void
  onCityChange: (v: string) => void
  onCitySelect: (name: string, lat: number, lng: number) => void
  onBioChange: (v: string) => void
  onAudioLinkChange: (v: string) => void
  onInstagramUrlChange: (v: string) => void
  onAvatarUrlChange: (url: string) => void
  onPhotoUrlsChange: (urls: string[]) => void
  onInfluencesChange: (v: string[]) => void
}

const MAX_ADDITIONAL = 3
const BIO_MAX = 120

export default function Step3({
  displayName,
  city,
  bio,
  audioLink,
  instagramUrl,
  avatarUrl,
  photoUrls,
  influences,
  onDisplayNameChange,
  onCityChange,
  onCitySelect,
  onBioChange,
  onAudioLinkChange,
  onInstagramUrlChange,
  onAvatarUrlChange,
  onPhotoUrlsChange,
  onInfluencesChange,
}: Step3Props) {
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const photoInputRef  = useRef<HTMLInputElement>(null)
  const [uploading, setUploading]           = useState(false)
  const [uploadingSlot, setUploadingSlot]   = useState<number | null>(null)
  const [uploadError, setUploadError]       = useState<string | null>(null)
  const [localPreview, setLocalPreview]     = useState<string | null>(null)
  const [influenceInput, setInfluenceInput] = useState('')
  const pendingSlotRef = useRef<number | null>(null)
  const supabase = createClient()

  const addInfluence = useCallback((name: string) => {
    const trimmed = name.trim().replace(/,$/, '')
    if (trimmed && !influences.includes(trimmed) && influences.length < 10) {
      onInfluencesChange([...influences, trimmed])
    }
    setInfluenceInput('')
  }, [influences, onInfluencesChange])

  async function getUser() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not signed in')
    return user
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const objectUrl = URL.createObjectURL(file)
    setLocalPreview(objectUrl)
    setUploadError(null)
    setUploading(true)
    try {
      const user = await getUser()
      const ext  = file.name.split('.').pop() ?? 'jpg'
      const path = `${user.id}/avatar.${ext}`
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      onAvatarUrlChange(data.publicUrl)
      URL.revokeObjectURL(objectUrl)
      setLocalPreview(null)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
      setLocalPreview(null)
    } finally {
      setUploading(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  function openPhotoSlot(idx: number) {
    if (idx >= MAX_ADDITIONAL) return
    pendingSlotRef.current = idx
    photoInputRef.current?.click()
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const slot = pendingSlotRef.current
    if (!file || slot === null) return
    setUploadingSlot(slot)
    setUploadError(null)
    try {
      const user = await getUser()
      const ts   = Date.now()
      const ext  = file.name.split('.').pop() ?? 'jpg'
      const path = `${user.id}/photos/${ts}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}.${ext}`
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const next = [...photoUrls]
      next[slot] = data.publicUrl
      onPhotoUrlsChange(next.filter(Boolean))
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Photo upload failed')
    } finally {
      setUploadingSlot(null)
      pendingSlotRef.current = null
      if (photoInputRef.current) photoInputRef.current.value = ''
    }
  }

  function removePhoto(idx: number) {
    const next = [...photoUrls]
    next.splice(idx, 1)
    onPhotoUrlsChange(next)
  }

  const displayAvatar = localPreview ?? avatarUrl

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="mb-1 text-4xl text-[#F0EFEB]" style={{ fontFamily: 'var(--font-bebas)' }}>
          Make it yours
        </h2>
        <p className="text-sm text-[rgba(240,239,235,0.45)]">
          Let musicians know who you are
        </p>
      </div>

      {/* Primary avatar */}
      <div className="flex flex-col items-center gap-2">
        <p className="self-start text-[10px] font-semibold uppercase tracking-widest text-[rgba(240,239,235,0.3)]">
          Profile photo
        </p>
        <p className="self-start text-xs text-[rgba(240,239,235,0.3)] -mt-1 mb-1">
          This is what people see on the map
        </p>

        <button
          onClick={() => avatarInputRef.current?.click()}
          disabled={uploading}
          className="relative h-[100px] w-[100px] overflow-hidden rounded-full border-2 border-[rgba(240,239,235,0.12)] bg-[#1C1C1C] transition-opacity hover:opacity-80 disabled:cursor-wait"
          aria-label="Upload profile photo"
        >
          {displayAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={displayAvatar} alt="Avatar preview" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-3xl">📷</span>
          )}
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            </div>
          )}
        </button>

        <p className="text-xs text-[rgba(240,239,235,0.35)]">
          {uploading ? 'Uploading…' : 'Tap to add photo'}
        </p>
        {uploadError && <p className="text-xs text-red-400">{uploadError}</p>}

        <input ref={avatarInputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => void handleAvatarChange(e)} />
      </div>

      {/* Additional photos */}
      <div>
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[rgba(240,239,235,0.3)]">
          Add more photos{' '}
          <span className="normal-case font-normal text-[rgba(240,239,235,0.2)]">(optional)</span>
        </p>
        <div className="flex gap-3">
          {Array.from({ length: MAX_ADDITIONAL }).map((_, i) => {
            const url = photoUrls[i]
            const busy = uploadingSlot === i
            return (
              <div key={i} className="relative h-20 w-20 flex-shrink-0">
                {url ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Photo ${i + 1}`}
                      className="h-full w-full rounded-xl object-cover" />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black text-[10px] text-white"
                      style={{ border: '1.5px solid rgba(240,239,235,0.3)' }}
                      aria-label="Remove photo"
                    >
                      ×
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => openPhotoSlot(i)}
                    disabled={busy}
                    className="flex h-full w-full items-center justify-center rounded-xl"
                    style={{
                      border: '1.5px dashed rgba(240,239,235,0.18)',
                      background: 'rgba(240,239,235,0.03)',
                    }}
                    aria-label={`Add photo ${i + 1}`}
                  >
                    {busy ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                    ) : (
                      <span className="text-lg text-[rgba(240,239,235,0.2)]">+</span>
                    )}
                  </button>
                )}
              </div>
            )
          })}
        </div>
        <input ref={photoInputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => void handlePhotoChange(e)} />
      </div>

      {/* Fields */}
      <div className="flex flex-col gap-4">
        <input
          type="text"
          value={displayName}
          onChange={(e) => onDisplayNameChange(e.target.value)}
          placeholder="Your name"
          maxLength={50}
          className={inputClass}
        />

        <CityAutocomplete
          value={city}
          onChange={onCityChange}
          onSelect={onCitySelect}
        />

        <div className="relative">
          <textarea
            value={bio}
            onChange={(e) => onBioChange(e.target.value.slice(0, BIO_MAX))}
            placeholder="A few words about you and your music…"
            rows={3}
            className={cn(inputClass, 'resize-none pb-6')}
          />
          <span className={cn(
            'absolute bottom-3 right-3 text-xs',
            bio.length >= BIO_MAX ? 'text-[#FF5500]' : 'text-[rgba(240,239,235,0.3)]',
          )}>
            {bio.length}/{BIO_MAX}
          </span>
        </div>

        <div className="relative">
          <input
            type="url"
            value={audioLink}
            onChange={(e) => onAudioLinkChange(e.target.value)}
            placeholder="YouTube or SoundCloud link (optional)"
            className={cn(inputClass, 'pl-10')}
          />
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base leading-none">🎵</span>
        </div>

        <div className="relative">
          <input
            type="text"
            value={instagramUrl}
            onChange={(e) => onInstagramUrlChange(e.target.value)}
            placeholder="Instagram handle or URL (optional)"
            className={cn(inputClass, 'pl-10')}
          />
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 leading-none">
            <InstagramIcon />
          </span>
        </div>
      </div>

      {/* Artists I like */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[rgba(240,239,235,0.3)]">
          Artists I like{' '}
          <span className="normal-case font-normal text-[rgba(240,239,235,0.2)]">(optional · up to 10)</span>
        </p>
        {influences.length > 0 && (
          <div className="mb-2.5 flex flex-wrap gap-2">
            {influences.map(artist => (
              <span
                key={artist}
                className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
                style={{ background: 'rgba(255,85,0,0.10)', border: '1px solid rgba(255,85,0,0.22)', color: 'rgba(240,239,235,0.85)' }}
              >
                {artist}
                <button
                  onClick={() => onInfluencesChange(influences.filter(a => a !== artist))}
                  className="text-[rgba(240,239,235,0.4)] hover:text-[#FF5500]"
                  aria-label={`Remove ${artist}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        {influences.length < 10 && (
          <div className="flex gap-2">
            <input
              type="text"
              value={influenceInput}
              onChange={e => setInfluenceInput(e.target.value)}
              onKeyDown={e => {
                if ((e.key === 'Enter' || e.key === ',') && influenceInput.trim()) {
                  e.preventDefault()
                  addInfluence(influenceInput)
                }
              }}
              placeholder="e.g. Radiohead, Portishead…"
              className={cn(inputClass, 'flex-1')}
            />
            <button
              onClick={() => addInfluence(influenceInput)}
              disabled={!influenceInput.trim()}
              className="rounded-xl border border-[rgba(255,85,0,0.3)] bg-[rgba(255,85,0,0.08)] px-4 py-3 text-sm font-semibold text-[#FF5500] disabled:opacity-30"
            >
              Add
            </button>
          </div>
        )}
        <p className="mt-1.5 text-xs text-[rgba(240,239,235,0.2)]">Press Enter or comma to add</p>
      </div>
    </div>
  )
}

function InstagramIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="rgba(240,239,235,0.4)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.75" fill="rgba(240,239,235,0.4)" stroke="none" />
    </svg>
  )
}

const inputClass =
  'w-full rounded-xl border border-[rgba(240,239,235,0.08)] bg-[#1C1C1C] px-4 py-3 text-sm text-[#F0EFEB] placeholder:text-[rgba(240,239,235,0.3)] outline-none focus:border-[rgba(255,85,0,0.5)] focus:ring-1 focus:ring-[rgba(255,85,0,0.3)] transition-colors'
