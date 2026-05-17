'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/ui/BottomNav'

interface ConversationPartner {
  id: string
  display_name: string | null
  avatar_url: string | null
  instruments: string[]
  last_active: string | null
}

interface Conversation {
  partner: ConversationPartner
  lastContent: string
  lastAt: string
  lastFromMe: boolean
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
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      // Fetch all messages using correct column names (from_id / to_id)
      const { data: msgs } = await supabase
        .from('messages')
        .select('id, from_id, to_id, content, created_at, read_at')
        .or(`from_id.eq.${user.id},to_id.eq.${user.id}`)
        .order('created_at', { ascending: false })

      if (!msgs || msgs.length === 0) { setLoading(false); return }

      // Group by conversation partner — keep most recent message per partner
      const seen = new Map<string, typeof msgs[0]>()
      const unreadMap = new Map<string, number>()

      for (const m of msgs) {
        const partner = m.from_id === user.id ? m.to_id : m.from_id
        if (!seen.has(partner)) seen.set(partner, m)
        // Count unread messages FROM other person
        if (m.to_id === user.id && m.read_at === null) {
          unreadMap.set(partner, (unreadMap.get(partner) ?? 0) + 1)
        }
      }

      // Fetch partner profiles with instruments for chips
      const partnerIds = Array.from(seen.keys())
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, instruments, last_active')
        .in('id', partnerIds)

      const profileMap = new Map(profiles?.map(p => [p.id, p]) ?? [])

      const convos: Conversation[] = Array.from(seen.entries())
        .map(([partnerId, msg]) => {
          const profile = profileMap.get(partnerId)
          return {
            partner: {
              id: partnerId,
              display_name: profile?.display_name ?? null,
              avatar_url: profile?.avatar_url ?? null,
              instruments: (profile?.instruments as string[]) ?? [],
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

      setConversations(visible)
      setLoading(false)
    }
    void load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ minHeight: '100dvh', background: '#0D0D0D' }}>
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
            {userId && conversations.length > 0 && (
              <p className="text-[11px] text-[rgba(240,239,235,0.3)]">
                {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
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
      </div>

      <div className="mx-auto max-w-lg px-4 pt-3 pb-24">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[rgba(240,239,235,0.12)] border-t-[#FF5500]" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ background: 'rgba(255,92,0,0.08)', border: '1px solid rgba(255,92,0,0.15)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,92,0,0.55)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-[rgba(240,239,235,0.55)] font-semibold text-base">No messages yet</p>
              <p className="mt-1 text-[13px] text-[rgba(240,239,235,0.3)]">
                Find musicians on the map and start a conversation.
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
            {conversations.map((convo, i) => {
              const { partner, lastContent, lastAt, lastFromMe, unreadCount } = convo
              const active = isActiveToday(partner.last_active)
              const initials = (partner.display_name ?? '?')
                .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
              const hasUnread = unreadCount > 0

              return (
                <motion.button
                  key={partner.id}
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
