'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'

interface OtherProfile {
  id: string
  display_name: string | null
  avatar_url: string | null
  instruments?: string[]
  last_active?: string | null
}

interface ChatMessage {
  id: string
  created_at: string
  from_id: string
  to_id: string
  content: string
  read_at: string | null
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

function isGroupBreak(a: string, b: string): boolean {
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) > 5 * 60 * 1000
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
  const [other, setOther] = useState<OtherProfile | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showConnection, setShowConnection] = useState(false)

  const currentUserIdRef = useRef<string | null>(null)
  const sentIds = useRef(new Set<string>())
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const wasEmptyRef = useRef(true)

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior })
  }, [])

  // ── Load current user + other profile + message history ──────────────────
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      setCurrentUserId(user.id)
      currentUserIdRef.current = user.id

      const [profileRes, historyRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, display_name, avatar_url, instruments, last_active')
          .eq('id', otherUserId)
          .single(),
        supabase
          .from('messages')
          .select('id, from_id, to_id, content, created_at, read_at')
          .or(
            `and(from_id.eq.${user.id},to_id.eq.${otherUserId}),and(from_id.eq.${otherUserId},to_id.eq.${user.id})`
          )
          .order('created_at', { ascending: true }),
      ])

      if (profileRes.data) setOther(profileRes.data as OtherProfile)

      const history = (historyRes.data as ChatMessage[]) ?? []
      wasEmptyRef.current = history.length === 0
      setMessages(history)
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

  // ── Realtime — ONLY for messages from the other person ───────────────────
  useEffect(() => {
    if (!currentUserId) return

    const channel = supabase
      .channel(`chat-${currentUserId}-${otherUserId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new as ChatMessage
          // Use ref to avoid stale closure — currentUserId is stable after init
          const myId = currentUserIdRef.current
          if (!myId) return

          // Only add if from the other person to us — our own sends are
          // already in state via optimistic update + insert response
          if (msg.from_id !== otherUserId || msg.to_id !== myId) return
          // Skip if we already have this message (belt-and-suspenders)
          if (sentIds.current.has(msg.id)) return

          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev
            return [...prev, msg]
          })

          // Mark as read immediately
          void supabase
            .from('messages')
            .update({ read_at: new Date().toISOString() })
            .eq('id', msg.id)

          scrollToBottom()
        }
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [currentUserId, otherUserId, scrollToBottom]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scroll on new messages ────────────────────────────────────────────────
  useEffect(() => {
    if (messages.length > 0 && !loading) scrollToBottom()
  }, [messages.length, loading, scrollToBottom])

  // ── Send ─────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    const content = input.trim()
    if (!content || !currentUserId || sending) return

    setSending(true)
    setInput('')
    const wasEmpty = wasEmptyRef.current

    // Optimistic message
    const tempId = `temp-${Date.now()}`
    const tempMsg: ChatMessage = {
      id: tempId,
      from_id: currentUserId,
      to_id: otherUserId,
      content,
      created_at: new Date().toISOString(),
      read_at: null,
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
        setTimeout(() => setShowConnection(false), 2200)
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

  const active = isActiveToday(other?.last_active)
  const initials = (other?.display_name ?? '?')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const primaryInstrument = other?.instruments?.[0]

  return (
    <div className="flex flex-col bg-[#0D0D0D]" style={{ height: '100dvh' }}>

      {/* Connection overlay */}
      <AnimatePresence>
        {showConnection && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-[#0D0D0D]"
          >
            <div className="flex items-center gap-8 mb-8">
              <motion.div
                initial={{ x: -40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] as const }}
                className="h-16 w-16 overflow-hidden rounded-full border-2 bg-[#1a1a1a]"
                style={{ borderColor: 'rgba(255,92,0,0.5)', boxShadow: '0 0 24px rgba(255,92,0,0.3)' }}
              >
                {other?.avatar_url && <img src={other.avatar_url} alt="" className="h-full w-full object-cover" />}
              </motion.div>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.3, 1] }}
                transition={{ delay: 0.35, duration: 0.4 }}
                className="h-3 w-3 rounded-full bg-[#FF5C00]"
                style={{ boxShadow: '0 0 12px rgba(255,92,0,0.8)' }}
              />
              <motion.div
                initial={{ x: 40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] as const }}
                className="h-16 w-16 overflow-hidden rounded-full border-2 bg-[#1a1a1a]"
                style={{ borderColor: 'rgba(91,33,182,0.5)', boxShadow: '0 0 24px rgba(91,33,182,0.3)' }}
              />
            </div>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="text-[#F0EFEB]"
              style={{ fontFamily: 'var(--font-bebas)', fontSize: 40, letterSpacing: '0.08em' }}
            >
              CONNECTION MADE.
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              transition={{ delay: 0.7, duration: 0.4 }}
              className="text-sm text-[rgba(240,239,235,0.4)] mt-2"
            >
              Make some noise.
            </motion.p>
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
          <button
            onClick={() => router.push('/messages')}
            className="flex-shrink-0 text-[rgba(240,239,235,0.5)] transition-colors hover:text-[#F0EFEB]"
            style={{ fontSize: 22, lineHeight: 1 }}
            aria-label="Back"
          >
            ‹
          </button>

          <button
            onClick={() => router.push(`/profile/${otherUserId}`)}
            className="flex-shrink-0 relative"
          >
            {other?.avatar_url ? (
              <img
                src={other.avatar_url}
                alt={other.display_name ?? 'User'}
                style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover',
                  border: active ? '2px solid rgba(255,92,0,0.7)' : '2px solid rgba(240,239,235,0.15)' }}
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
            <div className="flex flex-col items-center gap-2 py-24 text-center">
              <p className="font-[family-name:var(--font-bebas)] text-2xl tracking-widest text-[rgba(240,239,235,0.2)]">
                START THE CONVERSATION
              </p>
              <p className="text-xs text-[rgba(240,239,235,0.3)]">
                Send a message to {other?.display_name ?? 'this musician'}.
              </p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((msg, i) => {
                const isMine = msg.from_id === currentUserId
                const showDay = i === 0 || !isSameDay(messages[i - 1].created_at, msg.created_at)
                const showTime = i === 0 || showDay || isGroupBreak(messages[i - 1].created_at, msg.created_at)
                const isTemp = msg.id.startsWith('temp-')

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

                    {showTime && !showDay && (
                      <p className="mb-1 mt-4 text-center text-[10px] text-[rgba(240,239,235,0.2)]">
                        {formatBubbleTime(msg.created_at)}
                      </p>
                    )}

                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.97 }}
                      animate={{ opacity: isTemp ? 0.65 : 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] as const }}
                      className={`mb-1 flex ${isMine ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className="max-w-[75%] px-4 py-2.5"
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
                  </div>
                )
              })}
            </AnimatePresence>
          )}
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
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
        }}
      >
        <div className="mx-auto flex max-w-lg items-end gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
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
            onClick={() => { try { navigator.vibrate?.(10) } catch {} ; void handleSend() }}
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
