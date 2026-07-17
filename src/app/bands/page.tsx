'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/ui/BottomNav'
import type { Band } from '@/types'

interface BandRow {
  band: Band
  memberCount: number
  lastContent: string | null
  lastAt: string | null
  unreadCount: number
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

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.32, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] as const },
  }),
}

export default function BandsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [userId, setUserId] = useState<string | null>(null)
  const [rows, setRows] = useState<BandRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      setLoading(true)

      const { data: memberships } = await supabase
        .from('band_members')
        .select('band_id')
        .eq('user_id', user.id)

      const bandIds = (memberships ?? []).map(m => m.band_id)
      if (bandIds.length === 0) { setRows([]); setLoading(false); return }

      const [{ data: bands }, { data: allMembers }, { data: recentMessages }] = await Promise.all([
        supabase.from('bands').select('*').in('id', bandIds),
        supabase.from('band_members').select('band_id').in('band_id', bandIds),
        supabase
          .from('band_messages')
          .select('band_id, content, created_at, from_id, read_by')
          .in('band_id', bandIds)
          .order('created_at', { ascending: false }),
      ])

      const memberCountMap = new Map<string, number>()
      for (const m of allMembers ?? []) {
        memberCountMap.set(m.band_id, (memberCountMap.get(m.band_id) ?? 0) + 1)
      }

      const lastMsgMap = new Map<string, { content: string; created_at: string }>()
      const unreadMap = new Map<string, number>()
      for (const m of recentMessages ?? []) {
        if (!lastMsgMap.has(m.band_id)) {
          lastMsgMap.set(m.band_id, { content: m.content, created_at: m.created_at })
        }
        if (m.from_id !== user.id && !(m.read_by ?? []).includes(user.id)) {
          unreadMap.set(m.band_id, (unreadMap.get(m.band_id) ?? 0) + 1)
        }
      }

      const built: BandRow[] = (bands ?? [])
        .map((band) => ({
          band: band as Band,
          memberCount: memberCountMap.get(band.id) ?? 1,
          lastContent: lastMsgMap.get(band.id)?.content ?? null,
          lastAt: lastMsgMap.get(band.id)?.created_at ?? band.created_at,
          unreadCount: unreadMap.get(band.id) ?? 0,
        }))
        .sort((a, b) => new Date(b.lastAt ?? 0).getTime() - new Date(a.lastAt ?? 0).getTime())

      setRows(built)
      setLoading(false)
    }

    void load()

    function onVisible() {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
              BANDS
            </h1>
            {userId && rows.length > 0 && (
              <p className="text-[11px] text-[rgba(240,239,235,0.3)]">
                {rows.length} band{rows.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <button
              onClick={() => router.push('/bands/new')}
              className="rounded-xl bg-[#FF5500] px-3 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
            >
              + New Band
            </button>
            <Link
              href="/home"
              className="rounded-xl border border-[rgba(240,239,235,0.10)] bg-[rgba(240,239,235,0.05)] px-3 py-2 text-sm font-medium text-[rgba(240,239,235,0.55)] backdrop-blur-md transition-colors hover:border-[rgba(240,239,235,0.25)] hover:text-[#F0EFEB]"
            >
              ← Home
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 pt-3 pb-24">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[rgba(240,239,235,0.12)] border-t-[#FF5500]" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ background: 'rgba(255,92,0,0.08)', border: '1px solid rgba(255,92,0,0.15)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,92,0,0.55)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div>
              <p className="text-[rgba(240,239,235,0.55)] font-semibold text-base">No bands yet</p>
              <p className="mt-1 text-[13px] text-[rgba(240,239,235,0.3)]">
                Turn a conversation into a band — bring people you already talk to into one shared chat.
              </p>
            </div>
            <button
              onClick={() => router.push('/bands/new')}
              className="mt-1 rounded-full bg-[rgba(255,85,0,0.12)] border border-[rgba(255,85,0,0.2)] px-5 py-2.5 text-sm font-medium text-[#FF5500] transition-colors hover:bg-[rgba(255,85,0,0.2)]"
            >
              Create your first band →
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((row, i) => {
              const hasUnread = row.unreadCount > 0
              return (
                <motion.button
                  key={row.band.id}
                  custom={i}
                  variants={fadeUp}
                  initial="hidden"
                  animate="show"
                  onClick={() => router.push(`/bands/${row.band.id}`)}
                  className="w-full text-left transition-all duration-150 active:scale-[0.99]"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '13px 14px', borderRadius: 18,
                    background: hasUnread ? 'rgba(255,92,0,0.07)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${hasUnread ? 'rgba(255,92,0,0.20)' : 'rgba(255,255,255,0.07)'}`,
                  }}
                >
                  {/* Band avatar (rounded-square) or icon-chip fallback */}
                  {row.band.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={row.band.avatar_url}
                      alt={row.band.name}
                      style={{ width: 50, height: 50, borderRadius: 14, objectFit: 'cover', flexShrink: 0,
                        border: '1.5px solid rgba(240,239,235,0.10)' }}
                    />
                  ) : (
                    <div
                      className="flex items-center justify-center"
                      style={{ width: 50, height: 50, borderRadius: 14, background: 'rgba(255,92,0,0.10)',
                        border: '1.5px solid rgba(255,92,0,0.15)', flexShrink: 0 }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,92,0,0.8)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    </div>
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                      <span style={{
                        fontWeight: hasUnread ? 700 : 500,
                        fontSize: 14,
                        color: hasUnread ? '#F0EFEB' : 'rgba(240,239,235,0.82)',
                        letterSpacing: '0.01em',
                      }}>
                        {row.band.name}
                      </span>
                      {row.lastAt && (
                        <span style={{ fontSize: 10, color: 'rgba(240,239,235,0.28)', flexShrink: 0, marginLeft: 8 }}>
                          {formatRelativeTime(row.lastAt)}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontSize: 12,
                        color: hasUnread ? 'rgba(240,239,235,0.6)' : 'rgba(240,239,235,0.32)',
                        fontWeight: hasUnread ? 500 : 400,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        flex: 1, minWidth: 0,
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
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
