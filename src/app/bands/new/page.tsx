'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Connection {
  id: string
  display_name: string | null
  avatar_url: string | null
}

// tap() fires on touch devices via touchend (with preventDefault so no double-fire)
// and falls back to onClick on desktop — same pattern used in onboarding/Step1.tsx.
function tap(fn: () => void) {
  return {
    onClick: fn,
    onTouchEnd: (e: React.TouchEvent) => { e.preventDefault(); fn() },
  }
}

const TOTAL_STEPS = 2

export default function NewBandPage() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const [connections, setConnections] = useState<Connection[]>([])
  const [loadingConnections, setLoadingConnections] = useState(true)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  useEffect(() => {
    async function loadConnections() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: msgs } = await supabase
        .from('messages')
        .select('from_id, to_id')
        .or(`from_id.eq.${user.id},to_id.eq.${user.id}`)

      const partnerIds = new Set<string>()
      for (const m of msgs ?? []) {
        partnerIds.add(m.from_id === user.id ? m.to_id : m.from_id)
      }

      if (partnerIds.size === 0) { setConnections([]); setLoadingConnections(false); return }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', Array.from(partnerIds))

      setConnections((profiles as Connection[]) ?? [])
      setLoadingConnections(false)
    }
    void loadConnections()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const objectUrl = URL.createObjectURL(file)
    setLocalPreview(objectUrl)
    setUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in')
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${user.id}/band-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      setAvatarUrl(data.publicUrl)
      URL.revokeObjectURL(objectUrl)
      setLocalPreview(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Avatar upload failed')
      setLocalPreview(null)
    } finally {
      setUploading(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  function toggleMember(id: string) {
    try { navigator.vibrate?.(10) } catch { /* ignore */ }
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function handleCreate() {
    setSaving(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in')

      const { data: band, error: bandError } = await supabase
        .from('bands')
        .insert({ name: name.trim(), bio: bio.trim() || null, avatar_url: avatarUrl, created_by: user.id })
        .select()
        .single()
      if (bandError) throw bandError

      // Insert the owner row first and let it commit before adding other members —
      // the RLS policy on band_members checks is_band_admin(band_id) for anyone
      // other than yourself, which only sees this owner row once it's committed
      // as its own statement, not as part of a single batched insert.
      const { error: ownerError } = await supabase
        .from('band_members')
        .insert({ band_id: band.id, user_id: user.id, role: 'owner' })
      if (ownerError) throw ownerError

      if (selectedIds.length > 0) {
        const memberRows = selectedIds.map(id => ({ band_id: band.id, user_id: id, role: 'member' }))
        const { error: membersError } = await supabase.from('band_members').insert(memberRows)
        if (membersError) throw membersError
      }

      router.push(`/bands/${band.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create band')
      setSaving(false)
    }
  }

  const canAdvance = step === 1 ? name.trim().length > 0 : true
  const progressPct = ((step - 1) / (TOTAL_STEPS - 1)) * 100
  const displayAvatar = localPreview ?? avatarUrl

  return (
    <div className="relative flex flex-col" style={{ zIndex: 1, minHeight: '100dvh' }}>
      {error && (
        <div className="fixed left-0 right-0 top-0 z-[100] bg-red-950 px-4 py-3 text-center">
          <p className="text-sm font-medium text-red-300 break-words">{error}</p>
          <button onClick={() => setError(null)} className="mt-1 text-xs text-red-400 underline hover:text-red-200">
            Dismiss
          </button>
        </div>
      )}

      {/* Progress bar */}
      <div className="fixed left-0 right-0 top-0 z-50 h-[3px] bg-[rgba(240,239,235,0.08)]">
        <div
          className="h-full bg-[#FF5500] shadow-[0_0_8px_rgba(255,85,0,0.6)] transition-[width] duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <button
        type="button"
        onClick={() => router.push('/bands')}
        className="fixed left-4 top-4 z-50 text-xs text-[rgba(240,239,235,0.28)] hover:text-[rgba(240,239,235,0.6)] transition-colors"
      >
        Cancel
      </button>
      <div className="fixed right-4 top-4 z-50 text-xs text-[rgba(240,239,235,0.35)]">
        {step} / {TOTAL_STEPS}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-4" style={{ paddingTop: 60, paddingBottom: 100 }}>
        <div className="w-full max-w-lg">
          {step === 1 && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="mb-1 text-4xl text-[#F0EFEB]" style={{ fontFamily: 'var(--font-bebas)' }}>
                  Name your band
                </h2>
                <p className="text-sm text-[rgba(240,239,235,0.45)]">You can change this later</p>
              </div>

              {/* Avatar upload */}
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploading}
                  className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl"
                  style={{ background: 'rgba(255,92,0,0.08)', border: '1.5px dashed rgba(255,92,0,0.3)' }}
                >
                  {displayAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={displayAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span className="text-2xl">🎸</span>
                  )}
                  {uploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-[rgba(240,239,235,0.2)] border-t-[#FF5500]" />
                    </div>
                  )}
                </button>
                <span className="text-xs text-[rgba(240,239,235,0.35)]">
                  {uploading ? 'Uploading…' : 'Tap to add a photo'}
                </span>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void handleAvatarChange(e)}
                />
              </div>

              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Band name"
                maxLength={60}
                className="w-full rounded-xl border border-[rgba(240,239,235,0.10)] bg-[rgba(240,239,235,0.06)] px-4 py-3 text-base text-[#F0EFEB] placeholder-[rgba(240,239,235,0.3)] outline-none focus:border-[rgba(255,85,0,0.4)]"
              />
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="What's this band about? (optional)"
                maxLength={160}
                rows={3}
                className="w-full resize-none rounded-xl border border-[rgba(240,239,235,0.10)] bg-[rgba(240,239,235,0.06)] px-4 py-3 text-sm text-[#F0EFEB] placeholder-[rgba(240,239,235,0.3)] outline-none focus:border-[rgba(255,85,0,0.4)]"
              />
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="mb-1 text-4xl text-[#F0EFEB]" style={{ fontFamily: 'var(--font-bebas)' }}>
                  Add members
                </h2>
                <p className="text-sm text-[rgba(240,239,235,0.45)]">
                  Pick from people you already talk to — you can invite more later.
                </p>
              </div>

              {loadingConnections ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-[rgba(240,239,235,0.12)] border-t-[#FF5500]" />
                </div>
              ) : connections.length === 0 ? (
                <div className="rounded-xl border border-[rgba(240,239,235,0.08)] bg-[rgba(240,239,235,0.03)] px-4 py-6 text-center">
                  <p className="text-sm text-[rgba(240,239,235,0.5)]">
                    You don&apos;t have any conversations yet.
                  </p>
                  <p className="mt-1 text-xs text-[rgba(240,239,235,0.3)]">
                    Message a musician first, then come back to form a band with them.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {connections.map((c) => {
                    const selected = selectedIds.includes(c.id)
                    const initials = (c.display_name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                    return (
                      <button
                        key={c.id}
                        type="button"
                        {...tap(() => toggleMember(c.id))}
                        style={{ WebkitTapHighlightColor: 'rgba(255,85,0,0.2)', touchAction: 'manipulation' }}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all active:scale-[0.98] ${
                          selected
                            ? 'bg-[#FF5500]'
                            : 'glass'
                        }`}
                      >
                        {c.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div className="flex items-center justify-center rounded-full"
                            style={{ width: 36, height: 36, background: selected ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.06)' }}>
                            <span style={{ fontFamily: 'var(--font-bebas)', fontSize: 13, color: selected ? '#000' : 'rgba(240,239,235,0.5)' }}>
                              {initials}
                            </span>
                          </div>
                        )}
                        <span className={`text-sm font-medium ${selected ? 'text-black' : 'text-[#F0EFEB]'}`}>
                          {c.display_name ?? 'Unknown musician'}
                        </span>
                        {selected && (
                          <svg className="ml-auto" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>
        <div aria-hidden className="pointer-events-none h-10" style={{ background: 'linear-gradient(to bottom, transparent, #0D0D0D)' }} />
        <div className="flex items-center justify-between bg-[#0D0D0D] px-4 pt-3">
          <button
            type="button"
            onClick={() => { if (step > 1) setStep(step - 1) }}
            onTouchEnd={(e) => { e.preventDefault(); if (step > 1) setStep(step - 1) }}
            disabled={step === 1}
            style={{ touchAction: 'manipulation' }}
            className="rounded-xl px-5 py-2.5 text-sm font-medium text-[rgba(240,239,235,0.45)] transition-opacity hover:text-[#F0EFEB] disabled:opacity-0"
          >
            ← Back
          </button>

          <button
            type="button"
            onClick={() => { if (canAdvance && !saving) void (step === TOTAL_STEPS ? handleCreate() : setStep(step + 1)) }}
            onTouchEnd={(e) => { e.preventDefault(); if (canAdvance && !saving) void (step === TOTAL_STEPS ? handleCreate() : setStep(step + 1)) }}
            disabled={!canAdvance || saving}
            style={{ touchAction: 'manipulation' }}
            className="flex h-[52px] items-center rounded-full bg-[#FF5500] px-8 text-base font-semibold text-black shadow-[0_0_16px_rgba(255,85,0,0.35)] transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {saving ? 'Creating…' : step === TOTAL_STEPS ? 'Create band' : 'Continue →'}
          </button>
        </div>
      </div>
    </div>
  )
}
