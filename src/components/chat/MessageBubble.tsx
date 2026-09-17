'use client'

import { useEffect, useRef, useState, type ReactNode, type TouchEvent } from 'react'
import Image from 'next/image'
import { AnimatePresence, motion } from 'framer-motion'
import type { ChatMessageBase } from '@/lib/chat/types'
import { REACTION_EMOJIS, summarizeReactions } from '@/lib/chat/reactions'
import { canStillEdit, formatBubbleTime } from '@/lib/chat/time'
import { renderMessageText } from '@/lib/chat/text'
import { useEscapeKey } from '@/lib/hooks/useEscapeKey'

export interface ReplyTarget {
  id: string
  senderName: string | null
  content: string
  image_url: string | null
  deleted: boolean
  /** The original isn't in the loaded history (e.g. hidden by "delete conversation"). */
  unavailable?: boolean
}

export interface MessageBubbleProps {
  msg: ChatMessageBase
  currentUserId: string
  isMine: boolean
  isTemp: boolean
  /** Last bubble in a same-sender group — shows the timestamp row. */
  showTime: boolean
  /** First bubble in a group from someone else, in group chats — shows the name. */
  showSender?: boolean
  senderName?: string | null
  /** ✓ / ✓✓ etc., rendered by the page since receipts differ per surface. */
  receipt?: ReactNode
  replyTarget?: ReplyTarget | null
  mentions?: string[]
  canHover: boolean
  /** Briefly true after "jump to original" so the bubble flashes. */
  highlighted?: boolean
  onReply: (msg: ChatMessageBase) => void
  onReact: (msg: ChatMessageBase, emoji: string) => void
  onEdit?: (msg: ChatMessageBase) => void
  onDelete?: (msg: ChatMessageBase) => void
  onImageClick?: (url: string) => void
  onJumpTo?: (id: string) => void
}

const SWIPE_TRIGGER_PX = 56
const SWIPE_MAX_PX = 72
const LONG_PRESS_MS = 450
const DOUBLE_TAP_MS = 300

export default function MessageBubble({
  msg, currentUserId, isMine, isTemp, showTime, showSender, senderName, receipt,
  replyTarget, mentions, canHover, highlighted,
  onReply, onReact, onEdit, onDelete, onImageClick, onJumpTo,
}: MessageBubbleProps) {
  const [actionsOpen, setActionsOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [swipeX, setSwipeX] = useState(0)
  const [burst, setBurst] = useState<string | null>(null)

  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const swipeActive = useRef(false)
  const gestureCancelled = useRef(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTap = useRef(0)
  const rootRef = useRef<HTMLDivElement>(null)

  const deleted = msg.deleted_at !== null
  const reactions = summarizeReactions(msg.reactions, currentUserId)
  const editable = isMine && !deleted && !isTemp && onEdit && canStillEdit(msg.created_at)

  useEscapeKey(actionsOpen || pickerOpen, () => { setActionsOpen(false); setPickerOpen(false) })

  useEffect(() => () => { if (longPressTimer.current) clearTimeout(longPressTimer.current) }, [])

  // The inline emoji strip closes when you tap anywhere else, like Instagram.
  useEffect(() => {
    if (!pickerOpen) return
    function onOutside(e: Event) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setPickerOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('touchstart', onOutside)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('touchstart', onOutside)
    }
  }, [pickerOpen])

  function clearLongPress() {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
  }

  function react(emoji: string) {
    if (isTemp || deleted) return
    setBurst(emoji)
    setTimeout(() => setBurst(null), 650)
    onReact(msg, emoji)
  }

  // ── Touch: swipe right → reply, long-press → actions ────────────────────
  function handleTouchStart(e: TouchEvent) {
    if (isTemp || deleted) return
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
    swipeActive.current = false
    gestureCancelled.current = false
    clearLongPress()
    longPressTimer.current = setTimeout(() => {
      if (gestureCancelled.current || swipeActive.current) return
      try { navigator.vibrate?.(10) } catch { /* ignore */ }
      setPickerOpen(true)
    }, LONG_PRESS_MS)
  }

  function handleTouchMove(e: TouchEvent) {
    if (!touchStart.current) return
    const t = e.touches[0]
    const dx = t.clientX - touchStart.current.x
    const dy = t.clientY - touchStart.current.y
    if (!swipeActive.current) {
      if (Math.abs(dy) > 10) { gestureCancelled.current = true; clearLongPress(); return }
      if (dx > 12) { swipeActive.current = true; clearLongPress() }
      return
    }
    setSwipeX(Math.max(0, Math.min(SWIPE_MAX_PX, dx - 12)))
  }

  function handleTouchEnd() {
    clearLongPress()
    if (swipeActive.current && swipeX >= SWIPE_TRIGGER_PX) {
      try { navigator.vibrate?.(8) } catch { /* ignore */ }
      onReply(msg)
    }
    swipeActive.current = false
    touchStart.current = null
    setSwipeX(0)
  }

  // ── Double-tap / double-click → ❤️ ──────────────────────────────────────
  function handleBubbleClick() {
    if (isTemp || deleted) return
    const now = Date.now()
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0
      react('❤️')
    } else {
      lastTap.current = now
    }
  }

  const bubbleStyle = isMine
    ? { background: '#FF5500', color: '#000', border: 'none', borderRadius: showTime ? '18px 18px 4px 18px' : '18px 18px 6px 18px' }
    : {
        background: 'rgba(255,255,255,0.09)', color: '#F0EFEB',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: showTime ? '18px 18px 18px 4px' : '18px 18px 18px 6px',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      }

  const canAct = !isTemp && !deleted

  return (
    <div
      id={`msg-${msg.id}`}
      ref={rootRef}
      className={`group relative flex items-end ${isMine ? 'justify-end' : 'justify-start'} ${showTime ? 'mb-2' : 'mb-0.5'}`}
      style={{ touchAction: 'pan-y' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* Swipe-to-reply affordance */}
      {swipeX > 0 && (
        <span
          className="absolute left-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full"
          style={{ background: 'rgba(255,92,0,0.18)', opacity: Math.min(1, swipeX / SWIPE_TRIGGER_PX) }}
          aria-hidden
        >
          <ReplyIcon />
        </span>
      )}

      <div
        style={{
          position: 'relative', maxWidth: '75%',
          transform: swipeX ? `translateX(${swipeX}px)` : undefined,
          transition: swipeX ? undefined : 'transform 0.18s ease',
        }}
      >
        {showSender && !isMine && (
          <p className="mb-0.5 px-1 text-[10px] font-medium" style={{ color: 'rgba(255,92,0,0.75)' }}>
            {senderName ?? 'Unknown'}
          </p>
        )}

        {/* This wrapper contains only the bubble, so the toolbar and emoji strip
            position relative to it — not to the name/reactions/timestamp rows. */}
        <div className="relative">
        {/* Emoji button next to the bubble: hover-revealed on desktop, always
            there (faint) on touch. Tap → inline strip, no sheet. */}
        {canAct && (
          <div
            className={`absolute top-1/2 flex -translate-y-1/2 items-center gap-0.5 transition-opacity ${isMine ? 'right-full mr-1.5' : 'left-full ml-1.5'} ${
              canHover ? 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100' : 'opacity-45'
            }`}
          >
            <ToolbarButton label="React" onClick={() => setPickerOpen(v => !v)}>
              <SmileIcon />
            </ToolbarButton>
            {canHover && (
              <>
                <ToolbarButton label="Reply" onClick={() => onReply(msg)}><ReplyIcon /></ToolbarButton>
                <ToolbarButton label="More" onClick={() => setActionsOpen(true)}>⋯</ToolbarButton>
              </>
            )}
          </div>
        )}

        {/* Instagram-style inline reaction strip — floats above the bubble */}
        <AnimatePresence>
          {pickerOpen && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.92 }}
              transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] as const }}
              className={`absolute bottom-full z-20 mb-1.5 flex items-center gap-0.5 rounded-full px-1.5 py-1 ${isMine ? 'right-0' : 'left-0'}`}
              style={{
                background: 'rgba(24,24,24,0.98)',
                border: '1px solid rgba(255,255,255,0.10)',
                boxShadow: '0 8px 28px rgba(0,0,0,0.55)',
                transformOrigin: isMine ? 'bottom right' : 'bottom left',
              }}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
            >
              {REACTION_EMOJIS.map((emoji) => {
                const mine = (msg.reactions[emoji] ?? []).includes(currentUserId)
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setPickerOpen(false); react(emoji) }}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-[22px] leading-none transition-transform hover:scale-125 active:scale-90"
                    style={{ background: mine ? 'rgba(255,92,0,0.22)' : 'transparent' }}
                    aria-label={`React ${emoji}`}
                  >
                    {emoji}
                  </button>
                )
              })}
              {!canHover && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setPickerOpen(false); setActionsOpen(true) }}
                  className="ml-0.5 flex h-9 w-9 items-center justify-center rounded-full text-[rgba(240,239,235,0.6)]"
                  style={{ background: 'rgba(255,255,255,0.06)', fontSize: 18, lineHeight: 1 }}
                  aria-label="More"
                >
                  ⋯
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, y: 6, scale: 0.98 }}
          animate={{ opacity: isTemp ? 0.65 : 1, y: 0, scale: 1 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] as const }}
        >
          <div
            onClick={handleBubbleClick}
            className={`overflow-hidden ${highlighted ? 'ring-2 ring-[#FF5C00]/60' : ''}`}
            style={{
              ...bubbleStyle,
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
              userSelect: canHover ? 'text' : 'none',
              WebkitUserSelect: canHover ? 'text' : 'none',
              WebkitTouchCallout: 'none',
              transition: 'box-shadow 0.3s',
            }}
          >
            {/* Quoted reply */}
            {replyTarget && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); if (!replyTarget.unavailable) onJumpTo?.(replyTarget.id) }}
                className="mx-2 mt-2 flex w-[calc(100%-16px)] gap-2 rounded-xl px-2.5 py-1.5 text-left"
                style={{
                  background: isMine ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.07)',
                  borderLeft: `2px solid ${isMine ? 'rgba(0,0,0,0.45)' : '#FF5C00'}`,
                }}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] font-semibold" style={{ color: isMine ? 'rgba(0,0,0,0.65)' : '#FF5C00' }}>
                    {replyTarget.senderName ?? 'Unknown'}
                  </span>
                  <span className="block truncate text-[11px]" style={{ color: isMine ? 'rgba(0,0,0,0.6)' : 'rgba(240,239,235,0.55)' }}>
                    {replyTarget.unavailable ? 'Original message unavailable'
                      : replyTarget.deleted ? 'Message deleted'
                      : replyTarget.content || (replyTarget.image_url ? '📷 Photo' : '')}
                  </span>
                </span>
                {replyTarget.image_url && !replyTarget.deleted && (
                  <Image src={replyTarget.image_url} alt="" width={36} height={36}
                    unoptimized={!/^https?:\/\//.test(replyTarget.image_url)}
                    style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                )}
              </button>
            )}

            {/* Image */}
            {msg.image_url && !deleted && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onImageClick?.(msg.image_url!) }}
                className="block w-full"
                style={{ maxWidth: 320 }}
                aria-label="Open photo"
              >
                <Image
                  src={msg.image_url}
                  alt=""
                  width={640}
                  height={480}
                  sizes="(max-width: 640px) 75vw, 320px"
                  unoptimized={!/^https?:\/\//.test(msg.image_url)}
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                />
              </button>
            )}

            {/* Text */}
            {deleted ? (
              <p className="px-4 py-2.5 text-sm italic" style={{ color: isMine ? 'rgba(0,0,0,0.55)' : 'rgba(240,239,235,0.4)' }}>
                This message was deleted
              </p>
            ) : msg.content ? (
              <p className="whitespace-pre-wrap break-words px-4 py-2.5 text-sm leading-relaxed">
                {renderMessageText(msg.content, { mentions })}
              </p>
            ) : null}
          </div>
        </motion.div>
        </div>

        {/* Reactions */}
        {reactions.length > 0 && (
          <div className={`mt-1 flex flex-wrap gap-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
            {reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                onClick={(e) => { e.stopPropagation(); react(r.emoji) }}
                className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] leading-none"
                style={{
                  background: r.mine ? 'rgba(255,92,0,0.18)' : 'rgba(255,255,255,0.08)',
                  border: `1px solid ${r.mine ? 'rgba(255,92,0,0.45)' : 'rgba(255,255,255,0.10)'}`,
                  color: '#F0EFEB',
                }}
                aria-label={`${r.emoji} ${r.count}`}
              >
                <span>{r.emoji}</span>
                {r.count > 1 && <span className="text-[10px] opacity-70">{r.count}</span>}
              </button>
            ))}
          </div>
        )}

        {/* Timestamp row — only on the last bubble of a group */}
        {showTime && (
          <div className={`mt-0.5 flex items-center gap-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
            <span className="text-[9px] text-[rgba(240,239,235,0.22)]">{formatBubbleTime(msg.created_at)}</span>
            {msg.edited_at && !deleted && (
              <span className="text-[9px] text-[rgba(240,239,235,0.22)]">· edited</span>
            )}
            {isMine && !isTemp && receipt}
          </div>
        )}

        {/* Floating reaction burst */}
        <AnimatePresence>
          {burst && (
            <motion.span
              key={burst}
              initial={{ opacity: 1, y: 0, scale: 1 }}
              animate={{ opacity: 0, y: -48, scale: 1.8 }}
              exit={{}}
              transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] as const }}
              style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 22, pointerEvents: 'none', zIndex: 10 }}
            >
              {burst}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Action sheet — reactions + reply / copy / edit / delete */}
      <AnimatePresence>
        {actionsOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[250] flex cursor-pointer items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center"
            onClick={() => setActionsOpen(false)}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 340 }}
              className="w-full max-w-sm cursor-default rounded-t-3xl p-4 sm:rounded-3xl"
              style={{ background: 'rgba(18,18,18,0.98)', border: '1px solid rgba(255,255,255,0.08)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <SheetAction icon={<ReplyIcon />} label="Reply" onClick={() => { setActionsOpen(false); onReply(msg) }} />
              {msg.content && (
                <SheetAction icon="📋" label="Copy text" onClick={() => {
                  setActionsOpen(false)
                  void navigator.clipboard?.writeText(msg.content).catch(() => {})
                }} />
              )}
              {editable && (
                <SheetAction icon="✏️" label="Edit" onClick={() => { setActionsOpen(false); onEdit?.(msg) }} />
              )}
              {isMine && onDelete && (
                <SheetAction icon="🗑️" label="Delete for everyone" danger onClick={() => { setActionsOpen(false); onDelete(msg) }} />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ToolbarButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick() }}
      aria-label={label}
      title={label}
      className="flex h-7 w-7 items-center justify-center rounded-full text-[13px] text-[rgba(240,239,235,0.6)] transition-colors hover:text-[#F0EFEB]"
      style={{ background: 'rgba(22,22,22,0.92)', border: '1px solid rgba(255,255,255,0.10)' }}
    >
      {children}
    </button>
  )
}

function SheetAction({ icon, label, onClick, danger }: { icon: ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition-colors hover:bg-[rgba(255,255,255,0.05)]"
      style={{ color: danger ? '#ef4444' : 'rgba(240,239,235,0.85)' }}
    >
      <span className="flex w-5 justify-center text-[15px]">{icon}</span>
      {label}
    </button>
  )
}

function SmileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  )
}

function ReplyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </svg>
  )
}
