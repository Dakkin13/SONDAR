'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'

interface Conversation {
  otherId: string
  otherName: string | null
  otherAvatar: string | null
  lastMessage: string
  lastAt: string
  unread: boolean
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] as const },
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

      // Fetch all messages where user is sender or recipient
      const { data: msgs } = await supabase
        .from('messages')
        .select('id, sender_id, recipient_id, content, created_at, read_at')
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order('created_at', { ascending: false })

      if (!msgs || msgs.length === 0) { setLoading(false); return }

      // Group by conversation partner — keep only the most recent message per partner
      const seen = new Map<string, typeof msgs[0]>()
      for (const m of msgs) {
        const partner = m.sender_id === user.id ? m.recipient_id : m.sender_id
        if (!seen.has(partner)) seen.set(partner, m)
      }

      // Fetch profiles for all partners
      const partnerIds = Array.from(seen.keys())
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', partnerIds)

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? [])

      const convos: Conversation[] = Array.from(seen.entries()).map(([partnerId, msg]) => {
        const profile = profileMap.get(partnerId)
        const unread = msg.recipient_id === user.id && msg.read_at === null
        return {
          otherId: partnerId,
          otherName: profile?.display_name ?? null,
          otherAvatar: profile?.avatar_url ?? null,
          lastMessage: msg.content,
          lastAt: msg.created_at,
          unread,
        }
      })

      // Sort by most recent
      convos.sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime())
      setConversations(convos)
      setLoading(false)
    }
    void load()
  }, [])

  return (
    <div className="min-h-screen bg-[#0D0D0D]">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-[rgba(240,239,235,0.06)] bg-[rgba(13,13,13,0.92)] px-4 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <button
            onClick={() => router.push('/explore')}
            className="text-sm text-[rgba(240,239,235,0.4)] transition-colors hover:text-[#F0EFEB]"
          >
            ←
          </button>
          <h1 className="font-[family-name:var(--font-bebas)] text-2xl tracking-widest text-[#F0EFEB]">
            MESSAGES
          </h1>
        </div>
      </div>

      <div className="mx-auto max-w-lg">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[rgba(240,239,235,0.12)] border-t-[#FF5500]" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            <p className="font-[family-name:var(--font-bebas)] text-3xl tracking-widest text-[rgba(240,239,235,0.2)]">
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
          <ul>
            {conversations.map((convo, i) => {
              const initials = (convo.otherName ?? '?')
                .split(' ')
                .map((w) => w[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()

              return (
                <motion.li
                  key={convo.otherId}
                  custom={i}
                  variants={fadeUp}
                  initial="hidden"
                  animate="show"
                >
                  <button
                    onClick={() => router.push(`/messages/${convo.otherId}`)}
                    className="flex w-full items-center gap-3 border-b border-[rgba(240,239,235,0.05)] px-4 py-4 transition-colors hover:bg-[rgba(240,239,235,0.03)]"
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      {convo.otherAvatar ? (
                        <img
                          src={convo.otherAvatar}
                          alt={convo.otherName ?? 'User'}
                          className="h-12 w-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1a1a1a]">
                          <span className="font-[family-name:var(--font-bebas)] text-lg text-[rgba(240,239,235,0.4)]">
                            {initials}
                          </span>
                        </div>
                      )}
                      {convo.unread && (
                        <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-[#FF5500] shadow-[0_0_6px_rgba(255,85,0,0.7)]" />
                      )}
                    </div>

                    {/* Text */}
                    <div className="min-w-0 flex-1 text-left">
                      <div className="flex items-baseline justify-between gap-2">
                        <span
                          className={`truncate text-sm font-semibold ${
                            convo.unread ? 'text-[#F0EFEB]' : 'text-[rgba(240,239,235,0.75)]'
                          }`}
                        >
                          {convo.otherName ?? 'Unknown musician'}
                        </span>
                        <span className="flex-shrink-0 text-[10px] text-[rgba(240,239,235,0.3)]">
                          {formatTime(convo.lastAt)}
                        </span>
                      </div>
                      <p
                        className={`mt-0.5 truncate text-xs ${
                          convo.unread
                            ? 'font-medium text-[rgba(240,239,235,0.6)]'
                            : 'text-[rgba(240,239,235,0.35)]'
                        }`}
                      >
                        {convo.lastMessage}
                      </p>
                    </div>
                  </button>
                </motion.li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
