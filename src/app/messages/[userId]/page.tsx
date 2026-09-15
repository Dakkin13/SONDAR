'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { useEscapeKey } from '@/lib/hooks/useEscapeKey'
import type { Message, Profile } from '@/types'

type OtherProfile = Pick<Profile, 'id' | 'display_name' | 'avatar_url' | 'instruments' | 'last_active'>
type ChatMessage = Message

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

function isActiveToday(lastActive: string | null | undefined): boolean {
  if (!lastActive) return false
  return Date.now() - new Date(lastActive).getTime() < 86400000
}

const INSTRUMENT_EMOJI: Record<string, string> = {
  guitar: '🎸', bass: '🎸', drums: '🥁', keys: '🎹', piano: '🎹',
  violin: '🎻', cello: '🎻', trumpet: '🎺', saxophone: '🎷', flute: '🪈',
  vocals: '🎤', producer: '🎚️', dj: '🎧', other: '🎵',
}

export default function ChatPage() {
  const { userId: otherUserId } = useParams<{ userId: string }>()
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null)
  const [other, setOther] = useState<OtherProfile | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [likedMessages, setLikedMessages] = useState<Set<string>>(new Set())
  const [likeAnimating, setLikeAnimating] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showConnection, setShowConnection] = useState(false)
  const [otherTyping, setOtherTyping] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmBlock, setConfirmBlock] = useState(false)

  const currentUserIdRef = useRef<string | null>(null)
  const sentIds = useRef(new Set<string>())
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const wasEmptyRef = useRef(true)
  const lastSentAtRef = useRef(0)
  const lastTapRef = useRef<Record<string, number>>({})
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typingChannelRef = useRef<any>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [keyboardOffset, setKeyboardOffset] = useState(0)

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

  // ── Load current user + other profile + message history ──────────────────
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      setCurrentUserId(user.id)
      currentUserIdRef.current = user.id

      const [profileRes, myProfileRes, historyRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, display_name, avatar_url, instruments, last_active')
          .eq('id', otherUserId)
          .single(),
        supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', user.id)
          .single(),
        supabase
          .from('messages')
          .select('id, from_id, to_id, content, created_at, read_at, liked_by')
          .or(
            `and(from_id.eq.${user.id},to_id.eq.${otherUserId}),and(from_id.eq.${otherUserId},to_id.eq.${user.id})`
          )
          .order('created_at', { ascending: true }),
      ])

      if (profileRes.data) setOther(profileRes.data as OtherProfile)
      if (myProfileRes.data?.avatar_url) setCurrentUserAvatar(myProfileRes.data.avatar_url)

      const history = (historyRes.data as ChatMessage[]) ?? []
      let isFreshStart = false
      let deletedAt = 0
      try {
        isFreshStart = localStorage.getItem(`conv_fresh_start_${otherUserId}`) === '1'
        deletedAt = parseInt(localStorage.getItem(`conv_deleted_at_${otherUserId}`) ?? '0', 10) || 0
      } catch { /* ignore */ }
      const filtered = isFreshStart
        ? []
        : deletedAt > 0
          ? history.filter(m => new Date(m.created_at).getTime() > deletedAt)
          : history
      wasEmptyRef.current = filtered.length === 0
      setMessages(filtered)

      // Seed liked set from history
      const liked = new Set(
        history.filter(m => (m.liked_by ?? []).includes(user.id)).map(m => m.id)
      )
      setLikedMessages(liked)

      setLoading(false)

      // Mark incoming as read
      void supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('from_id', otherUserId)
        .eq('to_id', user.id)
        .is('read_at', null)
    }
    void init()
  }, [otherUserId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scroll to bottom after initial load ──────────────────────────────────
  useEffect(() => {
    if (!loading) scrollToBottom('instant' as ScrollBehavior)
  }, [loading, scrollToBottom])

  // ── Realtime — INSERT + UPDATE for messages + typing broadcast ────────────
  useEffect(() => {
    if (!currentUserId) return

    const channel = supabase
      .channel(`chat-${currentUserId}-${otherUserId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new as ChatMessage
          const myId = currentUserIdRef.current
          if (!myId) return
          if (msg.from_id !== otherUserId || msg.to_id !== myId) return
          if (sentIds.current.has(msg.id)) return

          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev
            return [...prev, msg]
          })

          void supabase
            .from('messages')
            .update({ read_at: new Date().toISOString() })
            .eq('id', msg.id)

          scrollToBottom()
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          // This fires when read_at is set (seen receipt) or liked_by changes
          const updated = payload.new as ChatMessage
          const myId = currentUserIdRef.current
          if (!myId) return
          const inConv =
            (updated.from_id === myId && updated.to_id === otherUserId) ||
            (updated.from_id === otherUserId && updated.to_id === myId)
          if (!inConv) return

          setMessages(prev =>
            prev.map(m =>
              m.id === updated.id
                ? { ...m, read_at: updated.read_at, liked_by: updated.liked_by ?? [] }
                : m
            )
          )

          // Keep liked set in sync
          setLikedMessages(prev => {
            const next = new Set(prev)
            if ((updated.liked_by ?? []).includes(myId)) next.add(updated.id)
            else next.delete(updated.id)
            return next
          })
        }
      )
      .subscribe()

    const convKey = [currentUserId, otherUserId].sort().join('-')
    const typingCh = supabase
      .channel(`typing-${convKey}`)
      .on('broadcast', { event: 'typing' }, (payload) => {
        if ((payload.payload as { userId?: string })?.userId !== otherUserId) return
        setOtherTyping(true)
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = setTimeout(() => setOtherTyping(false), 3000)
      })
      .subscribe()

    typingChannelRef.current = typingCh

    return () => {
      void supabase.removeChannel(channel)
      void supabase.removeChannel(typingCh)
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    }
  }, [currentUserId, otherUserId, scrollToBottom]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scroll on new messages ────────────────────────────────────────────────
  useEffect(() => {
    if (messages.length > 0 && !loading) scrollToBottom()
  }, [messages.length, loading, scrollToBottom])

  // ── Close menu on outside click ───────────────────────────────────────────
  useEffect(() => {
    if (!showMenu) return
    function handleOutside(e: MouseEvent | TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [showMenu])

  // ── Double-tap like ───────────────────────────────────────────────────────
  useEscapeKey(showMenu || confirmDelete || confirmBlock, () => {
    setShowMenu(false)
    setConfirmDelete(false)
    setConfirmBlock(false)
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
    const newLikes = isLiked
      ? currentLikes.filter(id => id !== currentUserId)
      : [...currentLikes, currentUserId]

    // Optimistically update local messages so like icon appears immediately
    setMessages(prev =>
      prev.map(m => m.id === msgId ? { ...m, liked_by: newLikes } : m)
    )

    await supabase.from('messages').update({ liked_by: newLikes }).eq('id', msgId)
  }

  // ── Send ─────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    const content = input.trim()
    if (!content || !currentUserId || sending) return
    const now = Date.now()
    if (now - lastSentAtRef.current < 1500) return
    lastSentAtRef.current = now

    setSending(true)
    setInput('')
    const wasEmpty = wasEmptyRef.current

    const tempId = `temp-${Date.now()}`
    const tempMsg: ChatMessage = {
      id: tempId,
      from_id: currentUserId,
      to_id: otherUserId,
      content,
      created_at: new Date().toISOString(),
      read_at: null,
      liked_by: [],
    }
    setMessages(prev => [...prev, tempMsg])
    scrollToBottom()

    const { data, error } = await supabase
      .from('messages')
      .insert({ from_id: currentUserId, to_id: otherUserId, content })
      .select()
      .single()

    if (error) {
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setInput(content)
      toast('Could not send message: ' + error.message, 'error')
    } else if (data) {
      sentIds.current.add((data as ChatMessage).id)
      setMessages(prev => prev.map(m => m.id === tempId ? (data as ChatMessage) : m))

      if (wasEmpty) {
        wasEmptyRef.current = false
        setShowConnection(true)
        setTimeout(() => setShowConnection(false), 3600)
        // Clear fresh-start flag, update cutoff to just before this message, unhide from inbox
        try {
          const newMsgTime = new Date((data as ChatMessage).created_at).getTime()
          localStorage.removeItem(`conv_fresh_start_${otherUserId}`)
          if (newMsgTime > 0) {
            localStorage.setItem(`conv_deleted_at_${otherUserId}`, (newMsgTime - 1).toString())
          }
          localStorage.removeItem(`hidden_conv_${otherUserId}`)
        } catch { /* ignore */ }
      }
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

  // ── Delete conversation ───────────────────────────────────────────────────
  async function handleDeleteConversation() {
    if (!currentUserId) return
    // Delete messages I sent
    await supabase
      .from('messages')
      .delete()
      .eq('from_id', currentUserId)
      .eq('to_id', otherUserId)
    // Hide the conversation in the inbox (their messages I can't delete via RLS)
    try {
      localStorage.setItem(`hidden_conv_${otherUserId}`, '1')
      localStorage.setItem(`conv_deleted_at_${otherUserId}`, Date.now().toString())
      localStorage.setItem(`conv_fresh_start_${otherUserId}`, '1')
    } catch { /* ignore */ }
    router.refresh()
    router.push('/messages')
  }

  // ── Block user ────────────────────────────────────────────────────────────
  function handleBlock() {
    try { localStorage.setItem(`blocked_${otherUserId}`, '1') } catch { /* ignore */ }
    toast(`${other?.display_name ?? 'User'} has been blocked`, 'default')
    router.push('/messages')
  }

  // ── Report user ───────────────────────────────────────────────────────────
  function handleReport() {
    const subject = encodeURIComponent(`Report user: ${otherUserId}`)
    const body = encodeURIComponent(
      `I want to report this user:\nUser ID: ${otherUserId}\nName: ${other?.display_name ?? 'Unknown'}\n\nReason:\n`
    )
    window.open(`mailto:hello@sondar.app?subject=${subject}&body=${body}`)
    setShowMenu(false)
  }

  const active = isActiveToday(other?.last_active)
  const initials = (other?.display_name ?? '?')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const primaryInstrument = other?.instruments?.[0]

  return (
    <div className="flex flex-col" style={{ height: '100dvh' }}>

      {/* ── Connection overlay ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showConnection && (
          <motion.div
            key="connection-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 1.0 } }}
            transition={{ duration: 0.15 }}
            onClick={() => setShowConnection(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 300,
              background: '#040407',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden',
              cursor: 'pointer',
            }}
          >
            {/* Orange orb — sweeps in from right, fills half the screen */}
            <motion.div
              aria-hidden
              initial={{ x: 480, opacity: 0.5 }}
              animate={{ x: 55, opacity: 1 }}
              transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.02 }}
              style={{
                position: 'absolute',
                width: 820, height: 820, borderRadius: '50%',
                top: '50%', left: '50%', marginLeft: -410, marginTop: -410,
                background: 'radial-gradient(circle, rgba(255,80,0,1) 0%, rgba(255,60,0,0.7) 28%, rgba(255,40,0,0.25) 55%, transparent 72%)',
                filter: 'blur(48px)',
                pointerEvents: 'none',
              }}
            />

            {/* Violet orb — sweeps in from left */}
            <motion.div
              aria-hidden
              initial={{ x: -480, opacity: 0.5 }}
              animate={{ x: -55, opacity: 1 }}
              transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.02 }}
              style={{
                position: 'absolute',
                width: 820, height: 820, borderRadius: '50%',
                top: '50%', left: '50%', marginLeft: -410, marginTop: -410,
                background: 'radial-gradient(circle, rgba(115,40,230,1) 0%, rgba(91,33,182,0.7) 28%, rgba(60,20,140,0.25) 55%, transparent 72%)',
                filter: 'blur(48px)',
                pointerEvents: 'none',
              }}
            />

            {/* Impact bloom — bright white-gold burst at collision point */}
            <motion.div
              aria-hidden
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.2, 3.0], opacity: [0, 1, 0] }}
              transition={{ duration: 1.1, delay: 0.92, ease: [0.2, 0, 0.8, 1] }}
              style={{
                position: 'absolute',
                width: 380, height: 380, borderRadius: '50%',
                top: '50%', left: '50%', marginLeft: -190, marginTop: -190,
                background: 'radial-gradient(circle, rgba(255,255,220,1) 0%, rgba(255,180,60,0.9) 25%, rgba(255,80,0,0.4) 55%, transparent 75%)',
                filter: 'blur(24px)',
                pointerEvents: 'none',
              }}
            />

            {/* Expanding ring at impact */}
            <motion.div
              aria-hidden
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1, 3.5], opacity: [0, 1, 0] }}
              transition={{ duration: 1.3, delay: 0.94, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                width: 160, height: 160, borderRadius: '50%',
                top: '50%', left: '50%', marginLeft: -80, marginTop: -80,
                border: '2.5px solid rgba(255,210,100,0.9)',
                pointerEvents: 'none',
              }}
            />

            {/* Content */}
            <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

              {/* Avatar pair */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 30, marginBottom: 52 }}>

                {/* Other person — orange glow */}
                <motion.div
                  initial={{ x: -70, opacity: 0, scale: 0.55 }}
                  animate={{ x: 0, opacity: 1, scale: 1 }}
                  transition={{ delay: 0.12, duration: 0.75, ease: [0.16, 1, 0.3, 1] as const }}
                  style={{
                    width: 82, height: 82, borderRadius: '50%',
                    overflow: 'hidden', flexShrink: 0,
                    border: '3px solid rgba(255,85,0,1)',
                    boxShadow: '0 0 0 5px rgba(255,85,0,0.15), 0 0 48px rgba(255,85,0,0.75)',
                    background: '#1a1a1a',
                  }}
                >
                  {other?.avatar_url ? (
                    <Image
                      src={other.avatar_url}
                      alt={other.display_name ?? ''}
                      width={82} height={82}
                      style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-bebas)', fontSize: 28, color: 'rgba(255,85,0,0.9)' }}>
                        {(other?.display_name ?? '?')[0]?.toUpperCase()}
                      </span>
                    </div>
                  )}
                </motion.div>

                {/* Connection spark — pops at impact */}
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: [0, 2.4, 1], opacity: [0, 1, 1] }}
                  transition={{ delay: 0.76, duration: 0.55, ease: [0.16, 1, 0.3, 1] as const }}
                  style={{
                    width: 13, height: 13, borderRadius: '50%',
                    background: '#FF5500',
                    boxShadow: '0 0 0 4px rgba(255,85,0,0.25), 0 0 28px rgba(255,85,0,1), 0 0 70px rgba(255,85,0,0.6)',
                    flexShrink: 0,
                  }}
                />

                {/* Current user — violet glow */}
                <motion.div
                  initial={{ x: 70, opacity: 0, scale: 0.55 }}
                  animate={{ x: 0, opacity: 1, scale: 1 }}
                  transition={{ delay: 0.12, duration: 0.75, ease: [0.16, 1, 0.3, 1] as const }}
                  style={{
                    width: 82, height: 82, borderRadius: '50%',
                    overflow: 'hidden', flexShrink: 0,
                    border: '3px solid rgba(139,92,246,1)',
                    boxShadow: '0 0 0 5px rgba(91,33,182,0.15), 0 0 48px rgba(91,33,182,0.75)',
                    background: '#1a1a1a',
                  }}
                >
                  {currentUserAvatar ? (
                    <Image
                      src={currentUserAvatar}
                      alt="You"
                      width={82} height={82}
                      style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-bebas)', fontSize: 20, color: 'rgba(139,92,246,0.9)' }}>YOU</span>
                    </div>
                  )}
                </motion.div>
              </div>

              {/* Text */}
              <motion.p
                initial={{ opacity: 0, y: 24, scale: 0.82 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 1.0, duration: 0.65, ease: [0.16, 1, 0.3, 1] as const }}
                style={{ fontFamily: 'var(--font-bebas)', fontSize: 52, letterSpacing: '0.10em', color: '#F0EFEB', lineHeight: 1, textAlign: 'center' }}
              >
                CONNECTION MADE.
              </motion.p>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.35, duration: 0.5, ease: [0.16, 1, 0.3, 1] as const }}
                style={{ fontSize: 14, color: 'rgba(240,239,235,0.5)', marginTop: 10, letterSpacing: '0.04em', textAlign: 'center' }}
              >
                Make some noise.
              </motion.p>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.45, 0.45, 0] }}
                transition={{ delay: 2.2, duration: 2.4, times: [0, 0.15, 0.75, 1], repeat: Infinity, repeatDelay: 0.5 }}
                style={{ fontSize: 10, color: 'rgba(240,239,235,0.38)', marginTop: 44, letterSpacing: '0.22em', textAlign: 'center' }}
              >
                TAP TO CONTINUE
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Confirm delete sheet ────────────────────────────────────────── */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex cursor-pointer items-end justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setConfirmDelete(false)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 340 }}
              className="w-full max-w-lg rounded-t-3xl p-6"
              style={{ background: 'rgba(18,18,18,0.98)', border: '1px solid rgba(255,255,255,0.08)' }}
              onClick={e => e.stopPropagation()}
            >
              <p className="font-[family-name:var(--font-bebas)] text-2xl tracking-widest text-[#F0EFEB]">
                DELETE CONVERSATION?
              </p>
              <p className="mt-2 text-sm text-[rgba(240,239,235,0.5)] leading-relaxed">
                This removes the conversation from your inbox. The other person can still see their messages.
              </p>
              <div className="mt-5 flex flex-col gap-2">
                <button
                  onClick={() => { setConfirmDelete(false); void handleDeleteConversation() }}
                  className="w-full rounded-xl bg-red-600 py-3 text-sm font-semibold text-white"
                >
                  Delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="w-full rounded-xl py-3 text-sm text-[rgba(240,239,235,0.4)]"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Confirm block sheet ─────────────────────────────────────────── */}
      <AnimatePresence>
        {confirmBlock && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex cursor-pointer items-end justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setConfirmBlock(false)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 340 }}
              className="w-full max-w-lg rounded-t-3xl p-6"
              style={{ background: 'rgba(18,18,18,0.98)', border: '1px solid rgba(255,255,255,0.08)' }}
              onClick={e => e.stopPropagation()}
            >
              <p className="font-[family-name:var(--font-bebas)] text-2xl tracking-widest text-[#F0EFEB]">
                BLOCK {(other?.display_name ?? 'USER').toUpperCase()}?
              </p>
              <p className="mt-2 text-sm text-[rgba(240,239,235,0.5)] leading-relaxed">
                They won&apos;t be able to message you and you won&apos;t see them in Explore.
              </p>
              <div className="mt-5 flex flex-col gap-2">
                <button
                  onClick={() => { setConfirmBlock(false); handleBlock() }}
                  className="w-full rounded-xl bg-red-600 py-3 text-sm font-semibold text-white"
                >
                  Block
                </button>
                <button
                  onClick={() => setConfirmBlock(false)}
                  className="w-full rounded-xl py-3 text-sm text-[rgba(240,239,235,0.4)]"
                >
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
        <div className="mx-auto flex max-w-lg items-center gap-3">
          {/* Back */}
          <button
            onClick={() => router.push('/messages')}
            onTouchEnd={(e) => { e.preventDefault(); router.push('/messages') }}
            className="flex-shrink-0 text-[rgba(240,239,235,0.5)] transition-colors hover:text-[#F0EFEB]"
            style={{ fontSize: 22, lineHeight: 1, padding: '8px 12px 8px 4px', touchAction: 'manipulation' }}
            aria-label="Back"
          >
            ‹
          </button>

          {/* Avatar */}
          <button
            onClick={() => router.push(`/profile/${otherUserId}`)}
            className="flex-shrink-0 relative"
          >
            {other?.avatar_url ? (
              <Image
                src={other.avatar_url}
                alt={other.display_name ?? 'User'}
                width={38}
                height={38}
                style={{
                  width: 38, height: 38, borderRadius: '50%', objectFit: 'cover',
                  border: active ? '2px solid rgba(255,92,0,0.7)' : '2px solid rgba(240,239,235,0.15)',
                }}
              />
            ) : (
              <div
                className="flex items-center justify-center"
                style={{ width: 38, height: 38, borderRadius: '50%', background: '#1a1a1a',
                  border: '2px solid rgba(240,239,235,0.1)' }}
              >
                <span className="font-[family-name:var(--font-bebas)] text-sm text-[rgba(240,239,235,0.4)]">
                  {initials}
                </span>
              </div>
            )}
            {active && (
              <span style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 10, height: 10, borderRadius: '50%',
                background: '#34d399', border: '1.5px solid #0D0D0D',
              }} />
            )}
          </button>

          {/* Name + instrument */}
          <button
            onClick={() => router.push(`/profile/${otherUserId}`)}
            className="min-w-0 flex-1 text-left"
          >
            <p className="truncate font-[family-name:var(--font-bebas)] text-xl tracking-widest text-[#F0EFEB]">
              {other?.display_name?.toUpperCase() ?? 'LOADING…'}
            </p>
            <p className="text-[11px] text-[rgba(240,239,235,0.35)]">
              {primaryInstrument
                ? `${INSTRUMENT_EMOJI[primaryInstrument] ?? '🎵'} ${primaryInstrument}`
                : active ? 'Active today' : ''}
              {active && primaryInstrument ? ' · Active today' : ''}
            </p>
          </button>

          {/* ⋮ menu */}
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
                    position: 'absolute', top: 36, right: 0,
                    width: 200,
                    background: 'rgb(22,22,22)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    borderRadius: 14,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                    overflow: 'hidden',
                    zIndex: 100,
                  }}
                >
                  {[
                    {
                      label: 'View profile',
                      icon: '👤',
                      action: () => { setShowMenu(false); router.push(`/profile/${otherUserId}`) },
                      danger: false,
                    },
                    {
                      label: 'Delete conversation',
                      icon: '🗑️',
                      action: () => { setShowMenu(false); setConfirmDelete(true) },
                      danger: false,
                    },
                    {
                      label: 'Report user',
                      icon: '🚩',
                      action: () => handleReport(),
                      danger: false,
                    },
                    {
                      label: 'Block user',
                      icon: '🚫',
                      action: () => { setShowMenu(false); setConfirmBlock(true) },
                      danger: true,
                    },
                  ].map((item, i, arr) => (
                    <button
                      key={item.label}
                      onClick={item.action}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '11px 14px',
                        background: 'none',
                        border: 'none',
                        borderTop: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: 13,
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
        <div className="mx-auto max-w-lg">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[rgba(240,239,235,0.12)] border-t-[#FF5500]" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              {/* Avatar */}
              <div
                style={{
                  width: 72, height: 72, borderRadius: '50%', overflow: 'hidden',
                  border: '2px solid rgba(255,92,0,0.35)',
                  background: '#1a1a1a',
                  boxShadow: '0 0 32px rgba(255,92,0,0.12)',
                }}
              >
                {other?.avatar_url ? (
                  <img src={other.avatar_url} alt={other.display_name ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-bebas)', fontSize: 24, color: 'rgba(255,92,0,0.8)' }}>
                      {(other?.display_name ?? '?')[0]?.toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <p className="font-[family-name:var(--font-bebas)] text-2xl tracking-widest text-[#F0EFEB]">
                  {(other?.display_name ?? 'MUSICIAN').toUpperCase()}
                </p>
                {primaryInstrument && (
                  <p className="mt-0.5 text-xs text-[rgba(240,239,235,0.35)]">
                    {INSTRUMENT_EMOJI[primaryInstrument] ?? '🎵'} {primaryInstrument} · {active ? 'Active today' : 'Offline'}
                  </p>
                )}
              </div>
              <div
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 14,
                  padding: '12px 20px',
                  maxWidth: 280,
                }}
              >
                <p className="text-xs leading-relaxed text-[rgba(240,239,235,0.4)]">
                  Say hi and tell them what you&apos;re working on 🎵
                </p>
              </div>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((msg, i) => {
                const isMine = msg.from_id === currentUserId
                const showDay = i === 0 || !isSameDay(messages[i - 1].created_at, msg.created_at)
                const isTemp = msg.id.startsWith('temp-')
                const isLiked = likedMessages.has(msg.id) || (msg.liked_by ?? []).length > 0
                const isAnimating = likeAnimating === msg.id

                // Only show heart if this message was liked by someone
                const likedByOther = (msg.liked_by ?? []).some(id => id !== currentUserId)
                const likedByMe = likedMessages.has(msg.id)

                return (
                  <div key={msg.id}>
                    {showDay && (
                      <div className="my-4 flex items-center gap-3">
                        <div className="h-px flex-1 bg-[rgba(240,239,235,0.06)]" />
                        <span className="text-[10px] font-medium text-[rgba(240,239,235,0.25)]">
                          {formatDayLabel(msg.created_at)}
                        </span>
                        <div className="h-px flex-1 bg-[rgba(240,239,235,0.06)]" />
                      </div>
                    )}

                    <div
                      className={`mb-1 flex ${isMine ? 'justify-end' : 'justify-start'}`}
                      onClick={() => handleMessageTap(msg.id)}
                      style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
                    >
                      <div style={{ position: 'relative', maxWidth: '75%' }}>
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

                        {/* Timestamp + seen + like row */}
                        <div className={`mt-0.5 flex items-center gap-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                          {/* Like shown on received messages (liked by me) */}
                          {!isMine && likedByMe && (
                            <span style={{ fontSize: 10 }}>❤️</span>
                          )}

                          <span className="text-[9px] text-[rgba(240,239,235,0.22)]">
                            {formatBubbleTime(msg.created_at)}
                          </span>

                          {/* Seen receipt on sent messages */}
                          {isMine && !isTemp && (
                            <span
                              className="text-[9px] font-medium"
                              style={{ color: msg.read_at ? '#FF5C00' : 'rgba(240,239,235,0.28)' }}
                              title={msg.read_at ? 'Seen' : 'Sent'}
                            >
                              {msg.read_at ? '✓✓' : '✓'}
                            </span>
                          )}

                          {/* Like shown on sent messages (liked by other) */}
                          {isMine && likedByOther && (
                            <span style={{ fontSize: 10 }}>❤️</span>
                          )}
                        </div>

                        {/* Floating heart animation on double-tap */}
                        <AnimatePresence>
                          {isAnimating && (
                            <motion.span
                              initial={{ opacity: 1, y: 0, scale: 1 }}
                              animate={{ opacity: 0, y: -48, scale: 1.8 }}
                              exit={{}}
                              transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] as const }}
                              style={{
                                position: 'absolute',
                                top: '50%', left: '50%',
                                transform: 'translate(-50%, -50%)',
                                fontSize: 22, pointerEvents: 'none', zIndex: 10,
                              }}
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

          {/* Typing indicator */}
          <AnimatePresence>
            {otherTyping && (
              <motion.div
                key="typing"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.2 }}
                className="mb-2 flex justify-start"
              >
                <div
                  className="px-4 py-3"
                  style={{
                    background: 'rgba(255,255,255,0.09)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '18px 18px 18px 4px',
                  }}
                >
                  <div className="flex items-center gap-1">
                    {[0, 150, 300].map(delay => (
                      <span
                        key={delay}
                        className="animate-bounce rounded-full bg-[rgba(240,239,235,0.4)]"
                        style={{ width: 6, height: 6, animationDelay: `${delay}ms` }}
                      />
                    ))}
                  </div>
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
        <div className="mx-auto flex max-w-lg items-end gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => {
              setInput(e.target.value)
              void typingChannelRef.current?.send({
                type: 'broadcast', event: 'typing',
                payload: { userId: currentUserId },
              })
            }}
            onKeyDown={handleKeyDown}
            placeholder="Message…"
            rows={1}
            className="flex-1 resize-none text-sm text-[#F0EFEB] placeholder-[rgba(240,239,235,0.25)] outline-none"
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 20,
              padding: '10px 16px',
              maxHeight: 120,
              overflowY: 'auto',
            }}
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
              flexShrink: 0,
              width: 38, height: 38,
              borderRadius: '50%',
              background: input.trim() ? '#FF5500' : 'rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: input.trim() ? '0 0 12px rgba(255,85,0,0.35)' : 'none',
              transition: 'background 0.2s, box-shadow 0.2s',
            }}
            aria-label="Send"
          >
            <svg viewBox="0 0 24 24" fill="none" style={{ width: 18, height: 18 }}
              stroke={input.trim() ? '#000' : 'rgba(240,239,235,0.3)'} strokeWidth={2.5}>
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" fill="currentColor" stroke="none"
                style={{ color: input.trim() ? '#000' : 'rgba(240,239,235,0.3)' }} />
            </svg>
          </motion.button>
        </div>
      </div>

    </div>
  )
}
