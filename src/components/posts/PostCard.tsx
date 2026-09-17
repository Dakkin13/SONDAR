'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/components/ui/Avatar'
import ImageLightbox from '@/components/chat/ImageLightbox'
import { useToast } from '@/components/ui/Toast'
import { renderMessageText } from '@/lib/chat/text'
import { formatTimeAgo } from '@/lib/chat/time'
import { getErrorMessage } from '@/lib/utils'
import {
  addComment, deleteComment, deletePost, fetchComments, setPostLiked,
  type FeedComment, type FeedPost,
} from '@/lib/data/posts'

interface PostCardProps {
  post: FeedPost
  currentUserId: string
  /** Band admins can delete band posts even if they didn't write them. */
  canModerate?: boolean
  onDeleted?: (id: string) => void
}

function initialsOf(name: string | null | undefined): string {
  return (name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

export default function PostCard({ post, currentUserId, canModerate, onDeleted }: PostCardProps) {
  const supabase = createClient()
  const { toast } = useToast()

  const [liked, setLiked] = useState(post.likedByMe)
  const [likeCount, setLikeCount] = useState(post.likeCount)
  const [commentCount, setCommentCount] = useState(post.commentCount)
  const [likeBurst, setLikeBurst] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [comments, setComments] = useState<FeedComment[] | null>(null)
  const [commentText, setCommentText] = useState('')
  const [posting, setPosting] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleted, setDeleted] = useState(false)

  const isBandPost = post.band !== null
  const canDelete = post.author_id === currentUserId || (isBandPost && !!canModerate)
  const authorFirst = post.author.display_name?.split(' ')[0] ?? 'someone'

  async function toggleLike() {
    const next = !liked
    setLiked(next)
    setLikeCount(c => c + (next ? 1 : -1))
    if (next) { setLikeBurst(true); setTimeout(() => setLikeBurst(false), 600) }
    try {
      await setPostLiked(supabase, post.id, currentUserId, next)
    } catch (err) {
      setLiked(!next)
      setLikeCount(c => c + (next ? -1 : 1))
      toast(getErrorMessage(err, 'Could not like post'), 'error')
    }
  }

  async function openComments() {
    const opening = !commentsOpen
    setCommentsOpen(opening)
    if (opening && comments === null) {
      try {
        setComments(await fetchComments(supabase, post.id))
      } catch (err) {
        toast(getErrorMessage(err, 'Could not load comments'), 'error')
      }
    }
  }

  async function submitComment() {
    const content = commentText.trim()
    if (!content || posting) return
    setPosting(true)
    try {
      const id = await addComment(supabase, post.id, currentUserId, content)
      const { data: me } = await supabase.from('profiles').select('id, display_name, avatar_url').eq('id', currentUserId).single()
      setComments(prev => [...(prev ?? []), {
        id, post_id: post.id, author_id: currentUserId, content, created_at: new Date().toISOString(),
        author: me ?? { id: currentUserId, display_name: null, avatar_url: null },
      }])
      setCommentCount(c => c + 1)
      setCommentText('')
    } catch (err) {
      toast(getErrorMessage(err, 'Could not post comment'), 'error')
    } finally {
      setPosting(false)
    }
  }

  async function removeComment(id: string) {
    const snapshot = comments
    setComments(prev => (prev ?? []).filter(c => c.id !== id))
    setCommentCount(c => Math.max(0, c - 1))
    try {
      await deleteComment(supabase, id)
    } catch (err) {
      setComments(snapshot)
      setCommentCount(c => c + 1)
      toast(getErrorMessage(err, 'Could not delete comment'), 'error')
    }
  }

  async function removePost() {
    setMenuOpen(false)
    if (!confirm('Delete this post?')) return
    setDeleted(true)
    try {
      await deletePost(supabase, post.id)
      onDeleted?.(post.id)
    } catch (err) {
      setDeleted(false)
      toast(getErrorMessage(err, 'Could not delete post'), 'error')
    }
  }

  if (deleted) return null

  return (
    <article
      className="overflow-hidden rounded-2xl"
      style={{ background: 'rgba(10,10,10,0.92)', border: '1px solid rgba(240,239,235,0.08)' }}
    >
      <ImageLightbox url={lightbox} onClose={() => setLightbox(null)} />

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-3.5 pb-2">
        {isBandPost ? (
          <Link href={`/bands/${post.band!.id}`} className="flex-shrink-0">
            <Avatar src={post.band!.avatar_url} alt={post.band!.name} size={40} shape="rounded" radius={12}
              border="1.5px solid rgba(255,92,0,0.35)" background="rgba(255,92,0,0.10)">
              <span className="text-base">🎸</span>
            </Avatar>
          </Link>
        ) : (
          <Link href={`/profile/${post.author.id}`} className="flex-shrink-0">
            <Avatar src={post.author.avatar_url} alt={post.author.display_name ?? ''} size={40}
              border="1.5px solid rgba(240,239,235,0.12)">
              <span style={{ fontFamily: 'var(--font-bebas)', fontSize: 14, color: 'rgba(240,239,235,0.5)' }}>
                {initialsOf(post.author.display_name)}
              </span>
            </Avatar>
          </Link>
        )}
        <div className="min-w-0 flex-1">
          {isBandPost ? (
            <>
              <Link href={`/bands/${post.band!.id}`} className="block truncate text-[14px] font-semibold text-[#F0EFEB]">
                {post.band!.name}
                <span className="ml-1.5 rounded-full px-1.5 py-0.5 align-middle text-[8px] font-bold tracking-[0.12em]"
                  style={{ background: 'rgba(255,92,0,0.15)', color: '#FF5C00' }}>BAND</span>
              </Link>
              <p className="truncate text-[11px] text-[rgba(240,239,235,0.35)]">
                by <Link href={`/profile/${post.author.id}`} className="hover:text-[#F0EFEB]">{authorFirst}</Link> · {formatTimeAgo(post.created_at)}
              </p>
            </>
          ) : (
            <>
              <Link href={`/profile/${post.author.id}`} className="block truncate text-[14px] font-semibold text-[#F0EFEB]">
                {post.author.display_name ?? 'Unknown musician'}
              </Link>
              <p className="text-[11px] text-[rgba(240,239,235,0.35)]">{formatTimeAgo(post.created_at)}</p>
            </>
          )}
        </div>
        {canDelete && (
          <div className="relative flex-shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen(v => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[rgba(240,239,235,0.45)] hover:text-[#F0EFEB]"
              style={{ fontSize: 18, lineHeight: 1 }}
              aria-label="Post options"
            >
              ⋯
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  className="absolute right-0 top-9 z-20 overflow-hidden rounded-xl"
                  style={{ background: 'rgb(22,22,22)', border: '1px solid rgba(255,255,255,0.10)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', minWidth: 150 }}
                >
                  <button type="button" onClick={() => void removePost()}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-[13px]" style={{ color: '#ef4444' }}>
                    🗑️ Delete post
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Body */}
      {post.content && (
        <p className="whitespace-pre-wrap break-words px-4 pb-3 text-[14px] leading-relaxed text-[rgba(240,239,235,0.88)]">
          {renderMessageText(post.content)}
        </p>
      )}
      {post.image_url && (
        <button type="button" onClick={() => setLightbox(post.image_url)} className="relative block w-full" aria-label="Open photo"
          onDoubleClick={() => { if (!liked) void toggleLike() }}>
          <Image
            src={post.image_url}
            alt=""
            width={1200}
            height={900}
            sizes="(max-width: 768px) 100vw, 640px"
            style={{ width: '100%', height: 'auto', maxHeight: 520, objectFit: 'cover', display: 'block' }}
          />
          <AnimatePresence>
            {likeBurst && (
              <motion.span
                initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1.3, 1.1, 1.4] }} exit={{ opacity: 0 }}
                transition={{ duration: 0.6 }}
                className="pointer-events-none absolute inset-0 flex items-center justify-center text-7xl"
              >
                ❤️
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 px-4 py-2.5" style={{ borderTop: '1px solid rgba(240,239,235,0.06)' }}>
        <button
          type="button"
          onClick={() => void toggleLike()}
          className="flex h-9 items-center gap-1.5 rounded-full px-2 text-[13px] transition-transform active:scale-90"
          style={{ color: liked ? '#FF5C00' : 'rgba(240,239,235,0.6)' }}
          aria-label={liked ? 'Unlike' : 'Like'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill={liked ? '#FF5C00' : 'none'} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          {likeCount > 0 && <span className="font-medium">{likeCount}</span>}
        </button>
        <button
          type="button"
          onClick={() => void openComments()}
          className="flex h-9 items-center gap-1.5 rounded-full px-2 text-[13px] text-[rgba(240,239,235,0.6)] transition-colors hover:text-[#F0EFEB]"
          aria-label="Comments"
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {commentCount > 0 && <span className="font-medium">{commentCount}</span>}
        </button>
      </div>

      {/* Comments */}
      <AnimatePresence initial={false}>
        {commentsOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
            style={{ borderTop: '1px solid rgba(240,239,235,0.06)' }}
          >
            <div className="px-4 py-3">
              {comments === null ? (
                <div className="flex justify-center py-3">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-[rgba(240,239,235,0.12)] border-t-[#FF5500]" />
                </div>
              ) : comments.length === 0 ? (
                <p className="pb-2 text-center text-[12px] text-[rgba(240,239,235,0.3)]">No comments yet — be the first.</p>
              ) : (
                <div className="flex flex-col gap-3 pb-3">
                  {comments.map(c => (
                    <div key={c.id} className="flex items-start gap-2.5">
                      <Link href={`/profile/${c.author.id}`} className="flex-shrink-0 pt-0.5">
                        <Avatar src={c.author.avatar_url} alt={c.author.display_name ?? ''} size={28}>
                          <span style={{ fontFamily: 'var(--font-bebas)', fontSize: 11, color: 'rgba(240,239,235,0.5)' }}>
                            {initialsOf(c.author.display_name)}
                          </span>
                        </Avatar>
                      </Link>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] leading-snug text-[rgba(240,239,235,0.85)]">
                          <Link href={`/profile/${c.author.id}`} className="mr-1.5 font-semibold text-[#F0EFEB]">
                            {c.author.display_name ?? 'Unknown'}
                          </Link>
                          {renderMessageText(c.content)}
                        </p>
                        <div className="mt-0.5 flex items-center gap-3 text-[10px] text-[rgba(240,239,235,0.3)]">
                          <span>{formatTimeAgo(c.created_at)}</span>
                          {(c.author_id === currentUserId || canDelete) && (
                            <button type="button" onClick={() => void removeComment(c.id)} className="hover:text-[rgba(255,100,100,0.8)]">
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-2">
                <textarea
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submitComment() } }}
                  placeholder="Add a comment…"
                  rows={1}
                  className="flex-1 resize-none rounded-2xl px-3.5 py-2 text-[13px] text-[#F0EFEB] placeholder-[rgba(240,239,235,0.25)] outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
                />
                <button
                  type="button"
                  onClick={() => void submitComment()}
                  disabled={!commentText.trim() || posting}
                  className="h-9 rounded-full px-3.5 text-[12px] font-semibold text-black disabled:opacity-40"
                  style={{ background: '#FF5500' }}
                >
                  Post
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  )
}
