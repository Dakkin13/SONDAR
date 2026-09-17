'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import PostCard from './PostCard'
import { fetchPosts, type FeedPost, type FeedScope } from '@/lib/data/posts'

interface PostFeedProps {
  scope: FeedScope
  currentUserId: string
  /** Bump to refetch (e.g. after the composer publishes). */
  refreshKey?: number
  pageSize?: number
  /** Show at most this many and no "load more" (home tab teaser). */
  max?: number
  canModerate?: boolean
  emptyText?: string
}

export default function PostFeed({
  scope, currentUserId, refreshKey = 0, pageSize = 15, max, canModerate, emptyText = 'No posts yet.',
}: PostFeedProps) {
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [exhausted, setExhausted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const limit = max ?? pageSize
  const scopeKey = JSON.stringify(scope)

  // The fetch lives inside the effect (async, so no synchronous setState):
  // the first render already shows the spinner, and a refetch (refreshKey
  // bump) keeps the current list until the new rows land.
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const rows = await fetchPosts(createClient(), currentUserId, scope, { limit })
        if (cancelled) return
        setPosts(rows)
        setExhausted(rows.length < limit)
        setError(null)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load posts')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [currentUserId, scopeKey, limit, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadMore() {
    const last = posts[posts.length - 1]
    if (!last || loadingMore) return
    setLoadingMore(true)
    try {
      const rows = await fetchPosts(createClient(), currentUserId, scope, { limit: pageSize, before: last.created_at })
      setPosts(prev => [...prev, ...rows])
      setExhausted(rows.length < pageSize)
    } finally {
      setLoadingMore(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[rgba(240,239,235,0.12)] border-t-[#FF5500]" />
      </div>
    )
  }

  if (error) {
    return <p className="py-6 text-center text-[12px] text-[rgba(255,120,120,0.8)]">{error}</p>
  }

  if (posts.length === 0) {
    return <p className="py-8 text-center text-[13px] text-[rgba(240,239,235,0.3)]">{emptyText}</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {posts.map(p => (
        <PostCard key={p.id} post={p} currentUserId={currentUserId} canModerate={canModerate}
          onDeleted={id => setPosts(prev => prev.filter(x => x.id !== id))} />
      ))}
      {!max && !exhausted && (
        <button
          type="button"
          onClick={() => void loadMore()}
          disabled={loadingMore}
          className="mx-auto mt-2 rounded-full border px-6 py-2.5 text-[11px] font-medium tracking-[0.10em] disabled:opacity-50"
          style={{ borderColor: 'rgba(255,92,0,0.35)', background: 'rgba(255,92,0,0.07)', color: '#FF5C00', fontFamily: 'var(--font-bebas)', fontSize: 13 }}
        >
          {loadingMore ? 'LOADING…' : 'LOAD MORE'}
        </button>
      )}
    </div>
  )
}
