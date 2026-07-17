'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Band, BandMemberProfile, BandRole } from '@/types'
import { useToast } from '@/components/ui/Toast'
import { getErrorMessage } from '@/lib/utils'

const inputClass =
  'w-full rounded-xl border border-[rgba(240,239,235,0.08)] bg-[#1C1C1C] px-4 py-3 text-sm text-[#F0EFEB] placeholder:text-[rgba(240,239,235,0.3)] outline-none focus:border-[rgba(255,85,0,0.5)] focus:ring-1 focus:ring-[rgba(255,85,0,0.3)] transition-colors'

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[rgba(240,239,235,0.3)]">
      {children}
    </p>
  )
}

export default function BandSettingsPage() {
  const { bandId } = useParams<{ bandId: string }>()
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  const [band, setBand] = useState<Band | null>(null)
  const [members, setMembers] = useState<BandMemberProfile[]>([])
  const [myRole, setMyRole] = useState<BandRole | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setCurrentUserId(user.id)

      const { data: bandData } = await supabase.from('bands').select('*').eq('id', bandId).single()
      if (!bandData) { router.push('/bands'); return }
      setBand(bandData as Band)
      setName(bandData.name)
      setBio(bandData.bio ?? '')
      setAvatarUrl(bandData.avatar_url)

      const { data: memberRows } = await supabase
        .from('band_members').select('user_id, role, joined_at').eq('band_id', bandId)

      const mine = (memberRows ?? []).find(m => m.user_id === user.id)
      if (!mine || (mine.role !== 'owner' && mine.role !== 'admin')) { router.push(`/bands/${bandId}`); return }
      setMyRole(mine.role as BandRole)

      const memberIds = (memberRows ?? []).map(m => m.user_id)
      const { data: profiles } = await supabase
        .from('profiles').select('id, display_name, avatar_url, instruments').in('id', memberIds)
      const profileMap = new Map(profiles?.map(p => [p.id, p]) ?? [])

      setMembers((memberRows ?? []).map(m => ({
        user_id: m.user_id,
        role: m.role as BandRole,
        joined_at: m.joined_at,
        display_name: profileMap.get(m.user_id)?.display_name ?? null,
        avatar_url: profileMap.get(m.user_id)?.avatar_url ?? null,
        instruments: (profileMap.get(m.user_id)?.instruments as BandMemberProfile['instruments']) ?? [],
      })))

      setLoading(false)
    }
    void load()
  }, [bandId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in')
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${user.id}/band-${bandId}-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      setAvatarUrl(data.publicUrl)
    } catch (err) {
      toast(getErrorMessage(err, 'Avatar upload failed'), 'error')
    } finally {
      setUploading(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('bands')
        .update({ name: name.trim(), bio: bio.trim() || null, avatar_url: avatarUrl, updated_at: new Date().toISOString() })
        .eq('id', bandId)
      if (error) throw error
      toast('Band updated', 'default')
    } catch (err) {
      toast(getErrorMessage(err, 'Could not save changes'), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!confirm('Remove this member from the band?')) return
    await supabase.from('band_members').delete().eq('band_id', bandId).eq('user_id', userId)
    setMembers(prev => prev.filter(m => m.user_id !== userId))
  }

  async function handleDisband() {
    if (!confirm(`Disband ${band?.name}? This deletes the band and all its messages permanently.`)) return
    await supabase.from('bands').delete().eq('id', bandId)
    router.push('/bands')
  }

  if (loading || !band) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '100dvh' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[rgba(240,239,235,0.12)] border-t-[#FF5500]" />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh' }}>
      <div
        className="sticky top-0 z-10 px-4 py-4"
        style={{
          background: 'rgba(13,13,13,0.92)',
          backdropFilter: 'blur(48px) saturate(180%)',
          WebkitBackdropFilter: 'blur(48px) saturate(180%)',
          borderBottom: '0.5px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="mx-auto max-w-lg flex items-center justify-between gap-3">
          <h1 className="text-[#F0EFEB]" style={{ fontFamily: 'var(--font-bebas)', fontSize: 24, letterSpacing: '0.08em' }}>
            BAND SETTINGS
          </h1>
          <button
            onClick={() => router.push(`/bands/${bandId}`)}
            className="rounded-xl border border-[rgba(240,239,235,0.10)] bg-[rgba(240,239,235,0.05)] px-3 py-2 text-sm font-medium text-[rgba(240,239,235,0.55)] transition-colors hover:border-[rgba(240,239,235,0.25)] hover:text-[#F0EFEB]"
          >
            ← Back
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 pt-5 pb-24">
        {/* Avatar */}
        <div className="mb-6 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploading}
            className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl"
            style={{ background: 'rgba(255,92,0,0.08)', border: '1.5px dashed rgba(255,92,0,0.3)' }}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span className="text-2xl">🎸</span>
            )}
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[rgba(240,239,235,0.2)] border-t-[#FF5500]" />
              </div>
            )}
          </button>
          <span className="text-xs text-[rgba(240,239,235,0.35)]">{uploading ? 'Uploading…' : 'Tap to change photo'}</span>
          <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => void handleAvatarChange(e)} />
        </div>

        {/* Name + bio */}
        <div className="mb-6">
          <SectionLabel>Name</SectionLabel>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className={inputClass} />
        </div>
        <div className="mb-6">
          <SectionLabel>Bio</SectionLabel>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} rows={3}
            className={`${inputClass} resize-none`} />
        </div>
        <button
          onClick={() => void handleSave()}
          disabled={saving || !name.trim()}
          className="mb-8 w-full rounded-xl bg-[#FF5500] py-3 text-sm font-semibold text-black disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>

        {/* Members */}
        <div className="mb-8">
          <SectionLabel>Members</SectionLabel>
          <div className="flex flex-col gap-2">
            {members.map(m => {
              const initials = (m.display_name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
              const isSelf = m.user_id === currentUserId
              return (
                <div key={m.user_id} className="flex items-center gap-3 rounded-xl bg-[rgba(255,255,255,0.03)] px-3 py-2.5">
                  {m.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div className="flex items-center justify-center rounded-full" style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.06)' }}>
                      <span style={{ fontFamily: 'var(--font-bebas)', fontSize: 12, color: 'rgba(240,239,235,0.5)' }}>{initials}</span>
                    </div>
                  )}
                  <span className="flex-1 text-sm text-[#F0EFEB]">
                    {m.display_name ?? 'Unknown'} {isSelf && <span className="text-[rgba(240,239,235,0.3)]">(you)</span>}
                  </span>
                  <span className="text-[9px] tracking-wider text-[rgba(240,239,235,0.3)]">{m.role.toUpperCase()}</span>
                  {!isSelf && m.role !== 'owner' && (
                    <button
                      onClick={() => void handleRemoveMember(m.user_id)}
                      className="text-xs text-[rgba(255,100,100,0.5)] hover:text-[rgba(255,100,100,0.9)]"
                    >
                      Remove
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Danger zone — owner only */}
        {myRole === 'owner' && (
          <div className="border-t border-[rgba(255,100,100,0.15)] pt-6">
            <SectionLabel>Danger zone</SectionLabel>
            <button
              onClick={() => void handleDisband()}
              className="w-full rounded-xl border border-[rgba(255,100,100,0.3)] py-3 text-sm font-medium text-[rgba(255,100,100,0.8)] transition-colors hover:bg-[rgba(255,100,100,0.08)]"
            >
              Disband band
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
