'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/ui/BottomNav'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import type { Instrument, Profile } from '@/types'

type ConversationPartner = Pick<Profile, 'id' | 'display_name' | 'avatar_url' | 'instruments' | 'last_active'>

interface Conversation {
  partner: ConversationPartner
  lastContent: string
  lastAt: string
  lastFromMe: boolean
  unreadCount: number
}

// Unified inbox row — a DM conversation or a band conversation, sorted together by lastAt.
type InboxRow =
  | { type: 'dm'; key: string; data: Conversation }
  | {
      type: 'band'
      key: string
      bandId: string
      name: string
      avatarUrl: string | null
      memberCount: number
      lastContent: string | null
      lastAt: string
      unreadCount: number
    }

const INSTRUMENT_EMOJI: Record<string, string> = {
  guitar: '🎸', bass: '🎸', drums: '🥁', keys: '🎹', piano: '🎹',
  violin: '🎻', cello: '🎻', trumpet: '🎺', saxophone: '🎷', flute: '🪈',
  vocals: '🎤', producer: '🎚️', dj: '🎧', other: '🎵',
}

function formatRelativeTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function isActiveToday(lastActive: string | null): boolean {
  if (!lastActive) return false
  return Date.now() - new Date(lastActive).getTime() < 86400000
}

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.32, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] as const },
  }),
}

export default function MessagesPage() {
  const router = useRouter()
  const supabase = createClient()

  const [userId, setUserId] = useState<string | null>(null)
  const [inboxRows, setInboxRows] = useState<InboxRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const { permission, requestAndSubscribe } = usePushNotifications(userId)
  const [pushDismissed, setPushDismissed] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      setLoading(true)

      // Fetch all messages using correct column names (from_id / to_id)
      const { data: msgs } = await supabase
        .from('messages')
        .select('id, from_id, to_id, content, created_at, read_at')
        .or(`from_id.eq.${user.id},to_id.eq.${user.id}`)
        .order('created_at', { ascending: false })

      // Group by conversation partner — keep most recent message per partner
      const seen = new Map<string, NonNullable<typeof msgs>[0]>()
      const unreadMap = new Map<string, number>()

      for (const m of msgs ?? []) {
        const partner = m.from_id === user.id ? m.to_id : m.from_id
        if (!seen.has(partner)) seen.set(partner, m)
        // Count unread messages FROM other person
        if (m.to_id === user.id && m.read_at === null) {
          unreadMap.set(partner, (unreadMap.get(partner) ?? 0) + 1)
        }
      }

      // Fetch partner profiles with instruments for chips
      const partnerIds = Array.from(seen.keys())
      const { data: profiles } = partnerIds.length > 0
        ? await supabase
            .from('profiles')
            .select('id, display_name, avatar_url, instruments, last_active')
            .in('id', partnerIds)
        : { data: [] }

      const profileMap = new Map(profiles?.map(p => [p.id, p]) ?? [])

      const convos: Conversation[] = Array.from(seen.entries())
        .map(([partnerId, msg]) => {
          const profile = profileMap.get(partnerId)
          return {
            partner: {
              id: partnerId,
              display_name: profile?.display_name ?? null,
              avatar_url: profile?.avatar_url ?? null,
              instruments: (profile?.instruments as Instrument[] | null) ?? [],
              last_active: profile?.last_active ?? null,
            },
            lastContent: msg.content,
            lastAt: msg.created_at,
            lastFromMe: msg.from_id === user.id,
            unreadCount: unreadMap.get(partnerId) ?? 0,
          }
        })
        .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime())

      // Filter blocked / deleted conversations
      const visible = convos.filter(c => {
        try {
          if (localStorage.getItem(`blocked_${c.partner.id}`) === '1') return false
          if (localStorage.getItem(`hidden_conv_${c.partner.id}`) === '1') return false
        } catch { /* ignore */ }
        return true
      })

      const dmRows: InboxRow[] = visible.map(c => ({ type: 'dm', key: `dm-${c.partner.id}`, data: c }))

      // ── Bands — merge into the same unified inbox ──────────────────────────
      const { data: memberships } = await supabase
        .from('band_members')
        .select('band_id')
        .eq('user_id', user.id)

      const bandIds = (memberships ?? []).map(m => m.band_id)
      let bandRows: InboxRow[] = []
      if (bandIds.length > 0) {
        const [{ data: bands }, { data: allMembers }, { data: recentMessages }] = await Promise.all([
          supabase.from('bands').select('id, name, avatar_url').in('id', bandIds),
          supabase.from('band_members').select('band_id').in('band_id', bandIds),
          supabase.from('band_messages').select('band_id, content, created_at, from_id, read_by').in('band_id', bandIds),
        ])

        const memberCountMap = new Map<string, number>()
        for (const m of allMembers ?? []) {
          memberCountMap.set(m.band_id, (memberCountMap.get(m.band_id) ?? 0) + 1)
        }
        const lastMsgMap = new Map<string, { content: string; created_at: string }>()
        const unreadMap = new Map<string, number>()
        for (const m of (recentMessages ?? []).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())) {
          if (!lastMsgMap.has(m.band_id)) lastMsgMap.set(m.band_id, { content: m.content, created_at: m.created_at })
          if (m.from_id !== user.id && !(m.read_by ?? []).includes(user.id)) {
            unreadMap.set(m.band_id, (unreadMap.get(m.band_id) ?? 0) + 1)
          }
        }

        bandRows = (bands ?? []).map(b => ({
          type: 'band' as const,
          key: `band-${b.id}`,
          bandId: b.id,
          name: b.name,
          avatarUrl: b.avatar_url,
          memberCount: memberCountMap.get(b.id) ?? 1,
          lastContent: lastMsgMap.get(b.id)?.content ?? null,
          lastAt: lastMsgMap.get(b.id)?.created_at ?? new Date(0).toISOString(),
          unreadCount: unreadMap.get(b.id) ?? 0,
        }))
      }

      const merged = [...dmRows, ...bandRows].sort((a, b) => {
        const at = a.type === 'dm' ? a.data.lastAt : a.lastAt
        const bt = b.type === 'dm' ? b.data.lastAt : b.lastAt
        return new Date(bt).getTime() - new Date(at).getTime()
      })

      setInboxRows(merged)
      setLoading(false)
    }

    void load()

    // Re-fetch when tab becomes visible again (e.g. navigating back from chat)
    function onVisible() {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function rowName(row: InboxRow): string {
    return row.type === 'dm' ? (row.data.partner.display_name ?? '') : row.name
  }

  const filteredRows = inboxRows.filter(
    row => !searchQuery || rowName(row).toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div style={{ minHeight: '100dvh' }}>
      {/* Header */}
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
          <div>
            <h1
              className="text-[#F0EFEB]"
              style={{ fontFamily: 'var(--font-bebas)', fontSize: 28, letterSpacing: '0.08em' }}
            >
              MESSAGES
            </h1>
            {userId && inboxRows.length > 0 && (
              <p className="text-[11px] text-[rgba(240,239,235,0.3)]">
                {inboxRows.length} conversation{inboxRows.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          <Link
            href="/home"
            className="flex-shrink-0 rounded-xl border border-[rgba(240,239,235,0.10)] bg-[rgba(240,239,235,0.05)] px-3 py-2 text-sm font-medium text-[rgba(240,239,235,0.55)] backdrop-blur-md transition-colors hover:border-[rgba(240,239,235,0.25)] hover:text-[#F0EFEB]"
          >
            ← Home
          </Link>
        </div>
        {/* Search input */}
        {inboxRows.length > 0 && (
          <div className="mx-auto max-w-lg mt-2">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(240,239,235,0.25)]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search conversations…"
                className="w-full rounded-xl py-2 pl-9 pr-4 text-sm text-[#F0EFEB] placeholder:text-[rgba(240,239,235,0.25)] outline-none"
                style={{ background: 'rgba(240,239,235,0.06)', border: '1px solid rgba(240,239,235,0.08)' }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgba(240,239,235,0.3)] hover:text-[#F0EFEB]"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mx-auto max-w-lg px-4 pt-3 pb-24">
        {/* Push notification prompt */}
        {!loading && !pushDismissed && permission === 'default' && inboxRows.length > 0 && (
          <div
            className="mb-3 flex items-center gap-3 rounded-xl px-4 py-3"
            style={{ background: 'rgba(255,85,0,0.08)', border: '1px solid rgba(255,85,0,0.18)' }}
          >
            <span style={{ fontSize: 20, flexShrink: 0 }}>🔔</span>
            <p className="flex-1 text-xs text-[rgba(240,239,235,0.6)] leading-snug">
              Get notified when musicians message you
            </p>
            <button
              onClick={() => void requestAndSubscribe()}
              className="flex-shrink-0 rounded-full bg-[#FF5500] px-3 py-1.5 text-xs font-semibold text-black"
            >
              Enable
            </button>
            <button
              onClick={() => setPushDismissed(true)}
              className="flex-shrink-0 text-[rgba(240,239,235,0.3)] hover:text-[#F0EFEB] text-sm"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[rgba(240,239,235,0.12)] border-t-[#FF5500]" />
          </div>
        ) : inboxRows.length === 0 || (searchQuery && filteredRows.length === 0) ? (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ background: 'rgba(255,92,0,0.08)', border: '1px solid rgba(255,92,0,0.15)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,92,0,0.55)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-[rgba(240,239,235,0.55)] font-semibold text-base">
                {searchQuery ? 'No results' : 'No messages yet'}
              </p>
              <p className="mt-1 text-[13px] text-[rgba(240,239,235,0.3)]">
                {searchQuery ? `No conversation with "${searchQuery}"` : 'Find musicians on the map and start a conversation.'}
              </p>
            </div>
            <button
              onClick={() => router.push('/explore')}
              className="mt-1 rounded-full bg-[rgba(255,85,0,0.12)] border border-[rgba(255,85,0,0.2)] px-5 py-2.5 text-sm font-medium text-[#FF5500] transition-colors hover:bg-[rgba(255,85,0,0.2)]"
            >
              Explore musicians →
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredRows.map((row, i) => {
              if (row.type === 'band') {
                const hasUnread = row.unreadCount > 0
                return (
                  <motion.button
                    key={row.key}
                    custom={i}
                    variants={fadeUp}
                    initial="hidden"
                    animate="show"
                    onClick={() => router.push(`/messages/band/${row.bandId}`)}
                    className="w-full text-left transition-all duration-150 active:scale-[0.99]"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '13px 14px', borderRadius: 18,
                      background: hasUnread ? 'rgba(255,92,0,0.07)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${hasUnread ? 'rgba(255,92,0,0.20)' : 'rgba(255,255,255,0.07)'}`,
                    }}
                  >
                    {/* Band avatar (rounded-square) + people-icon badge */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      {row.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={row.avatarUrl}
                          alt={row.name}
                          style={{ width: 50, height: 50, borderRadius: 14, objectFit: 'cover', border: '1.5px solid rgba(240,239,235,0.10)' }}
                        />
                      ) : (
                        <div
                          className="flex items-center justify-center"
                          style={{ width: 50, height: 50, borderRadius: 14, background: 'rgba(255,92,0,0.10)', border: '1.5px solid rgba(255,92,0,0.15)' }}
                        >
                          <span className="text-lg">🎸</span>
                        </div>
                      )}
                      <div style={{
                        position: 'absolute', bottom: -2, right: -2,
                        width: 18, height: 18, borderRadius: '50%',
                        background: '#1a1a1a', border: '1.5px solid #0D0D0D',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FF5C00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                      </div>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                        <span style={{ fontWeight: hasUnread ? 700 : 500, fontSize: 14, color: hasUnread ? '#F0EFEB' : 'rgba(240,239,235,0.82)', letterSpacing: '0.01em' }}>
                          {row.name}
                        </span>
                        <span style={{ fontSize: 10, color: 'rgba(240,239,235,0.28)', flexShrink: 0, marginLeft: 8 }}>
                          {formatRelativeTime(row.lastAt)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontSize: 12, color: hasUnread ? 'rgba(240,239,235,0.6)' : 'rgba(240,239,235,0.32)',
                          fontWeight: hasUnread ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0,
                        }}>
                          {row.lastContent ?? `${row.memberCount} member${row.memberCount !== 1 ? 's' : ''}`}
                        </span>
                        {hasUnread && (
                          <div style={{
                            background: '#FF5C00', borderRadius: 99, minWidth: 18, height: 18,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 10, fontWeight: 700, color: '#000', padding: '0 5px',
                            flexShrink: 0, boxShadow: '0 0 8px rgba(255,92,0,0.4)',
                          }}>
                            {row.unreadCount}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.button>
                )
              }

              const { partner, lastContent, lastAt, lastFromMe, unreadCount } = row.data
              const active = isActiveToday(partner.last_active)
              const initials = (partner.display_name ?? '?')
                .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
              const hasUnread = unreadCount > 0

              return (
                <motion.button
                  key={row.key}
                  custom={i}
                  variants={fadeUp}
                  initial="hidden"
                  animate="show"
                  onClick={() => router.push(`/messages/${partner.id}`)}
                  className="w-full text-left transition-all duration-150 active:scale-[0.99]"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '13px 14px', borderRadius: 18,
                    background: hasUnread ? 'rgba(255,92,0,0.07)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${hasUnread ? 'rgba(255,92,0,0.20)' : 'rgba(255,255,255,0.07)'}`,
                    borderTopColor: hasUnread ? 'rgba(255,92,0,0.28)' : 'rgba(255,255,255,0.11)',
                  }}
                >
                  {/* Avatar + active dot */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    {partner.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={partner.avatar_url}
                        alt={partner.display_name ?? ''}
                        style={{ width: 50, height: 50, borderRadius: '50%', objectFit: 'cover',
                          border: active ? '2px solid #FF5C00' : '2px solid rgba(240,239,235,0.10)',
                          boxShadow: active ? '0 0 10px rgba(255,92,0,0.3)' : 'none' }}
                      />
                    ) : (
                      <div
                        className="flex items-center justify-center"
                        style={{ width: 50, height: 50, borderRadius: '50%', background: 'rgba(255,255,255,0.06)',
                          border: '1.5px solid rgba(240,239,235,0.10)' }}
                      >
                        <span style={{ fontFamily: 'var(--font-bebas)', fontSize: 17, color: 'rgba(240,239,235,0.45)' }}>
                          {initials}
                        </span>
                      </div>
                    )}
                    {active && (
                      <div style={{
                        position: 'absolute', bottom: 1, right: 1,
                        width: 11, height: 11, borderRadius: '50%',
                        background: '#22c55e', border: '2px solid #0D0D0D',
                        boxShadow: '0 0 4px rgba(34,197,94,0.5)',
                      }} />
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                      <span style={{
                        fontWeight: hasUnread ? 700 : 500,
                        fontSize: 14,
                        color: hasUnread ? '#F0EFEB' : 'rgba(240,239,235,0.82)',
                        letterSpacing: '0.01em',
                      }}>
                        {partner.display_name ?? 'Unknown musician'}
                      </span>
                      <span style={{ fontSize: 10, color: 'rgba(240,239,235,0.28)', flexShrink: 0, marginLeft: 8 }}>
                        {formatRelativeTime(lastAt)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontSize: 12,
                        color: hasUnread ? 'rgba(240,239,235,0.6)' : 'rgba(240,239,235,0.32)',
                        fontWeight: hasUnread ? 500 : 400,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        flex: 1, minWidth: 0,
                      }}>
                        {lastFromMe ? <span style={{ color: 'rgba(240,239,235,0.22)' }}>You: </span> : null}{lastContent}
                      </span>
                      {unreadCount > 0 && (
                        <div style={{
                          background: '#FF5C00', borderRadius: 99, minWidth: 18, height: 18,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, fontWeight: 700, color: '#000', padding: '0 5px',
                          flexShrink: 0, boxShadow: '0 0 8px rgba(255,92,0,0.4)',
                        }}>
                          {unreadCount}
                        </div>
                      )}
                    </div>

                    {/* Instrument chips */}
                    {partner.instruments.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 5 }}>
                        {partner.instruments.slice(0, 2).map(inst => (
                          <span
                            key={inst}
                            style={{
                              fontSize: 9, color: 'rgba(255,92,0,0.8)',
                              background: 'rgba(255,92,0,0.09)',
                              border: '1px solid rgba(255,92,0,0.15)',
                              padding: '1px 7px', borderRadius: 99,
                              letterSpacing: '0.05em',
                            }}
                          >
                            {inst.toUpperCase()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.button>
              )
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
