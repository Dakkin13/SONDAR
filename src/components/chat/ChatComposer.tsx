'use client'

import { useEffect, useRef, type RefObject } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'

export interface ComposerReplyTarget {
  senderName: string | null
  content: string
  image_url: string | null
}

interface ChatComposerProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  onTyping?: () => void
  sending: boolean
  placeholder?: string
  keyboardOffset: number
  inputRef: RefObject<HTMLTextAreaElement | null>

  onAttach?: (file: File) => void
  attachment?: { previewUrl: string } | null
  onRemoveAttachment?: () => void
  uploading?: boolean

  replyTo?: ComposerReplyTarget | null
  onCancelReply?: () => void

  editing?: boolean
  onCancelEdit?: () => void
}

const MAX_HEIGHT = 120

// The message input shared by 1:1 and band chats: auto-growing textarea,
// Enter to send / Shift+Enter for a newline, photo attachment, and the
// reply / edit context bar. Bottom padding follows the iOS keyboard via the
// keyboardOffset the page measures from visualViewport.
export default function ChatComposer({
  value, onChange, onSend, onTyping, sending, placeholder = 'Message…', keyboardOffset, inputRef,
  onAttach, attachment, onRemoveAttachment, uploading,
  replyTo, onCancelReply, editing, onCancelEdit,
}: ChatComposerProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const canSend = (value.trim().length > 0 || !!attachment) && !sending && !uploading

  // Grow with content; collapse back when cleared (e.g. after send).
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = value ? `${Math.min(el.scrollHeight, MAX_HEIGHT)}px` : ''
  }, [value, inputRef])

  // Editing / replying should pull focus into the box.
  useEffect(() => {
    if (editing || replyTo) inputRef.current?.focus()
  }, [editing, replyTo, inputRef])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (canSend) onSend()
    } else if (e.key === 'Escape') {
      if (editing) onCancelEdit?.()
      else if (replyTo) onCancelReply?.()
    }
  }

  const contextLabel = editing ? 'Editing message' : replyTo ? `Replying to ${replyTo.senderName ?? 'message'}` : null
  const contextBody = editing ? null : replyTo ? (replyTo.content || (replyTo.image_url ? '📷 Photo' : '')) : null
  const onCancelContext = editing ? onCancelEdit : onCancelReply

  return (
    <div
      className="flex-shrink-0 px-4 pt-2"
      style={{
        background: 'rgba(13,13,13,0.92)',
        backdropFilter: 'blur(48px) saturate(180%)',
        WebkitBackdropFilter: 'blur(48px) saturate(180%)',
        borderTop: '0.5px solid rgba(255,255,255,0.08)',
        paddingBottom: keyboardOffset > 0 ? `${keyboardOffset + 12}px` : 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
      }}
    >
      <div className="mx-auto max-w-lg md:max-w-2xl">
        {/* Reply / edit context bar */}
        {contextLabel && (
          <div
            className="mb-2 flex items-center gap-2 rounded-xl px-3 py-2"
            style={{ background: 'rgba(255,255,255,0.05)', borderLeft: '2px solid #FF5C00' }}
          >
            {replyTo?.image_url && !editing && (
              <Image src={replyTo.image_url} alt="" width={32} height={32}
                unoptimized={!/^https?:\/\//.test(replyTo.image_url)}
                style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold" style={{ color: '#FF5C00' }}>{contextLabel}</p>
              {contextBody && <p className="truncate text-[11px] text-[rgba(240,239,235,0.5)]">{contextBody}</p>}
            </div>
            <button
              type="button"
              onClick={onCancelContext}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[rgba(240,239,235,0.45)] hover:text-[#F0EFEB]"
              aria-label={editing ? 'Cancel edit' : 'Cancel reply'}
              style={{ fontSize: 18, lineHeight: 1 }}
            >
              ×
            </button>
          </div>
        )}

        {/* Pending photo */}
        {attachment && (
          <div className="mb-2 flex items-center gap-3">
            <div className="relative">
              <Image src={attachment.previewUrl} alt="" width={64} height={64} unoptimized
                style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover', opacity: uploading ? 0.5 : 1 }} />
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-[rgba(240,239,235,0.2)] border-t-[#FF5500]" />
                </div>
              )}
              {!uploading && (
                <button
                  type="button"
                  onClick={onRemoveAttachment}
                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full text-black"
                  style={{ background: '#F0EFEB', fontSize: 14, lineHeight: 1 }}
                  aria-label="Remove photo"
                >
                  ×
                </button>
              )}
            </div>
            <span className="text-[11px] text-[rgba(240,239,235,0.4)]">{uploading ? 'Uploading…' : 'Photo attached'}</span>
          </div>
        )}

        <div className="flex items-end gap-2">
          {onAttach && !editing && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) onAttach(f)
                  e.currentTarget.value = ''
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading || !!attachment}
                className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full text-[rgba(240,239,235,0.45)] transition-colors hover:text-[#F0EFEB] disabled:opacity-40"
                style={{ background: 'rgba(255,255,255,0.07)', touchAction: 'manipulation' }}
                aria-label="Attach photo"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
                </svg>
              </button>
            </>
          )}

          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => { onChange(e.target.value); onTyping?.() }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            className="flex-1 resize-none text-sm text-[#F0EFEB] placeholder-[rgba(240,239,235,0.25)] outline-none"
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 20,
              padding: '10px 16px',
              maxHeight: MAX_HEIGHT,
              overflowY: 'auto',
            }}
          />

          <motion.button
            type="button"
            onClick={() => { if (canSend) { try { navigator.vibrate?.(10) } catch { /* ignore */ } onSend() } }}
            disabled={!canSend}
            whileHover={canSend ? { scale: 1.06 } : undefined}
            whileTap={canSend ? { scale: 0.92 } : undefined}
            style={{
              flexShrink: 0, width: 38, height: 38, borderRadius: '50%',
              background: canSend ? '#FF5500' : 'rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: canSend ? '0 0 12px rgba(255,85,0,0.35)' : 'none',
              transition: 'background 0.2s, box-shadow 0.2s',
              touchAction: 'manipulation',
            }}
            aria-label={editing ? 'Save edit' : 'Send'}
          >
            {editing ? (
              <svg viewBox="0 0 24 24" fill="none" style={{ width: 18, height: 18 }} stroke={canSend ? '#000' : 'rgba(240,239,235,0.3)'} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" style={{ width: 18, height: 18 }} stroke={canSend ? '#000' : 'rgba(240,239,235,0.3)'} strokeWidth={2.5}>
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" fill="currentColor" stroke="none" style={{ color: canSend ? '#000' : 'rgba(240,239,235,0.3)' }} />
              </svg>
            )}
          </motion.button>
        </div>
      </div>
    </div>
  )
}
