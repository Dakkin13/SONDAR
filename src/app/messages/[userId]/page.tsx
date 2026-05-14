'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import type { Message } from '@/types'

interface OtherProfile {
  id: string
  display_name: string | null
  avatar_url: string | null
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

const bubbleIn = {
  hidden: { opacity: 0, y: 10, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] as const } },
}

export default function ChatPage() {
  const { userId: otherId } = useParams<{ userId: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [myId, setMyId] = useState<string | null>(null)
  const [other, setOther] = useState<OtherProfile | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const myIdRef = useRef<string | null>(null)

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior })
  }, [])

  // Mark all unread messages from other as read
  const markRead = useCallback(async (uid: string) => {
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('sender_id', otherId)
      .eq('recipient_id', uid)
      .is('read_at', null)
  }, [otherId])

  useEffect(() => {
    async function init() {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setMyId(user.id)
      myIdRef.current = user.id

      // Fetch other user's profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .eq('id', otherId)
        .single()
      setOther(profile as OtherProfile | null)

      // Fetch message history
      const { data: history } = await supabase
        .from('messages')
        .select('id, sender_id, recipient_id, content, created_at, read_at')
        .or(
          `and(sender_id.eq.${user.id},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${user.id})`
        )
        .order('created_at', { ascending: true })

      setMessages((history as Message[]) ?? [])
      setLoading(false)

      // Mark messages as read
      await markRead(user.id)
    }
    void init()
  }, [otherId])

  // Scroll to bottom on initial load
  useEffect(() => {
    if (!loading) scrollToBottom('instant' as ScrollBehavior)
  }, [loading])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`chat:${[myIdRef.current, otherId].sort().join(':')}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          // Filter handled client-side since Supabase Realtime filter syntax varies
        },
        (payload) => {
          const msg = payload.new as Message
          const isRelevant =
            (msg.sender_id === myIdRef.current && msg.recipient_id === otherId) ||
            (msg.sender_id === otherId && msg.recipient_id === myIdRef.current)

          if (!isRelevant) return

          setMessages((prev) => {
            // Deduplicate: if we already have this id (optimistic), skip
            if (prev.some((m) => m.id === msg.id)) return prev
            return [...prev, msg]
          })

          // Mark as read if incoming
          if (msg.sender_id === otherId && myIdRef.current) {
            void supabase
              .from('messages')
              .update({ read_at: new Date().toISOString() })
              .eq('id', msg.id)
          }

          scrollToBottom()
        }
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [otherId, scrollToBottom])

  // Scroll to bottom whenever messages array grows
  useEffect(() => {
    if (messages.length > 0) scrollToBottom()
  }, [messages.length])

  async function sendMessage() {
    if (!draft.trim() || !myId || sending) return
    const content = draft.trim()
    setDraft('')
    setSending(true)

    // Optimistic insert
    const optimisticId = `opt-${Date.now()}`
    const optimistic: Message = {
      id: optimisticId,
      sender_id: myId,
      recipient_id: otherId,
      content,
      created_at: new Date().toISOString(),
      read_at: null,
    }
    setMessages((prev) => [...prev, optimistic])
    scrollToBottom()

    const { data: saved, error } = await supabase
      .from('messages')
      .insert({ sender_id: myId, recipient_id: otherId, content })
      .select()
      .single()

    if (error) {
      // Roll back optimistic message
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
      setDraft(content)
    } else if (saved) {
      // Replace optimistic with real
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticId ? (saved as Message) : m))
      )
    }
    setSending(false)
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  const initials = (other?.display_name ?? '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="flex h-screen flex-col bg-[#0D0D0D]">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-[rgba(240,239,235,0.06)] bg-[rgba(13,13,13,0.92)] px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <button
            onClick={() => router.push('/messages')}
            className="flex-shrink-0 text-sm text-[rgba(240,239,235,0.4)] transition-colors hover:text-[#F0EFEB]"
          >
            ←
          </button>

          {/* Avatar */}
          <button
            onClick={() => router.push(`/profile/${otherId}`)}
            className="flex-shrink-0"
          >
            {other?.avatar_url ? (
              <img
                src={other.avatar_url}
                alt={other.display_name ?? 'User'}
                className="h-9 w-9 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1a1a1a]">
                <span className="font-[family-name:var(--font-bebas)] text-sm text-[rgba(240,239,235,0.4)]">
                  {initials}
                </span>
              </div>
            )}
          </button>

          {/* Name */}
          <button
            onClick={() => router.push(`/profile/${otherId}`)}
            className="min-w-0 flex-1 text-left"
          >
            <p className="truncate font-[family-name:var(--font-bebas)] text-xl tracking-widest text-[#F0EFEB]">
              {other?.display_name?.toUpperCase() ?? 'LOADING…'}
            </p>
          </button>
        </div>
      </div>

      {/* Messages list */}
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
                const isMine = msg.sender_id === myId
                const showDay =
                  i === 0 || !isSameDay(messages[i - 1].created_at, msg.created_at)

                return (
                  <div key={msg.id}>
                    {/* Day separator */}
                    {showDay && (
                      <div className="my-4 flex items-center gap-3">
                        <div className="h-px flex-1 bg-[rgba(240,239,235,0.06)]" />
                        <span className="text-[10px] font-medium text-[rgba(240,239,235,0.25)]">
                          {formatDayLabel(msg.created_at)}
                        </span>
                        <div className="h-px flex-1 bg-[rgba(240,239,235,0.06)]" />
                      </div>
                    )}

                    <motion.div
                      variants={bubbleIn}
                      initial="hidden"
                      animate="show"
                      className={`mb-2 flex ${isMine ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                          isMine
                            ? 'rounded-br-sm bg-[#FF5500] text-black'
                            : 'glass rounded-bl-sm text-[#F0EFEB]'
                        }`}
                      >
                        <p className="text-sm leading-relaxed">{msg.content}</p>
                        <p
                          className={`mt-1 text-right text-[10px] ${
                            isMine ? 'text-[rgba(0,0,0,0.45)]' : 'text-[rgba(240,239,235,0.3)]'
                          }`}
                        >
                          {formatBubbleTime(msg.created_at)}
                        </p>
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

      {/* Input bar */}
      <div className="flex-shrink-0 border-t border-[rgba(240,239,235,0.06)] bg-[rgba(13,13,13,0.92)] px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-end gap-3">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message…"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-[rgba(240,239,235,0.1)] bg-[rgba(240,239,235,0.05)] px-4 py-3 text-sm text-[#F0EFEB] placeholder-[rgba(240,239,235,0.25)] outline-none transition-colors focus:border-[rgba(255,85,0,0.4)] focus:bg-[rgba(240,239,235,0.07)]"
            style={{ maxHeight: '120px', overflowY: 'auto' }}
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`
            }}
          />
          <button
            onClick={() => void sendMessage()}
            disabled={!draft.trim() || sending}
            className="flex-shrink-0 rounded-xl bg-[#FF5500] p-3 shadow-[0_0_12px_rgba(255,85,0,0.3)] transition-opacity hover:opacity-90 disabled:opacity-30"
            aria-label="Send"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-black" stroke="currentColor" strokeWidth={2}>
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" fill="currentColor" stroke="none" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
