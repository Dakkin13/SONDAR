'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { useEscapeKey } from '@/lib/hooks/useEscapeKey'
import { useCanHover } from '@/lib/hooks/useMediaQuery'
import Avatar from '@/components/ui/Avatar'
import MessageBubble, { type ReplyTarget } from '@/components/chat/MessageBubble'
import ChatComposer from '@/components/chat/ChatComposer'
import ImageLightbox from '@/components/chat/ImageLightbox'
import { normalizeMessageRow, upsertMessage, isTempId, type DmMessage } from '@/lib/chat/types'
import { toggleReaction } from '@/lib/chat/reactions'
import { formatDayLabel, formatLastSeen, isGroupedWithPrevious, isSameDay } from '@/lib/chat/time'
import { uploadChatImage } from '@/lib/chat/images'
import { getDraft, setDraft } from '@/lib/chat/drafts'
import { getErrorMessage } from '@/lib/utils'
import type { Profile } from '@/types'

type OtherProfile = Pick<Profile, 'id' | 'display_name' | 'avatar_url' | 'instruments' | 'last_active'>

function isActiveToday(lastActive: string | null | undefined): boolean {
  if (!lastActive) return false
  return Date.now() - new Date(lastActive).getTime() < 86400000
}

const INSTRUMENT_EMOJI: Record<string, string> = {
  guitar: '🎸', bass: '🎸', drums: '🥁', keys: '🎹', piano: '🎹',
  violin: '🎻', cello: '🎻', trumpet: '🎺', saxophone: '🎷', flute: '🪈',
  vocals: '🎤', producer: '🎚️', dj: '🎧', other: '🎵',
}

const NEAR_BOTTOM_PX = 120

export default function ChatPage() {
  const { userId: otherUserId } = useParams<{ userId: string }>()
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()
  const canHover = useCanHover()
  const draftKey = `dm-${otherUserId}`

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null)
  const [other, setOther] = useState<OtherProfile | null>(null)
  const [otherOnline, setOtherOnline] = useState(false)
  const [messages, setMessages] = useState<DmMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showConnection, setShowConnection] = useState(false)
  const [otherTyping, setOtherTyping] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmBlock, setConfirmBlock] = useState(false)
  const [replyTo, setReplyTo] = useState<DmMessage | null>(null)
  const [editing, setEditing] = useState<DmMessage | null>(null)
  const [attachment, setAttachment] = useState<{ file: File; previewUrl: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [keyboardOffset, setKeyboardOffset] = useState(0)

  const currentUserIdRef = useRef<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const nearBottomRef = useRef(true)
  const wasEmptyRef = useRef(true)
  const lastSentAtRef = useRef(0)
  const lastTypingSentRef = useRef(0)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typingChannelRef = useRef<any>(null)
  const menuRef = useRef<HTMLDivElement>(null)

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
      setInput(getDraft(draftKey))
      void supabase.rpc('touch_last_active')

      const [profileRes, myProfileRes, historyRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, display_name, avatar_url, instruments, last_active')
          .eq('id', otherUserId)
          .single(),
        supabase.from('profiles').select('avatar_url').eq('id', user.id).single(),
        // select('*') so the page keeps working if the chat_features migration
        // hasn't been applied yet — missing columns are just undefined.
        supabase
          .from('messages')
          .select('*')
          .or(`and(from_id.eq.${user.id},to_id.eq.${otherUserId}),and(from_id.eq.${otherUserId},to_id.eq.${user.id})`)
          .order('created_at', { ascending: true }),
      ])

      if (profileRes.data) setOther(profileRes.data as OtherProfile)
      if (myProfileRes.data?.avatar_url) setCurrentUserAvatar(myProfileRes.data.avatar_url)

      const history = ((historyRes.data ?? []) as Record<string, unknown>[]).map(r => normalizeMessageRow<DmMessage>(r))
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

  useEffect(() => {
    if (!loading) scrollToBottom('instant' as ScrollBehavior)
  }, [loading, scrollToBottom])

  // ── Realtime — INSERT / UPDATE / DELETE + typing + presence ──────────────
  useEffect(() => {
    if (!currentUserId) return
    const myId = currentUserId

    function inConversation(row: { from_id: string; to_id: string }) {
      return (row.from_id === myId && row.to_id === otherUserId) || (row.from_id === otherUserId && row.to_id === myId)
    }

    const channel = supabase
      .channel(`chat-${myId}-${otherUserId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = normalizeMessageRow<DmMessage>(payload.new as Record<string, unknown>)
        if (!inConversation(msg)) return
        // upsertMessage dedupes by id, so it's safe whether this echo lands
        // before or after our own insert response.
        setMessages(prev => upsertMessage(prev, msg))
        if (msg.from_id === otherUserId) {
          setOtherTyping(false)
          void supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', msg.id)
          if (nearBottomRef.current) setTimeout(() => scrollToBottom(), 30)
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        const updated = normalizeMessageRow<DmMessage>(payload.new as Record<string, unknown>)
        if (!inConversation(updated)) return
        setMessages(prev => (prev.some(m => m.id === updated.id) ? upsertMessage(prev, updated) : prev))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
        const id = (payload.old as { id?: string }).id
        if (id) setMessages(prev => prev.filter(m => m.id !== id))
      })
      .subscribe()

    const convKey = [myId, otherUserId].sort().join('-')
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

    const presenceCh = supabase.channel(`presence-dm-${convKey}`, { config: { presence: { key: myId } } })
    presenceCh
      .on('presence', { event: 'sync' }, () => {
        setOtherOnline(Boolean(presenceCh.presenceState()[otherUserId]))
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void presenceCh.track({ online_at: new Date().toISOString() })
      })

    return () => {
      void supabase.removeChannel(channel)
      void supabase.removeChannel(typingCh)
      void supabase.removeChannel(presenceCh)
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    }
  }, [currentUserId, otherUserId, scrollToBottom]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Close menu on outside click ───────────────────────────────────────────
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

  useEscapeKey(showMenu || confirmDelete || confirmBlock, () => {
    setShowMenu(false)
    setConfirmDelete(false)
    setConfirmBlock(false)
  })

  useEffect(() => () => { if (attachment) URL.revokeObjectURL(attachment.previewUrl) }, [attachment])

  function handleListScroll() {
    const el = listRef.current
    if (!el) return
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX
  }

  function handleInputChange(v: string) {
    setInput(v)
    if (!editing) setDraft(draftKey, v)
  }

  function handleTyping() {
    const now = Date.now()
    if (now - lastTypingSentRef.current < 1000) return
    lastTypingSentRef.current = now
    void typingChannelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { userId: currentUserId } })
  }

  // ── Reactions / reply / edit / delete ─────────────────────────────────────
  async function handleReact(msg: DmMessage, emoji: string) {
    if (!currentUserId || isTempId(msg.id)) return
    const next = toggleReaction(msg.reactions, emoji, currentUserId)
    setMessages(prev => prev.map(m => (m.id === msg.id ? { ...m, reactions: next } : m)))
    const { error } = await supabase.from('messages').update({ reactions: next }).eq('id', msg.id)
    if (error) {
      setMessages(prev => prev.map(m => (m.id === msg.id ? { ...m, reactions: msg.reactions } : m)))
      toast(getErrorMessage(error, 'Could not react'), 'error')
    }
  }

  function startReply(msg: DmMessage) {
    setEditing(null)
    setReplyTo(msg)
  }

  function startEdit(msg: DmMessage) {
    setReplyTo(null)
    setAttachment(null)
    setEditing(msg)
    setInput(msg.content)
  }

  function cancelEdit() {
    setEditing(null)
    setInput(getDraft(draftKey))
  }

  async function handleDelete(msg: DmMessage) {
    if (isTempId(msg.id)) return
    const snapshot = msg
    setMessages(prev => prev.map(m => (m.id === msg.id ? { ...m, deleted_at: new Date().toISOString(), content: '', image_url: null, reactions: {} } : m)))
    const { error } = await supabase.from('messages').update({ deleted_at: new Date().toISOString() }).eq('id', msg.id)
    if (error) {
      setMessages(prev => prev.map(m => (m.id === msg.id ? snapshot : m)))
      toast(getErrorMessage(error, 'Could not delete message'), 'error')
    }
  }

  function jumpTo(id: string) {
    document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightedId(id)
    setTimeout(() => setHighlightedId(null), 1400)
  }

  // ── Send / save edit ─────────────────────────────────────────────────────
  async function handleSend() {
    if (!currentUserId || sending) return
    const content = input.trim()

    if (editing) {
      if (!content || content === editing.content) { cancelEdit(); return }
      const target = editing
      setSending(true)
      setMessages(prev => prev.map(m => (m.id === target.id ? { ...m, content, edited_at: new Date().toISOString() } : m)))
      cancelEdit()
      const { error } = await supabase.from('messages').update({ content }).eq('id', target.id)
      if (error) {
        setMessages(prev => prev.map(m => (m.id === target.id ? target : m)))
        toast(getErrorMessage(error, 'Could not edit message'), 'error')
      }
      setSending(false)
      inputRef.current?.focus()
      return
    }

    if (!content && !attachment) return
    const now = Date.now()
    if (now - lastSentAtRef.current < 800) return
    lastSentAtRef.current = now

    setSending(true)
    const pendingAttachment = attachment
    const pendingReply = replyTo
    const wasEmpty = wasEmptyRef.current
    setInput('')
    setDraft(draftKey, '')
    setReplyTo(null)
    setAttachment(null)

    const tempId = `temp-${now}`
    const tempMsg: DmMessage = {
      id: tempId, from_id: currentUserId, to_id: otherUserId, content,
      created_at: new Date(now).toISOString(), read_at: null,
      reactions: {}, reply_to: pendingReply?.id ?? null,
      image_url: pendingAttachment?.previewUrl ?? null, deleted_at: null, edited_at: null,
    }
    setMessages(prev => upsertMessage(prev, tempMsg))
    setTimeout(() => scrollToBottom(), 30)

    function rollback(err: unknown, fallback: string) {
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setInput(content)
      setReplyTo(pendingReply)
      setAttachment(pendingAttachment)
      toast(getErrorMessage(err, fallback), 'error')
    }

    let imageUrl: string | null = null
    if (pendingAttachment) {
      setUploading(true)
      try {
        imageUrl = await uploadChatImage(supabase, currentUserId, pendingAttachment.file)
      } catch (err) {
        setUploading(false)
        setSending(false)
        rollback(err, 'Could not upload photo')
        return
      }
      setUploading(false)
    }

    // Only send the new columns when they carry a value, so plain text still
    // works if the chat_features migration hasn't been applied yet.
    const payload: Record<string, unknown> = { from_id: currentUserId, to_id: otherUserId, content }
    if (imageUrl) payload.image_url = imageUrl
    if (pendingReply) payload.reply_to = pendingReply.id

    const { data, error } = await supabase.from('messages').insert(payload).select().single()

    if (error || !data) {
      rollback(error, 'Could not send message')
    } else {
      const saved = normalizeMessageRow<DmMessage>(data as Record<string, unknown>)
      setMessages(prev => upsertMessage(prev, saved, tempId))
      if (pendingAttachment) URL.revokeObjectURL(pendingAttachment.previewUrl)

      if (wasEmpty) {
        wasEmptyRef.current = false
        setShowConnection(true)
        setTimeout(() => setShowConnection(false), 3600)
        try {
          const newMsgTime = new Date(saved.created_at).getTime()
          localStorage.removeItem(`conv_fresh_start_${otherUserId}`)
          if (newMsgTime > 0) localStorage.setItem(`conv_deleted_at_${otherUserId}`, (newMsgTime - 1).toString())
          localStorage.removeItem(`hidden_conv_${otherUserId}`)
        } catch { /* ignore */ }
      }
    }

    setSending(false)
    inputRef.current?.focus()
  }

  function handleAttach(file: File) {
    if (!file.type.startsWith('image/')) { toast('Only images can be attached', 'error'); return }
    setEditing(null)
    setAttachment({ file, previewUrl: URL.createObjectURL(file) })
    inputRef.current?.focus()
  }

  // ── Delete conversation ───────────────────────────────────────────────────
  async function handleDeleteConversation() {
    if (!currentUserId) return
    await supabase.from('messages').delete().eq('from_id', currentUserId).eq('to_id', otherUserId)
    try {
      localStorage.setItem(`hidden_conv_${otherUserId}`, '1')
      localStorage.setItem(`conv_deleted_at_${otherUserId}`, Date.now().toString())
      localStorage.setItem(`conv_fresh_start_${otherUserId}`, '1')
    } catch { /* ignore */ }
    router.refresh()
    router.push('/messages')
  }

  function handleBlock() {
    try { localStorage.setItem(`blocked_${otherUserId}`, '1') } catch { /* ignore */ }
    toast(`${other?.display_name ?? 'User'} has been blocked`, 'default')
    router.push('/messages')
  }

  function handleReport() {
    const subject = encodeURIComponent(`Report user: ${otherUserId}`)
    const body = encodeURIComponent(
      `I want to report this user:\nUser ID: ${otherUserId}\nName: ${other?.display_name ?? 'Unknown'}\n\nReason:\n`
    )
    window.open(`mailto:hello@sondar.app?subject=${subject}&body=${body}`)
    setShowMenu(false)
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const active = isActiveToday(other?.last_active)
  const initials = (other?.display_name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const primaryInstrument = other?.instruments?.[0]
  const presenceLabel = otherOnline ? 'online' : formatLastSeen(other?.last_active)
  const subtitle = [
    primaryInstrument ? `${INSTRUMENT_EMOJI[primaryInstrument] ?? '🎵'} ${primaryInstrument}` : null,
    presenceLabel,
  ].filter(Boolean).join(' · ')

  const byId = new Map(messages.map(m => [m.id, m]))
  function replyTargetFor(msg: DmMessage): ReplyTarget | null {
    if (!msg.reply_to) return null
    const t = byId.get(msg.reply_to)
    if (!t) return { id: msg.reply_to, senderName: null, content: '', image_url: null, deleted: false, unavailable: true }
    return {
      id: t.id,
      senderName: t.from_id === currentUserId ? 'You' : (other?.display_name ?? null),
      content: t.content, image_url: t.image_url, deleted: t.deleted_at !== null,
    }
  }

  return (
    <div className="flex flex-col" style={{ height: '100dvh' }}>
      <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />

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

            <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 30, marginBottom: 52 }}>
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
                    <Image src={other.avatar_url} alt={other.display_name ?? ''} width={82} height={82}
                      style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-bebas)', fontSize: 28, color: 'rgba(255,85,0,0.9)' }}>
                        {(other?.display_name ?? '?')[0]?.toUpperCase()}
                      </span>
                    </div>
                  )}
                </motion.div>

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
                    <Image src={currentUserAvatar} alt="You" width={82} height={82}
                      style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-bebas)', fontSize: 20, color: 'rgba(139,92,246,0.9)' }}>YOU</span>
                    </div>
                  )}
                </motion.div>
              </div>

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
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex cursor-pointer items-end justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setConfirmDelete(false)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 340 }}
              className="w-full max-w-lg md:max-w-2xl rounded-t-3xl p-6"
              style={{ background: 'rgba(18,18,18,0.98)', border: '1px solid rgba(255,255,255,0.08)' }}
              onClick={e => e.stopPropagation()}
            >
              <p className="font-[family-name:var(--font-bebas)] text-2xl tracking-widest text-[#F0EFEB]">DELETE CONVERSATION?</p>
              <p className="mt-2 text-sm text-[rgba(240,239,235,0.5)] leading-relaxed">
                This removes the conversation from your inbox. The other person can still see their messages.
              </p>
              <div className="mt-5 flex flex-col gap-2">
                <button onClick={() => { setConfirmDelete(false); void handleDeleteConversation() }}
                  className="w-full rounded-xl bg-red-600 py-3 text-sm font-semibold text-white">Delete</button>
                <button onClick={() => setConfirmDelete(false)}
                  className="w-full rounded-xl py-3 text-sm text-[rgba(240,239,235,0.4)]">Cancel</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Confirm block sheet ─────────────────────────────────────────── */}
      <AnimatePresence>
        {confirmBlock && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex cursor-pointer items-end justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setConfirmBlock(false)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 340 }}
              className="w-full max-w-lg md:max-w-2xl rounded-t-3xl p-6"
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
                <button onClick={() => { setConfirmBlock(false); handleBlock() }}
                  className="w-full rounded-xl bg-red-600 py-3 text-sm font-semibold text-white">Block</button>
                <button onClick={() => setConfirmBlock(false)}
                  className="w-full rounded-xl py-3 text-sm text-[rgba(240,239,235,0.4)]">Cancel</button>
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

          <button onClick={() => router.push(`/profile/${otherUserId}`)} className="flex-shrink-0 relative">
            <Avatar
              src={other?.avatar_url}
              alt={other?.display_name ?? 'User'}
              size={38}
              border={other?.avatar_url
                ? (active || otherOnline ? '2px solid rgba(255,92,0,0.7)' : '2px solid rgba(240,239,235,0.15)')
                : '2px solid rgba(240,239,235,0.1)'}
              background="#1a1a1a"
            >
              <span className="font-[family-name:var(--font-bebas)] text-sm text-[rgba(240,239,235,0.4)]">{initials}</span>
            </Avatar>
            {(otherOnline || active) && (
              <span style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 10, height: 10, borderRadius: '50%',
                background: '#34d399', border: '1.5px solid #0D0D0D',
              }} />
            )}
          </button>

          <button onClick={() => router.push(`/profile/${otherUserId}`)} className="min-w-0 flex-1 text-left">
            <p className="truncate font-[family-name:var(--font-bebas)] text-xl tracking-widest text-[#F0EFEB]">
              {other?.display_name?.toUpperCase() ?? 'LOADING…'}
            </p>
            <p className="truncate text-[11px]" style={{ color: otherOnline ? '#34d399' : 'rgba(240,239,235,0.35)' }}>
              {subtitle}
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
                    { label: 'View profile', icon: '👤', action: () => { setShowMenu(false); router.push(`/profile/${otherUserId}`) }, danger: false },
                    { label: 'Delete conversation', icon: '🗑️', action: () => { setShowMenu(false); setConfirmDelete(true) }, danger: false },
                    { label: 'Report user', icon: '🚩', action: () => handleReport(), danger: false },
                    { label: 'Block user', icon: '🚫', action: () => { setShowMenu(false); setConfirmBlock(true) }, danger: true },
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
      <div ref={listRef} onScroll={handleListScroll} className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-lg md:max-w-2xl">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[rgba(240,239,235,0.12)] border-t-[#FF5500]" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <Avatar
                src={other?.avatar_url}
                alt={other?.display_name ?? ''}
                size={72}
                border="2px solid rgba(255,92,0,0.35)"
                background="#1a1a1a"
                boxShadow="0 0 32px rgba(255,92,0,0.12)"
              >
                <span style={{ fontFamily: 'var(--font-bebas)', fontSize: 24, color: 'rgba(255,92,0,0.8)' }}>
                  {(other?.display_name ?? '?')[0]?.toUpperCase()}
                </span>
              </Avatar>
              <div>
                <p className="font-[family-name:var(--font-bebas)] text-2xl tracking-widest text-[#F0EFEB]">
                  {(other?.display_name ?? 'MUSICIAN').toUpperCase()}
                </p>
                {subtitle && <p className="mt-0.5 text-xs text-[rgba(240,239,235,0.35)]">{subtitle}</p>}
              </div>
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '12px 20px', maxWidth: 280 }}>
                <p className="text-xs leading-relaxed text-[rgba(240,239,235,0.4)]">
                  Say hi and tell them what you&apos;re working on 🎵
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg, i) => {
              const prev = messages[i - 1]
              const next = messages[i + 1]
              const showDay = !prev || !isSameDay(prev.created_at, msg.created_at)
              const showTime = !next || !isGroupedWithPrevious(msg, next)
              return (
                <div key={msg.id}>
                  {showDay && (
                    <div className="sticky top-0 z-[5] my-3 flex justify-center">
                      <span
                        className="rounded-full px-3 py-1 text-[10px] font-medium text-[rgba(240,239,235,0.45)]"
                        style={{ background: 'rgba(13,13,13,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.06)' }}
                      >
                        {formatDayLabel(msg.created_at)}
                      </span>
                    </div>
                  )}
                  <MessageBubble
                    msg={msg}
                    currentUserId={currentUserId ?? ''}
                    isMine={msg.from_id === currentUserId}
                    isTemp={isTempId(msg.id)}
                    showTime={showTime}
                    replyTarget={replyTargetFor(msg)}
                    canHover={canHover}
                    highlighted={highlightedId === msg.id}
                    receipt={
                      <span
                        className="text-[9px] font-medium"
                        style={{ color: msg.read_at ? '#FF5C00' : 'rgba(240,239,235,0.28)' }}
                        title={msg.read_at ? 'Seen' : 'Sent'}
                      >
                        {msg.read_at ? '✓✓' : '✓'}
                      </span>
                    }
                    onReply={m => startReply(m as DmMessage)}
                    onReact={(m, emoji) => void handleReact(m as DmMessage, emoji)}
                    onEdit={m => startEdit(m as DmMessage)}
                    onDelete={m => void handleDelete(m as DmMessage)}
                    onImageClick={setLightboxUrl}
                    onJumpTo={jumpTo}
                  />
                </div>
              )
            })
          )}

          <AnimatePresence>
            {otherTyping && (
              <motion.div
                key="typing"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.2 }}
                className="mb-2 flex justify-start"
              >
                <div className="px-4 py-3" style={{
                  background: 'rgba(255,255,255,0.09)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.12)', borderRadius: '18px 18px 18px 4px',
                }}>
                  <div className="flex items-center gap-1">
                    {[0, 150, 300].map(delay => (
                      <span key={delay} className="animate-bounce rounded-full bg-[rgba(240,239,235,0.4)]"
                        style={{ width: 6, height: 6, animationDelay: `${delay}ms` }} />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={bottomRef} />
        </div>
      </div>

      <ChatComposer
        value={input}
        onChange={handleInputChange}
        onSend={() => void handleSend()}
        onTyping={handleTyping}
        sending={sending}
        keyboardOffset={keyboardOffset}
        inputRef={inputRef}
        onAttach={handleAttach}
        attachment={attachment ? { previewUrl: attachment.previewUrl } : null}
        onRemoveAttachment={() => setAttachment(null)}
        uploading={uploading}
        replyTo={replyTo ? {
          senderName: replyTo.from_id === currentUserId ? 'You' : (other?.display_name ?? null),
          content: replyTo.content, image_url: replyTo.image_url,
        } : null}
        onCancelReply={() => setReplyTo(null)}
        editing={editing !== null}
        onCancelEdit={cancelEdit}
      />
    </div>
  )
}
