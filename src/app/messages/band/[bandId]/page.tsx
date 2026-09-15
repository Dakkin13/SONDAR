'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { useEscapeKey } from '@/lib/hooks/useEscapeKey'
import { useCanHover } from '@/lib/hooks/useMediaQuery'
import Avatar from '@/components/ui/Avatar'
import MessageBubble, { type ReplyTarget } from '@/components/chat/MessageBubble'
import ChatComposer from '@/components/chat/ChatComposer'
import ImageLightbox from '@/components/chat/ImageLightbox'
import { normalizeMessageRow, upsertMessage, isTempId, type BandChatMessage } from '@/lib/chat/types'
import { toggleReaction } from '@/lib/chat/reactions'
import { formatDayLabel, isGroupedWithPrevious, isSameDay } from '@/lib/chat/time'
import { uploadChatImage } from '@/lib/chat/images'
import { getDraft, setDraft } from '@/lib/chat/drafts'
import { markBandMessagesRead } from '@/lib/data/messages'
import { getErrorMessage } from '@/lib/utils'
import type { Band, ProfileSummary } from '@/types'

interface BandMemberLite {
  user_id: string
  display_name: string | null
  avatar_url: string | null
}

const NEAR_BOTTOM_PX = 120

export default function BandChatPage() {
  const { bandId } = useParams<{ bandId: string }>()
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()
  const canHover = useCanHover()
  const draftKey = `band-${bandId}`

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [band, setBand] = useState<Band | null>(null)
  const [members, setMembers] = useState<BandMemberLite[]>([])
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set())
  const [messages, setMessages] = useState<BandChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [typingUserIds, setTypingUserIds] = useState<Set<string>>(new Set())
  const [showMenu, setShowMenu] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [replyTo, setReplyTo] = useState<BandChatMessage | null>(null)
  const [editing, setEditing] = useState<BandChatMessage | null>(null)
  const [attachment, setAttachment] = useState<{ file: File; previewUrl: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [keyboardOffset, setKeyboardOffset] = useState(0)

  const listRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const nearBottomRef = useRef(true)
  const lastSentAtRef = useRef(0)
  const lastTypingSentRef = useRef(0)
  const typingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typingChannelRef = useRef<any>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const memberMap = new Map(members.map(m => [m.user_id, m]))
  const mentionNames = members.flatMap(m => {
    const name = m.display_name?.trim()
    if (!name) return []
    const first = name.split(' ')[0]
    return first && first !== name ? [name, first] : [name]
  })

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
      setInput(getDraft(draftKey))
      void supabase.rpc('touch_last_active')

      const [bandRes, memberRowsRes, historyRes] = await Promise.all([
        supabase.from('bands').select('*').eq('id', bandId).single(),
        supabase.from('band_members').select('user_id').eq('band_id', bandId),
        supabase.from('band_messages').select('*').eq('band_id', bandId).order('created_at', { ascending: true }),
      ])

      if (bandRes.data) setBand(bandRes.data as Band)

      const memberIds = (memberRowsRes.data ?? []).map(m => m.user_id as string)
      if (memberIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, display_name, avatar_url').in('id', memberIds)
        setMembers(((profiles ?? []) as ProfileSummary[]).map(p => ({ user_id: p.id, display_name: p.display_name, avatar_url: p.avatar_url })))
      }

      const history = ((historyRes.data ?? []) as Record<string, unknown>[]).map(r => normalizeMessageRow<BandChatMessage>(r))
      setMessages(history)
      setLoading(false)

      void markBandMessagesRead(supabase, user.id, history)
    }
    void init()
  }, [bandId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loading) scrollToBottom('instant' as ScrollBehavior)
  }, [loading, scrollToBottom])

  // ── Realtime — one channel per band + typing + presence ──────────────────
  useEffect(() => {
    if (!currentUserId) return
    const myId = currentUserId
    const typingTimeouts = typingTimeoutsRef.current

    const channel = supabase
      .channel(`band-chat-${bandId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'band_messages' }, (payload) => {
        const msg = normalizeMessageRow<BandChatMessage>(payload.new as Record<string, unknown>)
        if (msg.band_id !== bandId) return
        setMessages(prev => upsertMessage(prev, msg))
        if (msg.from_id !== myId) {
          setTypingUserIds(prev => { if (!prev.has(msg.from_id)) return prev; const n = new Set(prev); n.delete(msg.from_id); return n })
          void supabase.from('band_messages').update({ read_by: [...(msg.read_by ?? []), myId] }).eq('id', msg.id)
          if (nearBottomRef.current) setTimeout(() => scrollToBottom(), 30)
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'band_messages' }, (payload) => {
        const updated = normalizeMessageRow<BandChatMessage>(payload.new as Record<string, unknown>)
        if (updated.band_id !== bandId) return
        setMessages(prev => (prev.some(m => m.id === updated.id) ? upsertMessage(prev, updated) : prev))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'band_messages' }, (payload) => {
        const id = (payload.old as { id?: string }).id
        if (id) setMessages(prev => prev.filter(m => m.id !== id))
      })
      .subscribe()

    const typingCh = supabase
      .channel(`typing-band-${bandId}`)
      .on('broadcast', { event: 'typing' }, (payload) => {
        const typerId = (payload.payload as { userId?: string })?.userId
        if (!typerId || typerId === myId) return
        setTypingUserIds(prev => new Set(prev).add(typerId))
        if (typingTimeoutsRef.current[typerId]) clearTimeout(typingTimeoutsRef.current[typerId])
        typingTimeoutsRef.current[typerId] = setTimeout(() => {
          setTypingUserIds(prev => { const n = new Set(prev); n.delete(typerId); return n })
        }, 3000)
      })
      .subscribe()
    typingChannelRef.current = typingCh

    const presenceCh = supabase.channel(`presence-band-${bandId}`, { config: { presence: { key: myId } } })
    presenceCh
      .on('presence', { event: 'sync' }, () => {
        setOnlineIds(new Set(Object.keys(presenceCh.presenceState())))
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void presenceCh.track({ online_at: new Date().toISOString() })
      })

    return () => {
      void supabase.removeChannel(channel)
      void supabase.removeChannel(typingCh)
      void supabase.removeChannel(presenceCh)
      Object.values(typingTimeouts).forEach(clearTimeout)
    }
  }, [currentUserId, bandId, scrollToBottom]) // eslint-disable-line react-hooks/exhaustive-deps

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
  async function handleReact(msg: BandChatMessage, emoji: string) {
    if (!currentUserId || isTempId(msg.id)) return
    const next = toggleReaction(msg.reactions, emoji, currentUserId)
    setMessages(prev => prev.map(m => (m.id === msg.id ? { ...m, reactions: next } : m)))
    const { error } = await supabase.from('band_messages').update({ reactions: next }).eq('id', msg.id)
    if (error) {
      setMessages(prev => prev.map(m => (m.id === msg.id ? { ...m, reactions: msg.reactions } : m)))
      toast(getErrorMessage(error, 'Could not react'), 'error')
    }
  }

  function startReply(msg: BandChatMessage) { setEditing(null); setReplyTo(msg) }
  function startEdit(msg: BandChatMessage) { setReplyTo(null); setAttachment(null); setEditing(msg); setInput(msg.content) }
  function cancelEdit() { setEditing(null); setInput(getDraft(draftKey)) }

  async function handleDelete(msg: BandChatMessage) {
    if (isTempId(msg.id)) return
    const snapshot = msg
    setMessages(prev => prev.map(m => (m.id === msg.id ? { ...m, deleted_at: new Date().toISOString(), content: '', image_url: null, reactions: {} } : m)))
    const { error } = await supabase.from('band_messages').update({ deleted_at: new Date().toISOString() }).eq('id', msg.id)
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
      const { error } = await supabase.from('band_messages').update({ content }).eq('id', target.id)
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
    setInput('')
    setDraft(draftKey, '')
    setReplyTo(null)
    setAttachment(null)

    const tempId = `temp-${now}`
    const tempMsg: BandChatMessage = {
      id: tempId, band_id: bandId, from_id: currentUserId, content,
      created_at: new Date(now).toISOString(), read_by: [],
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

    const payload: Record<string, unknown> = { band_id: bandId, from_id: currentUserId, content }
    if (imageUrl) payload.image_url = imageUrl
    if (pendingReply) payload.reply_to = pendingReply.id

    const { data, error } = await supabase.from('band_messages').insert(payload).select().single()

    if (error || !data) {
      rollback(error, 'Could not send message')
    } else {
      setMessages(prev => upsertMessage(prev, normalizeMessageRow<BandChatMessage>(data as Record<string, unknown>), tempId))
      if (pendingAttachment) URL.revokeObjectURL(pendingAttachment.previewUrl)
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

  async function handleLeave() {
    if (!currentUserId) return
    await supabase.from('band_members').delete().eq('band_id', bandId).eq('user_id', currentUserId)
    router.push('/bands')
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const othersOnline = members.filter(m => m.user_id !== currentUserId && onlineIds.has(m.user_id)).length
  const subtitle = `${members.length} member${members.length !== 1 ? 's' : ''}${othersOnline > 0 ? ` · ${othersOnline} online` : ''}`

  const typingNames = Array.from(typingUserIds).map(id => memberMap.get(id)?.display_name?.split(' ')[0] ?? 'Someone')
  const typingLabel = typingNames.length === 0 ? null
    : typingNames.length === 1 ? `${typingNames[0]} is typing…`
    : typingNames.length === 2 ? `${typingNames[0]} and ${typingNames[1]} are typing…`
    : `${typingNames[0]}, ${typingNames[1]} +${typingNames.length - 2} are typing…`

  const byId = new Map(messages.map(m => [m.id, m]))
  function senderName(userId: string): string | null {
    return userId === currentUserId ? 'You' : (memberMap.get(userId)?.display_name ?? null)
  }
  function replyTargetFor(msg: BandChatMessage): ReplyTarget | null {
    if (!msg.reply_to) return null
    const t = byId.get(msg.reply_to)
    if (!t) return { id: msg.reply_to, senderName: null, content: '', image_url: null, deleted: false, unavailable: true }
    return { id: t.id, senderName: senderName(t.from_id), content: t.content, image_url: t.image_url, deleted: t.deleted_at !== null }
  }

  return (
    <div className="flex flex-col" style={{ height: '100dvh' }}>
      <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />

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
                  className="w-full rounded-xl bg-red-600 py-3 text-sm font-semibold text-white">Leave band</button>
                <button onClick={() => setConfirmLeave(false)} className="w-full rounded-xl py-3 text-sm text-[rgba(240,239,235,0.4)]">Cancel</button>
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
            <Avatar
              src={band?.avatar_url}
              alt={band?.name ?? 'Band'}
              size={38}
              shape="rounded"
              radius={12}
              border={band?.avatar_url ? '2px solid rgba(240,239,235,0.15)' : '2px solid rgba(240,239,235,0.1)'}
              background="#1a1a1a"
            >
              <span className="text-base">🎸</span>
            </Avatar>
          </button>

          <button onClick={() => router.push(`/bands/${bandId}`)} className="min-w-0 flex-1 text-left">
            <p className="truncate font-[family-name:var(--font-bebas)] text-xl tracking-widest text-[#F0EFEB]">
              {band?.name?.toUpperCase() ?? 'LOADING…'}
            </p>
            <p className="text-[11px]" style={{ color: othersOnline > 0 ? '#34d399' : 'rgba(240,239,235,0.35)' }}>{subtitle}</p>
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
      <div ref={listRef} onScroll={handleListScroll} className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-lg md:max-w-2xl">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[rgba(240,239,235,0.12)] border-t-[#FF5500]" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <Avatar
                src={band?.avatar_url}
                alt={band?.name ?? 'Band'}
                size={72}
                shape="rounded"
                radius={16}
                border="2px solid rgba(255,92,0,0.35)"
                background="#1a1a1a"
                boxShadow="0 0 32px rgba(255,92,0,0.12)"
              >
                <span className="text-2xl">🎸</span>
              </Avatar>
              <div>
                <p className="font-[family-name:var(--font-bebas)] text-2xl tracking-widest text-[#F0EFEB]">
                  {(band?.name ?? 'YOUR BAND').toUpperCase()}
                </p>
                <p className="mt-0.5 text-xs text-[rgba(240,239,235,0.35)]">{subtitle}</p>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '12px 20px', maxWidth: 280 }}>
                <p className="text-xs leading-relaxed text-[rgba(240,239,235,0.4)]">Say hi to the band 🎵</p>
              </div>
            </div>
          ) : (
            messages.map((msg, i) => {
              const prev = messages[i - 1]
              const next = messages[i + 1]
              const showDay = !prev || !isSameDay(prev.created_at, msg.created_at)
              const grouped = !showDay && isGroupedWithPrevious(prev, msg)
              const showTime = !next || !isGroupedWithPrevious(msg, next)
              const isMine = msg.from_id === currentUserId
              const readCount = (msg.read_by ?? []).filter(id => id !== msg.from_id).length
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
                    isMine={isMine}
                    isTemp={isTempId(msg.id)}
                    showTime={showTime}
                    showSender={!grouped}
                    senderName={memberMap.get(msg.from_id)?.display_name ?? null}
                    replyTarget={replyTargetFor(msg)}
                    mentions={mentionNames}
                    canHover={canHover}
                    highlighted={highlightedId === msg.id}
                    receipt={readCount > 0 ? (
                      <span className="text-[9px] font-medium" style={{ color: '#FF5C00' }} title={`Seen by ${readCount}`}>
                        ✓✓ {readCount > 1 ? readCount : ''}
                      </span>
                    ) : (
                      <span className="text-[9px] font-medium" style={{ color: 'rgba(240,239,235,0.28)' }} title="Sent">✓</span>
                    )}
                    onReply={m => startReply(m as BandChatMessage)}
                    onReact={(m, emoji) => void handleReact(m as BandChatMessage, emoji)}
                    onEdit={m => startEdit(m as BandChatMessage)}
                    onDelete={m => void handleDelete(m as BandChatMessage)}
                    onImageClick={setLightboxUrl}
                    onJumpTo={jumpTo}
                  />
                </div>
              )
            })
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

      <ChatComposer
        value={input}
        onChange={handleInputChange}
        onSend={() => void handleSend()}
        onTyping={handleTyping}
        sending={sending}
        placeholder="Message the band…"
        keyboardOffset={keyboardOffset}
        inputRef={inputRef}
        onAttach={handleAttach}
        attachment={attachment ? { previewUrl: attachment.previewUrl } : null}
        onRemoveAttachment={() => setAttachment(null)}
        uploading={uploading}
        replyTo={replyTo ? { senderName: senderName(replyTo.from_id), content: replyTo.content, image_url: replyTo.image_url } : null}
        onCancelReply={() => setReplyTo(null)}
        editing={editing !== null}
        onCancelEdit={cancelEdit}
      />
    </div>
  )
}
