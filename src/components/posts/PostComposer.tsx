'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/components/ui/Avatar'
import { useToast } from '@/components/ui/Toast'
import { uploadImage } from '@/lib/chat/images'
import { getErrorMessage } from '@/lib/utils'
import { createPost, fetchPostableBands } from '@/lib/data/posts'
import type { ProfileSummary } from '@/types'

interface PostComposerProps {
  currentUser: ProfileSummary
  /** Pre-select a band (e.g. when composing from a band page). */
  defaultBandId?: string | null
  /** Hide the "post as" switcher and lock to this band. */
  lockBand?: boolean
  onPosted?: (postId: string) => void
  placeholder?: string
}

const MAX_LEN = 1000

// Write a post as yourself or as any band you belong to — the same composer
// backs the /posts page, the home tab, and band pages.
export default function PostComposer({ currentUser, defaultBandId = null, lockBand, onPosted, placeholder }: PostComposerProps) {
  const supabase = createClient()
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)

  const [bands, setBands] = useState<{ id: string; name: string; avatar_url: string | null }[]>([])
  const [asBandId, setAsBandId] = useState<string | null>(defaultBandId)
  const [text, setText] = useState('')
  const [file, setFile] = useState<{ file: File; previewUrl: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    void fetchPostableBands(supabase, currentUser.id).then(setBands).catch(() => {})
  }, [currentUser.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { if (file) URL.revokeObjectURL(file.previewUrl) }, [file])

  useEffect(() => {
    const el = textRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = text ? `${Math.min(el.scrollHeight, 200)}px` : ''
  }, [text])

  const canPost = (text.trim().length > 0 || !!file) && !busy
  const asBand = asBandId ? bands.find(b => b.id === asBandId) ?? null : null
  const expanded = focused || text.length > 0 || !!file

  async function submit() {
    if (!canPost) return
    setBusy(true)
    try {
      let imageUrl: string | null = null
      if (file) imageUrl = await uploadImage(supabase, currentUser.id, file.file, 'posts')
      const id = await createPost(supabase, { author_id: currentUser.id, band_id: asBandId, content: text.trim(), image_url: imageUrl })
      setText('')
      setFile(null)
      setFocused(false)
      onPosted?.(id)
    } catch (err) {
      toast(getErrorMessage(err, 'Could not publish post'), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl p-4" style={{ background: 'rgba(10,10,10,0.92)', border: '1px solid rgba(240,239,235,0.08)' }}>
      <div className="flex items-start gap-3">
        {asBand ? (
          <Avatar src={asBand.avatar_url} alt={asBand.name} size={40} shape="rounded" radius={12}
            border="1.5px solid rgba(255,92,0,0.35)" background="rgba(255,92,0,0.10)">
            <span className="text-base">🎸</span>
          </Avatar>
        ) : (
          <Avatar src={currentUser.avatar_url} alt={currentUser.display_name ?? 'You'} size={40} border="1.5px solid rgba(240,239,235,0.12)">
            <span style={{ fontFamily: 'var(--font-bebas)', fontSize: 14, color: 'rgba(240,239,235,0.5)' }}>
              {(currentUser.display_name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
            </span>
          </Avatar>
        )}
        <div className="min-w-0 flex-1">
          <textarea
            ref={textRef}
            value={text}
            onChange={e => setText(e.target.value.slice(0, MAX_LEN))}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={placeholder ?? (asBand ? `Post as ${asBand.name}…` : "What are you working on?")}
            rows={1}
            className="w-full resize-none bg-transparent py-2 text-[15px] text-[#F0EFEB] placeholder-[rgba(240,239,235,0.3)] outline-none"
            style={{ maxHeight: 200 }}
          />

          {file && (
            <div className="relative mt-2 inline-block">
              <Image src={file.previewUrl} alt="" width={160} height={160} unoptimized
                style={{ width: 'auto', height: 140, maxWidth: '100%', borderRadius: 12, objectFit: 'cover' }} />
              <button type="button" onClick={() => setFile(null)}
                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full text-black"
                style={{ background: '#F0EFEB', fontSize: 14, lineHeight: 1 }} aria-label="Remove photo">×</button>
            </div>
          )}

          {(expanded || lockBand) && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {!lockBand && bands.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-[rgba(240,239,235,0.3)]">Post as</span>
                  <button type="button" onClick={() => setAsBandId(null)}
                    className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors"
                    style={asBandId === null
                      ? { background: '#FF5500', color: '#000' }
                      : { background: 'rgba(255,255,255,0.06)', color: 'rgba(240,239,235,0.7)', border: '1px solid rgba(255,255,255,0.10)' }}>
                    Me
                  </button>
                  {bands.map(b => (
                    <button key={b.id} type="button" onClick={() => setAsBandId(b.id)}
                      className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors"
                      style={asBandId === b.id
                        ? { background: '#FF5500', color: '#000' }
                        : { background: 'rgba(255,255,255,0.06)', color: 'rgba(240,239,235,0.7)', border: '1px solid rgba(255,255,255,0.10)' }}>
                      🎸 {b.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="ml-auto flex items-center gap-2">
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) setFile({ file: f, previewUrl: URL.createObjectURL(f) }); e.currentTarget.value = '' }} />
                <button type="button" onClick={() => fileRef.current?.click()} disabled={!!file || busy}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-[rgba(240,239,235,0.5)] hover:text-[#F0EFEB] disabled:opacity-40"
                  style={{ background: 'rgba(255,255,255,0.06)' }} aria-label="Add photo">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
                  </svg>
                </button>
                <button type="button" onClick={() => void submit()} disabled={!canPost}
                  className="h-9 rounded-full px-4 text-[13px] font-semibold text-black shadow-[0_0_12px_rgba(255,85,0,0.3)] transition-opacity disabled:opacity-40"
                  style={{ background: '#FF5500' }}>
                  {busy ? 'Posting…' : 'Post'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
