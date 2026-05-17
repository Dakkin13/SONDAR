'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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

      setConversations(convos)
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
        <div className="mx-auto max-w-lg">
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
      </div>

      <div className="mx-auto max-w-lg px-4 pt-3 pb-24">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[rgba(240,239,235,0.12)] border-t-[#FF5500]" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            <p
              className="text-[rgba(240,239,235,0.2)]"
              style={{ fontFamily: 'var(--font-bebas)', fontSize: 28, letterSpacing: '0.08em' }}
            >
              NO MESSAGES YET
            </p>
            <p className="text-sm text-[rgba(240,239,235,0.35)]">
              Find musicians on the map and send them a message.
            </p>
            <button
              onClick={() => router.push('/explore')}
              className="mt-2 rounded-xl bg-[rgba(255,85,0,0.12)] px-5 py-2.5 text-sm font-medium text-[#FF5500] transition-colors hover:bg-[rgba(255,85,0,0.2)]"
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
                  className="w-full text-left transition-all duration-150"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px', borderRadius: 16,
                    background: hasUnread
                      ? 'rgba(255,92,0,0.06)'
                      : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${hasUnread ? 'rgba(255,92,0,0.18)' : 'rgba(255,255,255,0.07)'}`,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = hasUnread
                      ? 'rgba(255,92,0,0.06)' : 'rgba(255,255,255,0.04)'
                  }}
                >
                  {/* Avatar + active dot */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    {partner.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={partner.avatar_url}
                        alt={partner.display_name ?? ''}
                        style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover',
                          border: active ? '2px solid rgba(255,92,0,0.6)' : '2px solid rgba(240,239,235,0.1)' }}
                      />
                    ) : (
                      <div
                        className="flex items-center justify-center"
                        style={{ width: 52, height: 52, borderRadius: '50%', background: '#1a1a1a',
                          border: '2px solid rgba(240,239,235,0.1)' }}
                      >
                        <span
                          className="text-[rgba(240,239,235,0.4)]"
                          style={{ fontFamily: 'var(--font-bebas)', fontSize: 18 }}
                        >
                          {initials}
                        </span>
                      </div>
                    )}
                    {active && (
                      <div style={{
                        position: 'absolute', bottom: 2, right: 2,
                        width: 12, height: 12, borderRadius: '50%',
                        background: '#B8FF00', border: '2px solid #0D0D0D',
                      }} />
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <span style={{
                        fontWeight: hasUnread ? 700 : 500, fontSize: 15,
                        color: hasUnread ? '#F0EFEB' : 'rgba(240,239,235,0.85)',
                      }}>
                        {partner.display_name ?? 'Unknown musician'}
                      </span>
                      <span style={{ fontSize: 11, color: 'rgba(240,239,235,0.3)', flexShrink: 0 }}>
                        {formatRelativeTime(lastAt)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        fontSize: 13,
                        color: hasUnread ? 'rgba(240,239,235,0.65)' : 'rgba(240,239,235,0.35)',
                        fontWeight: hasUnread ? 500 : 400,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        maxWidth: unreadCount > 0 ? '70%' : '100%',
                      }}>
                        {lastFromMe ? 'You: ' : ''}{lastContent}
                      </span>
                      {unreadCount > 0 && (
                        <div style={{
                          background: '#FF5C00', borderRadius: 99, minWidth: 20, height: 20,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700, color: '#000', padding: '0 6px',
                          flexShrink: 0,
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
                              fontSize: 10, color: '#FF5C00',
                              background: 'rgba(255,92,0,0.10)',
                              padding: '1px 7px', borderRadius: 99,
                            }}
                          >
                            {INSTRUMENT_EMOJI[inst] ?? '🎵'} {inst}
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
