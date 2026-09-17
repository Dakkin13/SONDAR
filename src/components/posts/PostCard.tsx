'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/components/ui/Avatar'
import ImageLightbox from '@/components/chat/ImageLightbox'
import { useToast } from '@/components/ui/Toast'
import { ActionSheet, ConfirmSheet, type SheetAction } from '@/components/ui/ActionSheet'
import { renderMessageText } from '@/lib/chat/text'
import { formatTimeAgo } from '@/lib/chat/time'
import { getErrorMessage } from '@/lib/utils'
import {
  addComment, deleteComment, deletePost, fetchComments, setCommentLiked, setPostLiked,
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

interface ReplyTarget {
  /** The top-level comment replies nest under (one level deep, like Instagram). */
  rootId: string
  name: string
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
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null)
  const [posting, setPosting] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set())
  const [commentMenu, setCommentMenu] = useState<FeedComment | null>(null)
  const [confirmDeletePost, setConfirmDeletePost] = useState(false)
  const [confirmDeleteComment, setConfirmDeleteComment] = useState<FeedComment | null>(null)

  const isBandPost = post.band !== null
  const canDeletePost = post.author_id === currentUserId || (isBandPost && !!canModerate)
  const authorFirst = post.author.display_name?.split(' ')[0] ?? 'someone'

  // Flat list -> top-level comments + replies grouped under their parent,
  // one level deep (a reply to a reply still nests under the original
  // top-level comment, same as Instagram).
  const { roots, repliesByParent } = useMemo(() => {
    const roots: FeedComment[] = []
    const repliesByParent = new Map<string, FeedComment[]>()
    for (const c of comments ?? []) {
      if (c.parent_id) {
        const list = repliesByParent.get(c.parent_id) ?? []
        list.push(c)
        repliesByParent.set(c.parent_id, list)
      } else {
        roots.push(c)
      }
    }
    return { roots, repliesByParent }
  }, [comments])

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
        setComments(await fetchComments(supabase, post.id, currentUserId))
      } catch (err) {
        toast(getErrorMessage(err, 'Could not load comments'), 'error')
      }
    }
  }

  function startReply(c: FeedComment) {
    setReplyTo({ rootId: c.parent_id ?? c.id, name: c.author.display_name ?? 'them' })
    if (c.parent_id) setExpandedReplies(prev => new Set(prev).add(c.parent_id!))
  }

  async function submitComment() {
    const content = commentText.trim()
    if (!content || posting) return
    setPosting(true)
    try {
      const id = await addComment(supabase, { postId: post.id, authorId: currentUserId, content, parentId: replyTo?.rootId ?? null })
      const { data: me } = await supabase.from('profiles').select('id, display_name, avatar_url').eq('id', currentUserId).single()
      setComments(prev => [...(prev ?? []), {
        id, post_id: post.id, author_id: currentUserId, parent_id: replyTo?.rootId ?? null,
        content, created_at: new Date().toISOString(),
        author: me ?? { id: currentUserId, display_name: null, avatar_url: null },
        likeCount: 0, likedByMe: false,
      }])
      setCommentCount(c => c + 1)
      setCommentText('')
      setReplyTo(null)
    } catch (err) {
      toast(getErrorMessage(err, 'Could not post comment'), 'error')
    } finally {
      setPosting(false)
    }
  }

  async function removeComment(c: FeedComment) {
    const snapshot = comments
    const removedCount = 1 + (c.parent_id ? 0 : (repliesByParent.get(c.id)?.length ?? 0))
    setComments(prev => (prev ?? []).filter(x => x.id !== c.id && x.parent_id !== c.id))
    setCommentCount(n => Math.max(0, n - removedCount))
    try {
      await deleteComment(supabase, c.id)
    } catch (err) {
      setComments(snapshot)
      setCommentCount(n => n + removedCount)
      toast(getErrorMessage(err, 'Could not delete comment'), 'error')
    }
  }

  async function toggleCommentLike(c: FeedComment) {
    const next = !c.likedByMe
    setComments(prev => (prev ?? []).map(x => x.id === c.id ? { ...x, likedByMe: next, likeCount: x.likeCount + (next ? 1 : -1) } : x))
    try {
      await setCommentLiked(supabase, c.id, currentUserId, next)
    } catch (err) {
      setComments(prev => (prev ?? []).map(x => x.id === c.id ? { ...x, likedByMe: !next, likeCount: x.likeCount + (next ? -1 : 1) } : x))
      toast(getErrorMessage(err, 'Could not like comment'), 'error')
    }
  }

  async function removePost() {
    setDeleted(true)
    try {
      await deletePost(supabase, post.id)
      onDeleted?.(post.id)
    } catch (err) {
      setDeleted(false)
      toast(getErrorMessage(err, 'Could not delete post'), 'error')
    }
  }

  function commentActions(c: FeedComment): SheetAction[] {
    const canDeleteThis = c.author_id === currentUserId || canDeletePost
    const actions: SheetAction[] = [
      { label: 'Reply', icon: '↩︎', onSelect: () => startReply(c) },
    ]
    if (canDeleteThis) {
      actions.push({ label: 'Delete', icon: '🗑️', destructive: true, onSelect: () => setConfirmDeleteComment(c) })
    }
    return actions
  }

  function CommentRow({ c, isReply }: { c: FeedComment; isReply?: boolean }) {
    const replies = repliesByParent.get(c.id) ?? []
    const expanded = expandedReplies.has(c.id)
    return (
      <div className={isReply ? 'flex items-start gap-2.5 pl-9' : 'flex items-start gap-2.5'}>
        <Link href={`/profile/${c.author.id}`} className="flex-shrink-0 pt-0.5">
          <Avatar src={c.author.avatar_url} alt={c.author.display_name ?? ''} size={isReply ? 24 : 28}>
            <span style={{ fontFamily: 'var(--font-bebas)', fontSize: isReply ? 10 : 11, color: 'rgba(240,239,235,0.5)' }}>
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
            {c.likeCount > 0 && <span>{c.likeCount} like{c.likeCount !== 1 ? 's' : ''}</span>}
            <button type="button" onClick={() => startReply(c)} className="font-semibold hover:text-[rgba(240,239,235,0.6)]">
              Reply
            </button>
          </div>
          {!isReply && replies.length > 0 && (
            <button
              type="button"
              onClick={() => setExpandedReplies(prev => {
                const next = new Set(prev)
                if (next.has(c.id)) next.delete(c.id); else next.add(c.id)
                return next
              })}
              className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-[rgba(240,239,235,0.35)] hover:text-[rgba(240,239,235,0.55)]"
            >
              <span style={{ width: 20, height: 1, background: 'rgba(240,239,235,0.2)' }} />
              {expanded ? 'Hide replies' : `View ${replies.length} repl${replies.length !== 1 ? 'ies' : 'y'}`}
            </button>
          )}
          {!isReply && expanded && (
            <div className="mt-2.5 flex flex-col gap-2.5">
              {replies.map(r => <CommentRow key={r.id} c={r} isReply />)}
            </div>
          )}
        </div>
        <div className="flex flex-shrink-0 flex-col items-center gap-1 pt-0.5">
          <button
            type="button"
            onClick={() => void toggleCommentLike(c)}
            className="transition-transform active:scale-90"
            aria-label={c.likedByMe ? 'Unlike comment' : 'Like comment'}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill={c.likedByMe ? '#FF5C00' : 'none'}
              stroke={c.likedByMe ? '#FF5C00' : 'rgba(240,239,235,0.35)'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setCommentMenu(c)}
            className="flex h-6 w-6 items-center justify-center text-[rgba(240,239,235,0.3)] hover:text-[rgba(240,239,235,0.6)]"
            style={{ fontSize: 14, lineHeight: 1 }}
            aria-label="Comment options"
          >
            ⋯
          </button>
        </div>
      </div>
    )
  }

  if (deleted) return null

  return (
    <article
      className="overflow-hidden rounded-2xl"
      style={{ background: 'rgba(10,10,10,0.92)', border: '1px solid rgba(240,239,235,0.08)' }}
    >
      <ImageLightbox url={lightbox} onClose={() => setLightbox(null)} />

      <ActionSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        actions={[{ label: 'Delete post', icon: '🗑️', destructive: true, onSelect: () => setConfirmDeletePost(true) }]}
      />
      <ConfirmSheet
        open={confirmDeletePost}
        title="Delete this post?"
        message="This can't be undone."
        onConfirm={() => void removePost()}
        onClose={() => setConfirmDeletePost(false)}
      />

      <ActionSheet
        open={commentMenu !== null}
        onClose={() => setCommentMenu(null)}
        actions={commentMenu ? commentActions(commentMenu) : []}
      />
      <ConfirmSheet
        open={confirmDeleteComment !== null}
        title="Delete this comment?"
        message={confirmDeleteComment?.parent_id ? undefined : "Its replies will be deleted too."}
        onConfirm={() => { if (confirmDeleteComment) void removeComment(confirmDeleteComment) }}
        onClose={() => setConfirmDeleteComment(null)}
      />

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
        {canDeletePost && (
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[rgba(240,239,235,0.45)] hover:text-[#F0EFEB]"
            style={{ fontSize: 18, lineHeight: 1 }}
            aria-label="Post options"
          >
            ⋯
          </button>
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
              ) : roots.length === 0 ? (
                <p className="pb-2 text-center text-[12px] text-[rgba(240,239,235,0.3)]">No comments yet — be the first.</p>
              ) : (
                <div className="flex flex-col gap-3 pb-3">
                  {roots.map(c => <CommentRow key={c.id} c={c} />)}
                </div>
              )}

              {replyTo && (
                <div className="mb-2 flex items-center justify-between rounded-lg px-2.5 py-1.5" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <span className="text-[11px] text-[rgba(240,239,235,0.45)]">
                    Replying to <span className="font-semibold text-[rgba(240,239,235,0.7)]">{replyTo.name}</span>
                  </span>
                  <button type="button" onClick={() => setReplyTo(null)} className="text-[rgba(240,239,235,0.4)] hover:text-[#F0EFEB]" aria-label="Cancel reply">
                    ×
                  </button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <textarea
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submitComment() } }}
                  placeholder={replyTo ? `Reply to ${replyTo.name}…` : 'Add a comment…'}
                  rows={1}
                  autoFocus={!!replyTo}
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
