'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import type { Band, BandMemberProfile, BandRole, ProfileSummary } from '@/types'
import BottomNav from '@/components/ui/BottomNav'
import Avatar from '@/components/ui/Avatar'
import { useToast } from '@/components/ui/Toast'
import { getErrorMessage } from '@/lib/utils'
import { tap } from '@/lib/touch'
import { useEscapeKey } from '@/lib/hooks/useEscapeKey'

type Connection = ProfileSummary

interface PendingRequest {
  id: string
  invited_user_id: string
  display_name: string | null
}

function shortId(id: string): string {
  return id.replace(/-/g, '').slice(0, 6).toUpperCase()
}

const ROLE_LABEL: Record<BandRole, string> = { owner: 'OWNER', admin: 'ADMIN', member: 'MEMBER' }

export default function BandDetailPage() {
  const { bandId } = useParams<{ bandId: string }>()
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  const [band, setBand] = useState<Band | null>(null)
  const [members, setMembers] = useState<BandMemberProfile[]>([])
  const [myRole, setMyRole] = useState<BandRole | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [showInvite, setShowInvite] = useState(false)
  const [connections, setConnections] = useState<Connection[]>([])
  const [selectedInviteIds, setSelectedInviteIds] = useState<string[]>([])
  const [inviting, setInviting] = useState(false)
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([])

  const isAdmin = myRole === 'owner' || myRole === 'admin'

  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setCurrentUserId(user.id)

    const { data: bandData, error: bandError } = await supabase
      .from('bands').select('*').eq('id', bandId).single()

    if (bandError || !bandData) { setNotFound(true); setLoading(false); return }
    setBand(bandData as Band)

    const { data: memberRows } = await supabase
      .from('band_members')
      .select('user_id, role, joined_at')
      .eq('band_id', bandId)

    const mine = (memberRows ?? []).find(m => m.user_id === user.id)
    if (!mine) { setNotFound(true); setLoading(false); return }
    setMyRole(mine.role as BandRole)

    const memberIds = (memberRows ?? []).map(m => m.user_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, instruments')
      .in('id', memberIds)
    const profileMap = new Map(profiles?.map(p => [p.id, p]) ?? [])

    setMembers((memberRows ?? []).map(m => ({
      user_id: m.user_id,
      role: m.role as BandRole,
      joined_at: m.joined_at,
      display_name: profileMap.get(m.user_id)?.display_name ?? null,
      avatar_url: profileMap.get(m.user_id)?.avatar_url ?? null,
      instruments: (profileMap.get(m.user_id)?.instruments as BandMemberProfile['instruments']) ?? [],
    })))

    if (mine.role === 'owner' || mine.role === 'admin') {
      const { data: requests } = await supabase
        .from('band_join_requests')
        .select('id, invited_user_id')
        .eq('band_id', bandId)
        .eq('status', 'pending')
      const invitedIds = (requests ?? []).map(r => r.invited_user_id)
      if (invitedIds.length > 0) {
        const { data: invitedProfiles } = await supabase
          .from('profiles').select('id, display_name').in('id', invitedIds)
        const invitedMap = new Map(invitedProfiles?.map(p => [p.id, p.display_name]) ?? [])
        setPendingRequests((requests ?? []).map(r => ({
          id: r.id, invited_user_id: r.invited_user_id,
          display_name: invitedMap.get(r.invited_user_id) ?? null,
        })))
      } else {
        setPendingRequests([])
      }
    }

    setLoading(false)
  }

  useEffect(() => {
    void loadAll()
  }, [bandId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function openInvite() {
    setShowInvite(true)
    if (connections.length > 0 || !currentUserId) return
    const { data: msgs } = await supabase
      .from('messages')
      .select('from_id, to_id')
      .or(`from_id.eq.${currentUserId},to_id.eq.${currentUserId}`)
    const partnerIds = new Set<string>()
    for (const m of msgs ?? []) {
      partnerIds.add(m.from_id === currentUserId ? m.to_id : m.from_id)
    }
    const memberIds = new Set(members.map(m => m.user_id))
    const candidateIds = Array.from(partnerIds).filter(id => !memberIds.has(id))
    if (candidateIds.length === 0) { setConnections([]); return }
    const { data: profiles } = await supabase
      .from('profiles').select('id, display_name, avatar_url').in('id', candidateIds)
    setConnections((profiles as Connection[]) ?? [])
  }

  useEscapeKey(showInvite, () => setShowInvite(false))

  function toggleInvite(id: string) {
    try { navigator.vibrate?.(10) } catch { /* ignore */ }
    setSelectedInviteIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function submitInvites() {
    if (selectedInviteIds.length === 0 || !currentUserId) return
    setInviting(true)
    try {
      const rows = selectedInviteIds.map(id => ({
        band_id: bandId, invited_user_id: id, invited_by: currentUserId,
      }))
      const { error } = await supabase.from('band_join_requests').insert(rows)
      if (error) throw error
      toast('Invite sent!', 'default')
      setShowInvite(false)
      setSelectedInviteIds([])
      void loadAll()
    } catch (err) {
      toast(getErrorMessage(err, 'Could not send invite'), 'error')
    } finally {
      setInviting(false)
    }
  }

  async function respondToRequest(requestId: string, accept: boolean) {
    await supabase
      .from('band_join_requests')
      .update({ status: accept ? 'accepted' : 'declined', responded_at: new Date().toISOString() })
      .eq('id', requestId)
    if (accept) {
      const req = pendingRequests.find(r => r.id === requestId)
      if (req) {
        await supabase.from('band_members').insert({ band_id: bandId, user_id: req.invited_user_id, role: 'member' })
      }
    }
    void loadAll()
  }

  async function handleLeave() {
    if (!currentUserId) return
    await supabase.from('band_members').delete().eq('band_id', bandId).eq('user_id', currentUserId)
    router.push('/bands')
  }

  async function handleDisband() {
    await supabase.from('bands').delete().eq('id', bandId)
    router.push('/bands')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '100dvh' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[rgba(240,239,235,0.12)] border-t-[#FF5500]" />
      </div>
    )
  }

  if (notFound || !band) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 text-[#F0EFEB]" style={{ minHeight: '100dvh' }}>
        <p className="font-[family-name:var(--font-bebas)] text-4xl tracking-widest text-[rgba(240,239,235,0.3)]">
          BAND NOT FOUND
        </p>
        <button onClick={() => router.push('/bands')} className="text-sm text-[rgba(240,239,235,0.4)] underline hover:text-[#F0EFEB]">
          ← Back to Bands
        </button>
      </div>
    )
  }

  return (
    <div className="relative overflow-y-auto" style={{ minHeight: '100dvh', paddingBottom: 90, zIndex: 1, overflowX: 'clip' }}>

      {/* Invite sheet */}
      {showInvite && (
        <div
          className="fixed inset-0 z-[200] flex cursor-pointer items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowInvite(false)}
        >
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', damping: 28, stiffness: 340 }}
            className="w-full max-w-lg rounded-t-3xl p-6"
            style={{ background: 'rgba(18,18,18,0.98)', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '80dvh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <p className="font-[family-name:var(--font-bebas)] text-2xl tracking-widest text-[#F0EFEB]">
              INVITE TO {band.name.toUpperCase()}
            </p>
            <p className="mt-1 text-xs text-[rgba(240,239,235,0.4)]">
              They&apos;ll need to accept before joining.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {connections.length === 0 ? (
                <p className="py-6 text-center text-sm text-[rgba(240,239,235,0.35)]">
                  No available connections to invite.
                </p>
              ) : connections.map(c => {
                const selected = selectedInviteIds.includes(c.id)
                const initials = (c.display_name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                return (
                  <button
                    key={c.id}
                    type="button"
                    {...tap(() => toggleInvite(c.id))}
                    style={{ WebkitTapHighlightColor: 'rgba(255,85,0,0.2)', touchAction: 'manipulation' }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all active:scale-[0.98] ${selected ? 'bg-[#FF5500]' : 'glass'}`}
                  >
                    <Avatar
                      src={c.avatar_url}
                      alt=""
                      size={32}
                      background={selected ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.06)'}
                    >
                      <span style={{ fontFamily: 'var(--font-bebas)', fontSize: 12, color: selected ? '#000' : 'rgba(240,239,235,0.5)' }}>
                        {initials}
                      </span>
                    </Avatar>
                    <span className={`text-sm font-medium ${selected ? 'text-black' : 'text-[#F0EFEB]'}`}>
                      {c.display_name ?? 'Unknown musician'}
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="mt-5 flex flex-col gap-2">
              <button
                onClick={() => void submitInvites()}
                disabled={selectedInviteIds.length === 0 || inviting}
                className="w-full rounded-xl bg-[#FF5500] py-3 text-sm font-semibold text-black disabled:opacity-40"
              >
                {inviting ? 'Sending…' : `Send invite${selectedInviteIds.length > 1 ? 's' : ''}`}
              </button>
              <button onClick={() => setShowInvite(false)} className="w-full rounded-xl py-3 text-sm text-[rgba(240,239,235,0.4)]">
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Ambient orbs */}
      <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: 500, height: 500,
          background: 'radial-gradient(circle at 80% 10%, rgba(255,92,0,0.18) 0%, transparent 60%)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: '10%', left: 0, width: 400, height: 400,
          background: 'radial-gradient(circle at 20% 80%, rgba(139,92,246,0.14) 0%, transparent 60%)', borderRadius: '50%' }} />
      </div>

      <button onClick={() => router.push('/bands')}
        className="absolute left-4 top-4 z-10 rounded-xl bg-[rgba(13,13,13,0.6)] px-3 py-2 text-sm font-medium text-[rgba(240,239,235,0.6)] backdrop-blur-md transition-colors hover:text-[#F0EFEB]"
        style={{ backdropFilter: 'blur(20px)', top: 'calc(16px + env(safe-area-inset-top, 0px))', minHeight: 44 }}>
        ← Bands
      </button>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto px-4 pt-16"
        style={{ maxWidth: 480, paddingTop: 'calc(64px + env(safe-area-inset-top, 0px))' }}
      >
        <div
          className="relative overflow-hidden rounded-2xl"
          style={{
            background: 'rgba(10,10,10,0.96)',
            border: '1px solid rgba(240,239,235,0.08)',
            boxShadow: '0 0 60px rgba(255,92,0,0.10), 0 24px 80px rgba(0,0,0,0.6)',
          }}
        >
          <span className="absolute left-3 top-3 block h-4 w-4 border-l border-t border-[rgba(240,239,235,0.18)]" />
          <span className="absolute right-3 top-3 block h-4 w-4 border-r border-t border-[rgba(240,239,235,0.18)]" />
          <span className="absolute bottom-3 left-3 block h-4 w-4 border-b border-l border-[rgba(240,239,235,0.18)]" />
          <span className="absolute bottom-3 right-3 block h-4 w-4 border-b border-r border-[rgba(240,239,235,0.18)]" />

          {/* Header strip */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div>
              <p className="text-[14px] leading-none tracking-[0.12em] text-[#F0EFEB]"
                style={{ fontFamily: 'var(--font-bebas)' }}>SONDAR</p>
              <p className="mt-0.5 text-[7px] tracking-[0.22em] text-[rgba(240,239,235,0.35)]">BAND · ALL AREAS</p>
              <div className="mt-1.5 h-px w-8 bg-[#FF5C00]" />
            </div>
            {myRole && (
              <div className="flex items-center gap-1 rounded-full border border-[rgba(255,92,0,0.4)] bg-[rgba(255,92,0,0.12)] px-2 py-0.5">
                <span className="text-[6.5px] font-bold tracking-[0.15em] text-[#FF5C00]">{ROLE_LABEL[myRole]}</span>
              </div>
            )}
          </div>

          {/* Avatar section */}
          <div className="relative mx-4 mb-0 h-[160px] overflow-hidden rounded-xl bg-[#060606]">
            <div className="absolute inset-0 flex items-center justify-center">
              <div style={{ width: 80, height: 80, borderRadius: '50%',
                background: 'rgba(255,92,0,0.15)', position: 'absolute', filter: 'blur(30px)' }} />
              <Avatar
                src={band.avatar_url}
                alt={band.name}
                size={88}
                shape="rounded"
                radius={20}
                border={band.avatar_url ? '2px solid rgba(255,92,0,0.6)' : '2px solid rgba(255,92,0,0.5)'}
                boxShadow={band.avatar_url ? '0 0 24px rgba(255,92,0,0.35)' : undefined}
                background="#1a1a1a"
                style={{ position: 'relative', zIndex: 1 }}
                priority
              >
                <span className="text-3xl">🎸</span>
              </Avatar>
            </div>
            <p className="absolute bottom-2 left-3 text-[7px] tracking-widest text-[rgba(240,239,235,0.3)]">
              ID # BND-{shortId(band.id)}
            </p>
          </div>

          {/* Name */}
          <div className="px-5 pt-3 pb-2">
            <h1 className="text-[28px] leading-none tracking-[0.04em] text-[#F0EFEB]"
              style={{ fontFamily: 'var(--font-bebas)' }}>
              {band.name.toUpperCase()}
            </h1>
            <p className="mt-0.5 text-[9px] tracking-[0.14em] text-[rgba(240,239,235,0.38)] uppercase">
              {members.length} member{members.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Bio */}
          {band.bio && (
            <div className="mx-5 mb-3 border-t border-[rgba(240,239,235,0.06)] pt-3">
              <p className="text-[11px] leading-relaxed text-[rgba(240,239,235,0.6)]">{band.bio}</p>
            </div>
          )}

          {/* Members */}
          <div className="mx-5 mb-3 border-t border-[rgba(240,239,235,0.06)] pt-3">
            <p className="mb-2.5 text-[7px] tracking-[0.2em] uppercase text-[rgba(240,239,235,0.28)]">Members</p>
            <div className="flex flex-col gap-2">
              {members.map(m => {
                const initials = (m.display_name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                return (
                  <button
                    key={m.user_id}
                    onClick={() => router.push(`/profile/${m.user_id}`)}
                    className="flex w-full items-center gap-2.5 text-left"
                  >
                    <Avatar src={m.avatar_url} alt="" size={30}>
                      <span style={{ fontFamily: 'var(--font-bebas)', fontSize: 11, color: 'rgba(240,239,235,0.5)' }}>{initials}</span>
                    </Avatar>
                    <span className="flex-1 text-[12px] text-[rgba(240,239,235,0.85)]">{m.display_name ?? 'Unknown'}</span>
                    <span className="text-[8px] tracking-wider text-[rgba(240,239,235,0.3)]">{ROLE_LABEL[m.role]}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Pending requests (admins only) */}
          {isAdmin && pendingRequests.length > 0 && (
            <div className="mx-5 mb-3 border-t border-[rgba(240,239,235,0.06)] pt-3">
              <p className="mb-2.5 text-[7px] tracking-[0.2em] uppercase text-[rgba(240,239,235,0.28)]">Pending invites</p>
              <div className="flex flex-col gap-2">
                {pendingRequests.map(r => (
                  <div key={r.id} className="flex items-center gap-2">
                    <span className="flex-1 text-[12px] text-[rgba(240,239,235,0.7)]">{r.display_name ?? 'Unknown'}</span>
                    <button onClick={() => void respondToRequest(r.id, true)}
                      className="rounded-full bg-[rgba(184,255,0,0.12)] px-2.5 py-1 text-[9px] font-semibold text-[#B8FF00]">
                      Accept
                    </button>
                    <button onClick={() => void respondToRequest(r.id, false)}
                      className="rounded-full bg-[rgba(255,255,255,0.06)] px-2.5 py-1 text-[9px] text-[rgba(240,239,235,0.4)]">
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mx-5 border-t border-[rgba(240,239,235,0.06)] pb-5 pt-3">
            <div className="flex items-center justify-between">
              <p className="text-[7px] tracking-[0.12em] text-[rgba(240,239,235,0.2)]">BND-{shortId(band.id)}</p>
              {isAdmin && (
                <button onClick={() => router.push(`/bands/${bandId}/settings`)}
                  className="rounded-full border border-[rgba(240,239,235,0.12)] px-3 py-1 text-[9px] tracking-wider text-[rgba(240,239,235,0.5)] transition-colors hover:border-[rgba(255,85,0,0.4)] hover:text-[#FF5500]">
                  MANAGE
                </button>
              )}
            </div>
          </div>
        </div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="mt-4 flex flex-col gap-2"
        >
          <button
            onClick={() => router.push(`/messages/band/${bandId}`)}
            className="w-full rounded-full bg-[#FF5500] py-3.5 text-base font-semibold text-black shadow-[0_0_24px_rgba(255,85,0,0.4)] transition-opacity hover:opacity-90 active:opacity-80"
          >
            Open chat
          </button>
          {isAdmin && (
            <button
              onClick={() => void openInvite()}
              className="w-full rounded-full py-3 text-sm font-semibold transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(240,239,235,0.7)' }}
            >
              Invite more people
            </button>
          )}
          {myRole === 'owner' ? (
            <button
              onClick={() => { if (confirm('Disband this band? This cannot be undone.')) void handleDisband() }}
              className="w-full rounded-full py-3 text-sm font-medium text-[rgba(255,100,100,0.6)] transition-colors hover:text-[rgba(255,100,100,0.9)]"
            >
              Disband band
            </button>
          ) : (
            <button
              onClick={() => { if (confirm('Leave this band?')) void handleLeave() }}
              className="w-full rounded-full py-3 text-sm font-medium text-[rgba(255,100,100,0.6)] transition-colors hover:text-[rgba(255,100,100,0.9)]"
            >
              Leave band
            </button>
          )}
        </motion.div>
      </motion.div>

      <BottomNav />
    </div>
  )
}
