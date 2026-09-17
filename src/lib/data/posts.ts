import type { SupabaseClient } from '@supabase/supabase-js'
import type { Post, PostComment, ProfileSummary } from '@/types'

// Platform-agnostic data access for posts, likes, comments, and band
// followers — supabase-js + shared types only.

export interface FeedPost extends Post {
  author: ProfileSummary
  band: { id: string; name: string; avatar_url: string | null } | null
  likeCount: number
  commentCount: number
  likedByMe: boolean
}

export interface FeedComment extends PostComment {
  author: ProfileSummary
  likeCount: number
  likedByMe: boolean
}

export type FeedScope =
  | { kind: 'global' }
  | { kind: 'author'; authorId: string }
  | { kind: 'band'; bandId: string }
  | { kind: 'following'; userId: string }

const POST_SELECT =
  '*, author:profiles!posts_author_id_fkey(id, display_name, avatar_url), band:bands(id, name, avatar_url), post_likes(count), post_comments(count)'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toFeedPost(row: any, likedIds: Set<string>): FeedPost {
  return {
    id: row.id,
    author_id: row.author_id,
    band_id: row.band_id ?? null,
    content: row.content ?? '',
    image_url: row.image_url ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    author: row.author ?? { id: row.author_id, display_name: null, avatar_url: null },
    band: row.band ?? null,
    likeCount: row.post_likes?.[0]?.count ?? 0,
    commentCount: row.post_comments?.[0]?.count ?? 0,
    likedByMe: likedIds.has(row.id),
  }
}

export async function fetchPosts(
  supabase: SupabaseClient,
  userId: string,
  scope: FeedScope,
  options: { limit?: number; before?: string } = {},
): Promise<FeedPost[]> {
  const limit = options.limit ?? 20
  let query = supabase.from('posts').select(POST_SELECT).order('created_at', { ascending: false }).limit(limit)

  if (scope.kind === 'author') query = query.eq('author_id', scope.authorId).is('band_id', null)
  if (scope.kind === 'band') query = query.eq('band_id', scope.bandId)
  if (scope.kind === 'following') {
    const { data: follows } = await supabase.from('band_followers').select('band_id').eq('user_id', scope.userId)
    const ids = (follows ?? []).map((f) => f.band_id as string)
    if (ids.length === 0) return []
    query = query.in('band_id', ids)
  }
  if (options.before) query = query.lt('created_at', options.before)

  const { data, error } = await query
  if (error) throw error
  const rows = data ?? []
  if (rows.length === 0) return []

  const { data: myLikes } = await supabase
    .from('post_likes')
    .select('post_id')
    .eq('user_id', userId)
    .in('post_id', rows.map((r) => r.id))
  const likedIds = new Set((myLikes ?? []).map((l) => l.post_id as string))

  return rows.map((r) => toFeedPost(r, likedIds))
}

export async function fetchPost(supabase: SupabaseClient, userId: string, postId: string): Promise<FeedPost | null> {
  const { data } = await supabase.from('posts').select(POST_SELECT).eq('id', postId).single()
  if (!data) return null
  const { data: like } = await supabase.from('post_likes').select('post_id').eq('user_id', userId).eq('post_id', postId).maybeSingle()
  return toFeedPost(data, new Set(like ? [postId] : []))
}

export async function createPost(
  supabase: SupabaseClient,
  input: { author_id: string; band_id?: string | null; content: string; image_url?: string | null },
): Promise<string> {
  const id = crypto.randomUUID()
  const { error } = await supabase.from('posts').insert({
    id,
    author_id: input.author_id,
    band_id: input.band_id ?? null,
    content: input.content,
    image_url: input.image_url ?? null,
  })
  if (error) throw error
  return id
}

export async function deletePost(supabase: SupabaseClient, postId: string): Promise<void> {
  const { error } = await supabase.from('posts').delete().eq('id', postId)
  if (error) throw error
}

export async function setPostLiked(supabase: SupabaseClient, postId: string, userId: string, liked: boolean): Promise<void> {
  const { error } = liked
    ? await supabase.from('post_likes').upsert({ post_id: postId, user_id: userId }, { onConflict: 'post_id,user_id' })
    : await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId)
  if (error) throw error
}

// Flat list (top-level comments and replies mixed, oldest first) with like
// counts and whether the viewer liked each one. The UI groups replies under
// their parent.
export async function fetchComments(supabase: SupabaseClient, postId: string, userId: string): Promise<FeedComment[]> {
  const { data, error } = await supabase
    .from('post_comments')
    .select('*, author:profiles!post_comments_author_id_fkey(id, display_name, avatar_url), post_comment_likes(count)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
  if (error) throw error

  const ids = (data ?? []).map((c) => c.id as string)
  let likedIds = new Set<string>()
  if (ids.length > 0) {
    const { data: mine } = await supabase
      .from('post_comment_likes').select('comment_id').eq('user_id', userId).in('comment_id', ids)
    likedIds = new Set((mine ?? []).map((l) => l.comment_id as string))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((c: any) => ({
    id: c.id, post_id: c.post_id, author_id: c.author_id, parent_id: c.parent_id ?? null,
    content: c.content, created_at: c.created_at,
    author: c.author ?? { id: c.author_id, display_name: null, avatar_url: null },
    likeCount: c.post_comment_likes?.[0]?.count ?? 0,
    likedByMe: likedIds.has(c.id),
  }))
}

export async function addComment(
  supabase: SupabaseClient,
  input: { postId: string; authorId: string; content: string; parentId?: string | null },
): Promise<string> {
  const id = crypto.randomUUID()
  const { error } = await supabase.from('post_comments').insert({
    id, post_id: input.postId, author_id: input.authorId, content: input.content, parent_id: input.parentId ?? null,
  })
  if (error) throw error
  return id
}

export async function setCommentLiked(supabase: SupabaseClient, commentId: string, userId: string, liked: boolean): Promise<void> {
  const { error } = liked
    ? await supabase.from('post_comment_likes').upsert({ comment_id: commentId, user_id: userId }, { onConflict: 'comment_id,user_id' })
    : await supabase.from('post_comment_likes').delete().eq('comment_id', commentId).eq('user_id', userId)
  if (error) throw error
}

export async function deleteComment(supabase: SupabaseClient, commentId: string): Promise<void> {
  const { error } = await supabase.from('post_comments').delete().eq('id', commentId)
  if (error) throw error
}

// ── Band followers ───────────────────────────────────────────────────────────

export interface FollowState {
  count: number
  following: boolean
}

export async function fetchFollowState(supabase: SupabaseClient, bandId: string, userId: string): Promise<FollowState> {
  const [{ count }, { data: mine }] = await Promise.all([
    supabase.from('band_followers').select('user_id', { count: 'exact', head: true }).eq('band_id', bandId),
    supabase.from('band_followers').select('band_id').eq('band_id', bandId).eq('user_id', userId).maybeSingle(),
  ])
  return { count: count ?? 0, following: Boolean(mine) }
}

export async function setFollowing(supabase: SupabaseClient, bandId: string, userId: string, follow: boolean): Promise<void> {
  const { error } = follow
    ? await supabase.from('band_followers').upsert({ band_id: bandId, user_id: userId }, { onConflict: 'band_id,user_id' })
    : await supabase.from('band_followers').delete().eq('band_id', bandId).eq('user_id', userId)
  if (error) throw error
}

// Bands the user can post as (any band they belong to).
export async function fetchPostableBands(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ id: string; name: string; avatar_url: string | null }[]> {
  const { data: memberships } = await supabase.from('band_members').select('band_id').eq('user_id', userId)
  const ids = (memberships ?? []).map((m) => m.band_id as string)
  if (ids.length === 0) return []
  const { data } = await supabase.from('bands').select('id, name, avatar_url').in('id', ids).order('name')
  return (data ?? []) as { id: string; name: string; avatar_url: string | null }[]
}
