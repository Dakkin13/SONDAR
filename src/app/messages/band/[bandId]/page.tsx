'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { useEscapeKey } from '@/lib/hooks/useEscapeKey'
import type { Band } from '@/types'

interface BandMemberLite {
  user_id: string
  display_name: string | null
  avatar_url: string | null
}

interface BandChatMessage {
  id: string
  created_at: string
  band_id: string
  from_id: string
  content: string
  read_by: string[]
  liked_by: string[]
}

function formatBubbleTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDayLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
}

function isSameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

export default function BandChatPage() {
  const { bandId } = useParams<{ bandId: string }>()
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [band, setBand] = useState<Band | null>(null)
  const [members, setMembers] = useState<BandMemberLite[]>([])
  const [messages, setMessages] = useState<BandChatMessage[]>([])
  const [likedMessages, setLikedMessages] = useState<Set<string>>(new Set())
  const [likeAnimating, setLikeAnimating] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [typingUserIds, setTypingUserIds] = useState<Set<string>>(new Set())
  const [showMenu, setShowMenu] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)

  const currentUserIdRef = useRef<string | null>(null)
  const sentIds = useRef(new Set<string>())
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const lastSentAtRef = useRef(0)
  const lastTapRef = useRef<Record<string, number>>({})
  const typingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typingChannelRef = useRef<any>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [keyboardOffset, setKeyboardOffset] = useState(0)

  const memberMap = new Map(members.map(m => [m.user_id, m]))

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior })
  }, [])

  // ── iOS keyboard safe area via visualViewport ─────────────────────────────
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    function onResize() {
      const offset = Math.max(0, window.innerHeight - vv!.height - vv!.offsetTop)
      setKeyboardOffset(offset)
      if (offset > 0) setTimeout(() => scrollToBottom('instant' as ScrollBehavior), 50)
    }
    vv.addEventListener('resize', onResize)
    vv.addEventListener('scroll', onResize)
    return () => {
      vv.removeEventListener('resize', onResize)
      vv.removeEventListener('scroll', onResize)
    }
  }, [scrollToBottom])

  // ── Load band + members + message history ─────────────────────────────────
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setCurrentUserId(user.id)
      currentUserIdRef.current = user.id

      const [bandRes, memberRowsRes, historyRes] = await Promise.all([
        supabase.from('bands').select('*').eq('id', bandId).single(),
        supabase.from('band_members').select('user_id').eq('band_id', bandId),
        supabase
          .from('band_messages')
          .select('id, band_id, from_id, content, created_at, read_by, liked_by')
          .eq('band_id', bandId)
          .order('created_at', { ascending: true }),
      ])

      if (bandRes.data) setBand(bandRes.data as Band)

      const memberIds = (memberRowsRes.data ?? []).map(m => m.user_id)
      if (memberIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles').select('id, display_name, avatar_url').in('id', memberIds)
        setMembers((profiles ?? []).map(p => ({
          user_id: p.id, display_name: p.display_name, avatar_url: p.avatar_url,
        })))
      }

      const history = (historyRes.data as BandChatMessage[]) ?? []
      setMessages(history)
      setLikedMessages(new Set(history.filter(m => (m.liked_by ?? []).includes(user.id)).map(m => m.id)))
      setLoading(false)

      // Mark unread messages (from others) as read — array-append computed client-side
      const toMark = history.filter(m => m.from_id !== user.id && !(m.read_by ?? []).includes(user.id))
      for (const m of toMark) {
        const newReadBy = [...(m.read_by ?? []), user.id]
        void supabase.from('band_messages').update({ read_by: newReadBy }).eq('id', m.id)
      }
    }
    void init()
  }, [bandId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loading) scrollToBottom('instant' as ScrollBehavior)
  }, [loading, scrollToBottom])

  // ── Realtime — single channel per band (simpler than pairwise naming) ─────
  useEffect(() => {
    if (!currentUserId) return

    const channel = supabase
      .channel(`band-chat-${bandId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'band_messages' },
        (payload) => {
          const msg = payload.new as BandChatMessage
          const myId = currentUserIdRef.current
          if (!myId) return
          if (msg.band_id !== bandId) return
          if (sentIds.current.has(msg.id)) return

          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev
            return [...prev, msg]
          })

          if (msg.from_id !== myId) {
            const newReadBy = [...(msg.read_by ?? []), myId]
            void supabase.from('band_messages').update({ read_by: newReadBy }).eq('id', msg.id)
          }

          scrollToBottom()
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'band_messages' },
        (payload) => {
          const updated = payload.new as BandChatMessage
          const myId = currentUserIdRef.current
          if (!myId) return
          if (updated.band_id !== bandId) return

          setMessages(prev =>
            prev.map(m => m.id === updated.id
              ? { ...m, read_by: updated.read_by ?? [], liked_by: updated.liked_by ?? [] }
              : m
            )
          )
          setLikedMessages(prev => {
            const next = new Set(prev)
            if ((updated.liked_by ?? []).includes(myId)) next.add(updated.id)
            else next.delete(updated.id)
            return next
          })
        }
      )
      .subscribe()

    const typingCh = supabase
      .channel(`typing-band-${bandId}`)
      .on('broadcast', { event: 'typing' }, (payload) => {
        const typerId = (payload.payload as { userId?: string })?.userId
        if (!typerId || typerId === currentUserIdRef.current) return
        setTypingUserIds(prev => new Set(prev).add(typerId))
        if (typingTimeoutsRef.current[typerId]) clearTimeout(typingTimeoutsRef.current[typerId])
        typingTimeoutsRef.current[typerId] = setTimeout(() => {
          setTypingUserIds(prev => {
            const next = new Set(prev)
            next.delete(typerId)
            return next
          })
        }, 3000)
      })
      .subscribe()

    typingChannelRef.current = typingCh

    return () => {
      void supabase.removeChannel(channel)
      void supabase.removeChannel(typingCh)
      Object.values(typingTimeoutsRef.current).forEach(clearTimeout)
    }
  }, [currentUserId, bandId, scrollToBottom]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (messages.length > 0 && !loading) scrollToBottom()
  }, [messages.length, loading, scrollToBottom])

  useEffect(() => {
    if (!showMenu) return
    function handleOutside(e: MouseEvent | TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [showMenu])

  useEscapeKey(showMenu || confirmLeave, () => {
    setShowMenu(false)
    setConfirmLeave(false)
  })

  function handleMessageTap(msgId: string) {
    if (msgId.startsWith('temp-')) return
    const now = Date.now()
    const last = lastTapRef.current[msgId] ?? 0
    if (now - last < 300) {
      lastTapRef.current[msgId] = 0
      void toggleLike(msgId)
    } else {
      lastTapRef.current[msgId] = now
    }
  }

  async function toggleLike(msgId: string) {
    if (!currentUserId) return
    const isLiked = likedMessages.has(msgId)

    setLikedMessages(prev => {
      const next = new Set(prev)
      if (isLiked) next.delete(msgId)
      else next.add(msgId)
      return next
    })
    if (!isLiked) {
      setLikeAnimating(msgId)
      setTimeout(() => setLikeAnimating(null), 700)
    }

    const msg = messages.find(m => m.id === msgId)
    const currentLikes = msg?.liked_by ?? []
    const newLikes = isLiked ? currentLikes.filter(id => id !== currentUserId) : [...currentLikes, currentUserId]

    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, liked_by: newLikes } : m))
    await supabase.from('band_messages').update({ liked_by: newLikes }).eq('id', msgId)
  }

  const handleSend = async () => {
    const content = input.trim()
    if (!content || !currentUserId || sending) return
    const now = Date.now()
    if (now - lastSentAtRef.current < 1500) return
    lastSentAtRef.current = now

    setSending(true)
    setInput('')

    const tempId = `temp-${Date.now()}`
    const tempMsg: BandChatMessage = {
      id: tempId, band_id: bandId, from_id: currentUserId, content,
      created_at: new Date().toISOString(), read_by: [], liked_by: [],
    }
    setMessages(prev => [...prev, tempMsg])
    scrollToBottom()

    const { data, error } = await supabase
      .from('band_messages')
      .insert({ band_id: bandId, from_id: currentUserId, content })
      .select()
      .single()

    if (error) {
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setInput(content)
      toast('Could not send message: ' + error.message, 'error')
    } else if (data) {
      sentIds.current.add((data as BandChatMessage).id)
      setMessages(prev => prev.map(m => m.id === tempId ? (data as BandChatMessage) : m))
    }

    setSending(false)
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !sending) {
      e.preventDefault()
      void handleSend()
    }
  }

  async function handleLeave() {
    if (!currentUserId) return
    await supabase.from('band_members').delete().eq('band_id', bandId).eq('user_id', currentUserId)
    router.push('/bands')
  }

  const typingNames = Array.from(typingUserIds)
    .map(id => memberMap.get(id)?.display_name?.split(' ')[0] ?? 'Someone')
  const typingLabel = typingNames.length === 0 ? null
    : typingNames.length === 1 ? `${typingNames[0]} is typing…`
    : typingNames.length === 2 ? `${typingNames[0]} and ${typingNames[1]} are typing…`
    : `${typingNames[0]}, ${typingNames[1]} +${typingNames.length - 2} are typing…`

  return (
    <div className="flex flex-col" style={{ height: '100dvh' }}>

      {/* ── Confirm leave sheet ─────────────────────────────────────────── */}
      <AnimatePresence>
        {confirmLeave && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex cursor-pointer items-end justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setConfirmLeave(false)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 340 }}
              className="w-full max-w-lg md:max-w-2xl rounded-t-3xl p-6"
              style={{ background: 'rgba(18,18,18,0.98)', border: '1px solid rgba(255,255,255,0.08)' }}
              onClick={e => e.stopPropagation()}
            >
              <p className="font-[family-name:var(--font-bebas)] text-2xl tracking-widest text-[#F0EFEB]">
                LEAVE {(band?.name ?? 'THIS BAND').toUpperCase()}?
              </p>
              <p className="mt-2 text-sm text-[rgba(240,239,235,0.5)] leading-relaxed">
                You&apos;ll lose access to this chat unless someone invites you back.
              </p>
              <div className="mt-5 flex flex-col gap-2">
                <button onClick={() => { setConfirmLeave(false); void handleLeave() }}
                  className="w-full rounded-xl bg-red-600 py-3 text-sm font-semibold text-white">
                  Leave band
                </button>
                <button onClick={() => setConfirmLeave(false)} className="w-full rounded-xl py-3 text-sm text-[rgba(240,239,235,0.4)]">
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 px-4"
        style={{
          background: 'rgba(13,13,13,0.92)',
          backdropFilter: 'blur(48px) saturate(180%)',
          WebkitBackdropFilter: 'blur(48px) saturate(180%)',
          borderBottom: '0.5px solid rgba(255,255,255,0.08)',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
          paddingBottom: 12,
        }}
      >
        <div className="mx-auto flex max-w-lg md:max-w-2xl items-center gap-3">
          <button
            onClick={() => router.push('/messages')}
            onTouchEnd={(e) => { e.preventDefault(); router.push('/messages') }}
            className="flex-shrink-0 text-[rgba(240,239,235,0.5)] transition-colors hover:text-[#F0EFEB]"
            style={{ fontSize: 22, lineHeight: 1, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: -8, touchAction: 'manipulation' }}
            aria-label="Back"
          >
            ‹
          </button>

          <button onClick={() => router.push(`/bands/${bandId}`)} className="flex-shrink-0">
            {band?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={band.avatar_url} alt={band.name}
                style={{ width: 38, height: 38, borderRadius: 12, objectFit: 'cover', border: '2px solid rgba(240,239,235,0.15)' }} />
            ) : (
              <div className="flex items-center justify-center"
                style={{ width: 38, height: 38, borderRadius: 12, background: '#1a1a1a', border: '2px solid rgba(240,239,235,0.1)' }}>
                <span className="text-base">🎸</span>
              </div>
            )}
          </button>

          <button onClick={() => router.push(`/bands/${bandId}`)} className="min-w-0 flex-1 text-left">
            <p className="truncate font-[family-name:var(--font-bebas)] text-xl tracking-widest text-[#F0EFEB]">
              {band?.name?.toUpperCase() ?? 'LOADING…'}
            </p>
            <p className="text-[11px] text-[rgba(240,239,235,0.35)]">
              {members.length} member{members.length !== 1 ? 's' : ''}
            </p>
          </button>

          <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => setShowMenu(v => !v)}
              onTouchEnd={(e) => { e.preventDefault(); setShowMenu(v => !v) }}
              className="flex h-10 w-10 items-center justify-center rounded-full text-[rgba(240,239,235,0.45)] transition-colors hover:text-[#F0EFEB]"
              style={{ background: showMenu ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)', fontSize: 20, touchAction: 'manipulation' }}
              aria-label="More options"
            >
              ⋮
            </button>
            <AnimatePresence>
              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.96 }}
                  transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    position: 'absolute', top: 36, right: 0, width: 200,
                    background: 'rgb(22,22,22)', border: '1px solid rgba(255,255,255,0.10)',
                    borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.6)', overflow: 'hidden', zIndex: 100,
                  }}
                >
                  {[
                    { label: 'View band', icon: '🎸', action: () => { setShowMenu(false); router.push(`/bands/${bandId}`) }, danger: false },
                    { label: 'Manage members', icon: '⚙️', action: () => { setShowMenu(false); router.push(`/bands/${bandId}/settings`) }, danger: false },
                    { label: 'Leave band', icon: '🚪', action: () => { setShowMenu(false); setConfirmLeave(true) }, danger: true },
                  ].map((item, i) => (
                    <button
                      key={item.label}
                      onClick={item.action}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                        padding: '11px 14px', background: 'none', border: 'none',
                        borderTop: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                        cursor: 'pointer', textAlign: 'left', fontSize: 13,
                        color: item.danger ? '#ef4444' : 'rgba(240,239,235,0.8)',
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      <span style={{ fontSize: 15 }}>{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Messages list ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-lg md:max-w-2xl">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[rgba(240,239,235,0.12)] border-t-[#FF5500]" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <div style={{
                width: 72, height: 72, borderRadius: 16, overflow: 'hidden',
                border: '2px solid rgba(255,92,0,0.35)', background: '#1a1a1a', boxShadow: '0 0 32px rgba(255,92,0,0.12)',
              }}>
                {band?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={band.avatar_url} alt={band.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="text-2xl">🎸</span>
                  </div>
                )}
              </div>
              <div>
                <p className="font-[family-name:var(--font-bebas)] text-2xl tracking-widest text-[#F0EFEB]">
                  {(band?.name ?? 'YOUR BAND').toUpperCase()}
                </p>
                <p className="mt-0.5 text-xs text-[rgba(240,239,235,0.35)]">
                  {members.length} member{members.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '12px 20px', maxWidth: 280 }}>
                <p className="text-xs leading-relaxed text-[rgba(240,239,235,0.4)]">
                  Say hi to the band 🎵
                </p>
              </div>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((msg, i) => {
                const isMine = msg.from_id === currentUserId
                const showDay = i === 0 || !isSameDay(messages[i - 1].created_at, msg.created_at)
                const isTemp = msg.id.startsWith('temp-')
                const isAnimating = likeAnimating === msg.id
                const likedByOther = (msg.liked_by ?? []).some(id => id !== currentUserId)
                const likedByMe = likedMessages.has(msg.id)
                const sender = memberMap.get(msg.from_id)
                const readCount = (msg.read_by ?? []).filter(id => id !== msg.from_id).length

                return (
                  <div key={msg.id}>
                    {showDay && (
                      <div className="my-4 flex items-center gap-3">
                        <div className="h-px flex-1 bg-[rgba(240,239,235,0.06)]" />
                        <span className="text-[10px] font-medium text-[rgba(240,239,235,0.25)]">{formatDayLabel(msg.created_at)}</span>
                        <div className="h-px flex-1 bg-[rgba(240,239,235,0.06)]" />
                      </div>
                    )}

                    <div
                      className={`mb-1 flex ${isMine ? 'justify-end' : 'justify-start'}`}
                      onClick={() => handleMessageTap(msg.id)}
                      style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
                    >
                      <div style={{ position: 'relative', maxWidth: '75%' }}>
                        {!isMine && (
                          <p className="mb-0.5 px-1 text-[10px] font-medium text-[rgba(255,92,0,0.7)]">
                            {sender?.display_name ?? 'Unknown'}
                          </p>
                        )}
                        <motion.div
                          initial={{ opacity: 0, y: 8, scale: 0.97 }}
                          animate={{ opacity: isTemp ? 0.65 : 1, y: 0, scale: 1 }}
                          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] as const }}
                        >
                          <div
                            className="px-4 py-2.5"
                            style={{
                              background: isMine ? '#FF5500' : 'rgba(255,255,255,0.09)',
                              backdropFilter: isMine ? 'none' : 'blur(20px)',
                              WebkitBackdropFilter: isMine ? 'none' : 'blur(20px)',
                              border: isMine ? 'none' : '1px solid rgba(255,255,255,0.12)',
                              borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                              color: isMine ? '#000' : '#F0EFEB',
                            }}
                          >
                            <p className="text-sm leading-relaxed">{msg.content}</p>
                          </div>
                        </motion.div>

                        <div className={`mt-0.5 flex items-center gap-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                          {!isMine && likedByMe && <span style={{ fontSize: 10 }}>❤️</span>}
                          <span className="text-[9px] text-[rgba(240,239,235,0.22)]">{formatBubbleTime(msg.created_at)}</span>
                          {isMine && !isTemp && readCount > 0 && (
                            <span className="text-[9px] font-medium" style={{ color: '#FF5C00' }} title={`Seen by ${readCount}`}>
                              ✓✓ {readCount > 1 ? readCount : ''}
                            </span>
                          )}
                          {isMine && likedByOther && <span style={{ fontSize: 10 }}>❤️</span>}
                        </div>

                        <AnimatePresence>
                          {isAnimating && (
                            <motion.span
                              initial={{ opacity: 1, y: 0, scale: 1 }}
                              animate={{ opacity: 0, y: -48, scale: 1.8 }}
                              exit={{}}
                              transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] as const }}
                              style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 22, pointerEvents: 'none', zIndex: 10 }}
                            >
                              ❤️
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                )
              })}
            </AnimatePresence>
          )}

          <AnimatePresence>
            {typingLabel && (
              <motion.div
                key="typing" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.2 }} className="mb-2 flex justify-start"
              >
                <div className="px-4 py-3" style={{
                  background: 'rgba(255,255,255,0.09)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.12)', borderRadius: '18px 18px 18px 4px',
                }}>
                  <p className="text-[11px] text-[rgba(240,239,235,0.5)]">{typingLabel}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Input bar ──────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 px-4 pt-3"
        style={{
          background: 'rgba(13,13,13,0.92)',
          backdropFilter: 'blur(48px) saturate(180%)',
          WebkitBackdropFilter: 'blur(48px) saturate(180%)',
          borderTop: '0.5px solid rgba(255,255,255,0.08)',
          paddingBottom: keyboardOffset > 0 ? `${keyboardOffset + 12}px` : 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
        }}
      >
        <div className="mx-auto flex max-w-lg md:max-w-2xl items-end gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => {
              setInput(e.target.value)
              void typingChannelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { userId: currentUserId } })
            }}
            onKeyDown={handleKeyDown}
            placeholder="Message the band…"
            rows={1}
            className="flex-1 resize-none text-sm text-[#F0EFEB] placeholder-[rgba(240,239,235,0.25)] outline-none"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 20, padding: '10px 16px', maxHeight: 120, overflowY: 'auto' }}
            onInput={e => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`
            }}
          />
          <motion.button
            onClick={() => { try { navigator.vibrate?.(10) } catch { /* ignore */ }; void handleSend() }}
            onTouchEnd={(e) => { e.preventDefault(); try { navigator.vibrate?.(10) } catch { /* ignore */ }; void handleSend() }}
            disabled={!input.trim() || sending}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.92 }}
            style={{
              flexShrink: 0, width: 38, height: 38, borderRadius: '50%',
              background: input.trim() ? '#FF5500' : 'rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: input.trim() ? '0 0 12px rgba(255,85,0,0.35)' : 'none',
              transition: 'background 0.2s, box-shadow 0.2s',
            }}
            aria-label="Send"
          >
            <svg viewBox="0 0 24 24" fill="none" style={{ width: 18, height: 18 }} stroke={input.trim() ? '#000' : 'rgba(240,239,235,0.3)'} strokeWidth={2.5}>
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" fill="currentColor" stroke="none" style={{ color: input.trim() ? '#000' : 'rgba(240,239,235,0.3)' }} />
            </svg>
          </motion.button>
        </div>
      </div>
    </div>
  )
}
