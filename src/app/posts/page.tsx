'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/ui/BottomNav'
import PostComposer from '@/components/posts/PostComposer'
import PostFeed from '@/components/posts/PostFeed'
import type { ProfileSummary } from '@/types'

type Tab = 'all' | 'following'

export default function PostsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [me, setMe] = useState<ProfileSummary | null>(null)
  const [tab, setTab] = useState<Tab>('all')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase.from('profiles').select('id, display_name, avatar_url').eq('id', user.id).single()
      setMe(data ?? { id: user.id, display_name: null, avatar_url: null })
    }
    void load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ minHeight: '100dvh' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-10 px-4 py-4"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
          background: 'rgba(13,13,13,0.92)',
          backdropFilter: 'blur(48px) saturate(180%)',
          WebkitBackdropFilter: 'blur(48px) saturate(180%)',
          borderBottom: '0.5px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="mx-auto max-w-lg md:max-w-2xl flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[#F0EFEB]" style={{ fontFamily: 'var(--font-bebas)', fontSize: 28, letterSpacing: '0.08em' }}>
              POSTS
            </h1>
            <p className="text-[11px] text-[rgba(240,239,235,0.3)]">What musicians and bands are up to</p>
          </div>
          <Link
            href="/home"
            className="rounded-xl border border-[rgba(240,239,235,0.10)] bg-[rgba(240,239,235,0.05)] px-3 py-2 text-sm font-medium text-[rgba(240,239,235,0.55)] backdrop-blur-md transition-colors hover:border-[rgba(240,239,235,0.25)] hover:text-[#F0EFEB]"
          >
            ← Home
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-lg md:max-w-2xl px-4 pt-4 pb-24">
        {!me ? (
          <div className="flex items-center justify-center py-24">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[rgba(240,239,235,0.12)] border-t-[#FF5500]" />
          </div>
        ) : (
          <>
            <PostComposer currentUser={me} onPosted={() => { setTab('all'); setRefreshKey(k => k + 1) }} />

            <div className="mt-5 mb-3 flex items-center gap-1 rounded-full p-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              {([['all', 'Everyone'], ['following', 'Bands you follow']] as [Tab, string][]).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className="flex-1 rounded-full py-2 text-[12px] font-semibold transition-colors"
                  style={tab === key
                    ? { background: 'rgba(255,92,0,0.15)', color: '#FF5C00' }
                    : { color: 'rgba(240,239,235,0.45)' }}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === 'all' ? (
              <PostFeed
                scope={{ kind: 'global' }}
                currentUserId={me.id}
                refreshKey={refreshKey}
                emptyText="Nothing here yet — be the first to post."
              />
            ) : (
              <PostFeed
                scope={{ kind: 'following', userId: me.id }}
                currentUserId={me.id}
                refreshKey={refreshKey}
                emptyText="Follow a band to see its posts here."
              />
            )}
          </>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
