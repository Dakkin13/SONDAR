'use client'

import { useRef, useState } from 'react'
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
  onDisplayNameChange: (v: string) => void
  onCityChange: (v: string) => void
  onCitySelect: (name: string, lat: number, lng: number) => void
  onBioChange: (v: string) => void
  onAudioLinkChange: (v: string) => void
  onInstagramUrlChange: (v: string) => void
  onAvatarUrlChange: (url: string) => void
}

const BIO_MAX = 120

export default function Step3({
  displayName,
  city,
  bio,
  audioLink,
  instagramUrl,
  avatarUrl,
  onDisplayNameChange,
  onCityChange,
  onCitySelect,
  onBioChange,
  onAudioLinkChange,
  onInstagramUrlChange,
  onAvatarUrlChange,
}: Step3Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const supabase = createClient()

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Show local preview immediately
    const objectUrl = URL.createObjectURL(file)
    setLocalPreview(objectUrl)
    setUploadError(null)
    setUploading(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('Not signed in — please log in first')

      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${user.id}/avatar.${ext}`

      const { error } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true })

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
      // Reset input so the same file can be re-selected after an error
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const displayAvatar = avatarUrl ?? localPreview

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2
          className="mb-1 text-4xl text-[#F0EFEB]"
          style={{ fontFamily: 'var(--font-bebas)' }}
        >
          Make it yours
        </h2>
        <p className="text-sm text-[rgba(240,239,235,0.45)]">
          Let musicians know who you are
        </p>
      </div>

      {/* Avatar */}
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-[rgba(240,239,235,0.12)] bg-[#1C1C1C] transition-opacity hover:opacity-80 disabled:cursor-wait"
          aria-label="Upload profile photo"
        >
          {displayAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayAvatar}
              alt="Avatar preview"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-3xl">
              📷
            </span>
          )}

          {/* Uploading overlay */}
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <span className="text-xs text-[#F0EFEB]">···</span>
            </div>
          )}
        </button>

        <p className="text-xs text-[rgba(240,239,235,0.35)]">
          {uploading ? 'Uploading…' : 'Tap to add photo'}
        </p>

        {uploadError && (
          <p className="text-xs text-red-400">{uploadError}</p>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarChange}
        />
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
          <span
            className={cn(
              'absolute bottom-3 right-3 text-xs',
              bio.length >= BIO_MAX
                ? 'text-[#FF5500]'
                : 'text-[rgba(240,239,235,0.3)]',
            )}
          >
            {bio.length}/{BIO_MAX}
          </span>
        </div>

        {/* Audio link */}
        <div className="relative">
          <input
            type="url"
            value={audioLink}
            onChange={(e) => onAudioLinkChange(e.target.value)}
            placeholder="YouTube or SoundCloud link (optional)"
            className={cn(inputClass, 'pl-10')}
          />
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base leading-none">
            🎵
          </span>
        </div>

        {/* Instagram */}
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
    </div>
  )
}

function InstagramIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="rgba(240,239,235,0.4)"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.75" fill="rgba(240,239,235,0.4)" stroke="none" />
    </svg>
  )
}

const inputClass =
  'w-full rounded-xl border border-[rgba(240,239,235,0.08)] bg-[#1C1C1C] px-4 py-3 text-sm text-[#F0EFEB] placeholder:text-[rgba(240,239,235,0.3)] outline-none focus:border-[rgba(255,85,0,0.5)] focus:ring-1 focus:ring-[rgba(255,85,0,0.3)] transition-colors'
