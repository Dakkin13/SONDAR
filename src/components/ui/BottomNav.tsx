'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'
import { AnimatePresence, motion } from 'framer-motion'
import { Home, Search, MessageCircle, User, Bell, X, CalendarDays } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import CompleteProfileModal from '@/components/profile/CompleteProfileModal'
import { useEscapeKey } from '@/lib/hooks/useEscapeKey'
import { fetchUnreadCounts } from '@/lib/data/messages'
import { messagePreview } from '@/lib/chat/types'

interface BellMessage {
  id: string
  content: string
  created_at: string
  from_name: string | null
  from_avatar: string | null
  partner_id: string
  isBand?: boolean
}

function formatRelTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const TABS = [
  { label: 'Home',     href: '/home',        Icon: Home          },
  { label: 'Explore',  href: '/explore',     Icon: Search        },
  { label: 'Events',   href: '/events',      Icon: CalendarDays  },
  { label: 'Messages', href: '/messages',    Icon: MessageCircle },
  { label: 'Profile',  href: '/profile/me',  Icon: User          },
] as const

const ACCENT = '#FF5C00'
const MUTED  = '#888884'

export default function BottomNav() {
  const pathname = usePathname()
  const router   = useRouter()
  const [profileIncomplete,   setProfileIncomplete]   = useState(false)
  const [showCompleteModal,   setShowCompleteModal]   = useState(false)
  const [bellOpen,            setBellOpen]            = useState(false)
  const [bellMessages,        setBellMessages]        = useState<BellMessage[]>([])
  const [bellLoading,         setBellLoading]         = useState(false)
  const [unreadCount,         setUnreadCount]         = useState(0)
  const bellRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const realtimeRef = useRef<any>(null)
  const myBandIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const supabase = createClient()
    let refreshTimer: ReturnType<typeof setTimeout> | null = null

    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('profiles')
        .select('years_practicing, age_range, band_experience, influences')
        .eq('id', user.id)
        .single()
      if (!data) return
      const missing =
        !data.years_practicing ||
        !data.age_range ||
        !data.band_experience ||
        !data.influences ||
        (Array.isArray(data.influences) && data.influences.length === 0)
      setProfileIncomplete(missing)

      const { data: memberships } = await supabase
        .from('band_members')
        .select('band_id')
        .eq('user_id', user.id)
      myBandIdsRef.current = new Set((memberships ?? []).map(m => m.band_id as string))

      // The badge uses the same definition of "unread" as the inbox, and is
      // recounted (debounced) on any change to either table — so it also goes
      // DOWN when a thread is read on another screen, instead of only ever
      // incrementing until the next reload.
      const refresh = async () => {
        const counts = await fetchUnreadCounts(supabase, user.id)
        setUnreadCount(counts.total)
      }
      await refresh()

      const scheduleRefresh = () => {
        if (refreshTimer) clearTimeout(refreshTimer)
        refreshTimer = setTimeout(() => { void refresh() }, 400)
      }
      realtimeRef.current = supabase
        .channel(`nav-unread-${user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, scheduleRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'band_messages' }, scheduleRefresh)
        .subscribe()
    }
    void check()

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      if (realtimeRef.current) {
        void createClient().removeChannel(realtimeRef.current)
      }
    }
  }, [])

  // Close bell when clicking outside
  useEffect(() => {
    if (!bellOpen) return
    function handleOutside(e: MouseEvent | TouchEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [bellOpen])

  useEscapeKey(bellOpen, () => setBellOpen(false))

  async function openBell() {
    setBellOpen(o => !o)
    if (bellMessages.length > 0) return // already loaded
    setBellLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setBellLoading(false); return }

      // Fetch recent messages received by user
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .eq('to_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)

      // Deduplicate by sender — keep most recent per sender
      const seen = new Map<string, NonNullable<typeof msgs>[0]>()
      for (const m of msgs ?? []) {
        if (!seen.has(m.from_id)) seen.set(m.from_id, m)
      }

      const senderIds = Array.from(seen.keys())
      const { data: profiles } = senderIds.length > 0
        ? await supabase.from('profiles').select('id, display_name, avatar_url').in('id', senderIds)
        : { data: [] }
      const pMap = new Map(profiles?.map(p => [p.id, p]) ?? [])

      const dmItems: BellMessage[] = Array.from(seen.values()).map(m => ({
        id: m.id,
        content: messagePreview(m),
        created_at: m.created_at,
        from_name: pMap.get(m.from_id)?.display_name ?? null,
        from_avatar: pMap.get(m.from_id)?.avatar_url ?? null,
        partner_id: m.from_id,
      }))

      // Fetch recent band messages across the user's bands
      const bandIds = Array.from(myBandIdsRef.current)
      let bandItems: BellMessage[] = []
      if (bandIds.length > 0) {
        const { data: bandMsgs } = await supabase
          .from('band_messages')
          .select('*')
          .in('band_id', bandIds)
          .order('created_at', { ascending: false })
          .limit(10)

        const bandSeen = new Map<string, NonNullable<typeof bandMsgs>[0]>()
        for (const m of bandMsgs ?? []) {
          if (!bandSeen.has(m.band_id)) bandSeen.set(m.band_id, m)
        }
        const seenBandIds = Array.from(bandSeen.keys())
        const { data: bandsData } = seenBandIds.length > 0
          ? await supabase.from('bands').select('id, name, avatar_url').in('id', seenBandIds)
          : { data: [] }
        const bMap = new Map(bandsData?.map(b => [b.id, b]) ?? [])

        bandItems = Array.from(bandSeen.values()).map(m => ({
          id: m.id,
          content: messagePreview(m),
          created_at: m.created_at,
          from_name: bMap.get(m.band_id)?.name ?? null,
          from_avatar: bMap.get(m.band_id)?.avatar_url ?? null,
          partner_id: m.band_id,
          isBand: true,
        }))

        // Mark unread band messages as read (array-append computed client-side)
        for (const m of bandMsgs ?? []) {
          if (m.from_id !== user.id && !(m.read_by ?? []).includes(user.id)) {
            const newReadBy = [...(m.read_by ?? []), user.id]
            void supabase.from('band_messages').update({ read_by: newReadBy }).eq('id', m.id)
          }
        }
      }

      const merged = [...dmItems, ...bandItems].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      setBellMessages(merged)

      // Mark DMs as read
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('to_id', user.id)
        .is('read_at', null)
      setUnreadCount(0)
    } catch { /* swallow */ }
    setBellLoading(false)
  }

  function isActive(href: string) {
    if (href === '/messages') return pathname.startsWith('/messages')
    if (href === '/profile/me') return pathname.startsWith('/profile')
    if (href === '/events') return pathname.startsWith('/events')
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <>
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(13,13,13,0.88)',
        backdropFilter: 'blur(28px) saturate(200%)',
        WebkitBackdropFilter: 'blur(28px) saturate(200%)',
        boxShadow: '0 -6px 28px rgba(255,85,0,0.08), inset 0 1px 0 rgba(255,255,255,0.07)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div style={{ height: 64, display: 'flex', alignItems: 'stretch' }}>
      {TABS.map(({ label, href, Icon }) => {
        const active = isActive(href)
        const showDot = href === '/profile/me' && profileIncomplete
        return (
          <button
            key={href}
            onClick={() => {
              if (href === '/profile/me' && profileIncomplete) {
                setShowCompleteModal(true)
              } else {
                router.push(href)
              }
            }}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              position: 'relative',
            }}
          >
            {/* Active indicator bar */}
            <AnimatePresence>
              {active && (
                <motion.div
                  layoutId="nav-indicator"
                  initial={{ opacity: 0, scaleX: 0.4 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  exit={{ opacity: 0, scaleX: 0.4 }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: '25%',
                    right: '25%',
                    height: 2,
                    borderRadius: '0 0 2px 2px',
                    background: ACCENT,
                    boxShadow: `0 0 8px ${ACCENT}`,
                  }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
            </AnimatePresence>

            <motion.div
              animate={{ color: active ? ACCENT : MUTED, scale: active ? 1.1 : 1 }}
              transition={{ duration: 0.2 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, position: 'relative' }}
            >
              <div style={{ position: 'relative', display: 'inline-flex' }}>
                <Icon
                  size={22}
                  strokeWidth={active ? 2.2 : 1.6}
                  fill={active ? 'rgba(255,92,0,0.15)' : 'none'}
                />
                {showDot && (
                  <span
                    style={{
                      position: 'absolute',
                      top: -2,
                      right: -4,
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: ACCENT,
                      border: '1.5px solid #0D0D0D',
                    }}
                  />
                )}
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: active ? 600 : 400,
                  letterSpacing: '0.04em',
                  color: active ? ACCENT : MUTED,
                }}
              >
                {label}
              </span>
            </motion.div>
          </button>
        )
      })}
      </div>
    </nav>

    <AnimatePresence>
      {showCompleteModal && (
        <CompleteProfileModal
          onClose={() => setShowCompleteModal(false)}
          onComplete={() => { setShowCompleteModal(false); setProfileIncomplete(false) }}
        />
      )}
    </AnimatePresence>

    {/* Notification bell + popup — always visible, top-right */}
    <div ref={bellRef} style={{ position: 'fixed', top: 'calc(12px + env(safe-area-inset-top, 0px))', right: 16, zIndex: 100 }}>
      {/* Bell button */}
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => void openBell()}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: bellOpen ? 'rgba(255,92,0,0.15)' : 'rgba(13,13,13,0.7)',
          border: bellOpen ? '1px solid rgba(255,92,0,0.35)' : '1px solid rgba(255,255,255,0.10)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          color: bellOpen ? '#FF5C00' : 'rgba(240,239,235,0.55)',
          cursor: 'pointer',
          position: 'relative',
          WebkitTapHighlightColor: 'transparent',
          touchAction: 'manipulation',
        }}
      >
        <Bell size={16} strokeWidth={1.6} />
        {unreadCount > 0 && !bellOpen && (
          <span style={{
            position: 'absolute',
            top: -2, right: -2,
            width: 16, height: 16,
            borderRadius: '50%',
            background: '#FF5C00',
            border: '2px solid #0D0D0D',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 9,
            fontWeight: 700,
            color: 'black',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popup panel */}
      <AnimatePresence>
        {bellOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'absolute',
              top: 48,
              right: 0,
              width: 'min(320px, calc(100vw - 32px))',
              background: 'rgba(18,18,18,0.96)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 16,
              backdropFilter: 'blur(28px) saturate(180%)',
              WebkitBackdropFilter: 'blur(28px) saturate(180%)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.12em', color: 'rgba(240,239,235,0.7)', textTransform: 'uppercase' }}>Inbox</span>
              <button type="button" onClick={() => setBellOpen(false)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: 'rgba(240,239,235,0.08)', border: 'none', cursor: 'pointer', color: 'rgba(240,239,235,0.5)', WebkitTapHighlightColor: 'transparent' }}>
                <X size={13} strokeWidth={2} />
              </button>
            </div>

            {/* Body */}
            <div style={{ maxHeight: 260, overflowY: 'auto' }}>
              {bellLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
                  <span style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(255,92,0,0.2)', borderTopColor: '#FF5C00', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                </div>
              ) : bellMessages.length === 0 ? (
                <div style={{ padding: '28px 16px', textAlign: 'center' }}>
                  <Bell size={28} strokeWidth={1.2} style={{ color: 'rgba(240,239,235,0.15)', margin: '0 auto 10px' }} />
                  <p style={{ fontSize: 13, color: 'rgba(240,239,235,0.35)', fontWeight: 500 }}>Inbox is empty</p>
                  <p style={{ fontSize: 11, color: 'rgba(240,239,235,0.2)', marginTop: 4 }}>Messages from musicians will appear here</p>
                </div>
              ) : (
                bellMessages.map((msg, i) => (
                  <button
                    key={msg.id}
                    type="button"
                    onClick={() => { setBellOpen(false); router.push(msg.isBand ? `/messages/band/${msg.partner_id}` : `/messages/${msg.partner_id}`) }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 16px',
                      background: 'none',
                      border: 'none',
                      borderTop: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                      background: msg.from_avatar ? 'transparent' : 'rgba(255,92,0,0.15)',
                      border: '1px solid rgba(255,92,0,0.2)',
                      overflow: 'hidden',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {msg.from_avatar
                        ? <Image src={msg.from_avatar} alt="" width={36} height={36} style={{ width: 36, height: 36, objectFit: 'cover' }} />
                        : <span style={{ fontSize: 14, fontWeight: 700, color: '#FF5C00', fontFamily: 'var(--font-bebas)' }}>
                            {(msg.from_name ?? '?')[0].toUpperCase()}
                          </span>
                      }
                    </div>
                    {/* Text */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#F0EFEB', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {msg.from_name ?? 'Someone'}
                      </p>
                      <p style={{ fontSize: 12, color: 'rgba(240,239,235,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {msg.content}
                      </p>
                    </div>
                    {/* Time */}
                    <span style={{ fontSize: 10, color: 'rgba(240,239,235,0.25)', flexShrink: 0 }}>
                      {formatRelTime(msg.created_at)}
                    </span>
                  </button>
                ))
              )}
            </div>

            {/* Footer — go to full inbox */}
            {bellMessages.length > 0 && (
              <button
                type="button"
                onClick={() => { setBellOpen(false); router.push('/messages') }}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  background: 'none',
                  border: 'none',
                  borderTop: '1px solid rgba(255,255,255,0.07)',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#FF5C00',
                  letterSpacing: '0.06em',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                See all messages →
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </>
  )
}
