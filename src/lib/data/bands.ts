import type { SupabaseClient } from '@supabase/supabase-js'
import type { Band } from '@/types'

// Platform-agnostic data access — depends only on supabase-js and shared
// types, so it can be reused as-is from a React Native / Expo app.

export interface BandSummary {
  band: Pick<Band, 'id' | 'name' | 'avatar_url' | 'created_at'>
  memberCount: number
  lastMessage: { content: string; created_at: string; image_url: string | null; deleted_at: string | null } | null
  unreadCount: number
}

// Every band the user belongs to, with member count, latest message, and
// how many messages from other members they haven't read. Used by the
// home "Your bands" section, the /bands list, and the unified inbox.
export async function fetchBandSummaries(
  supabase: SupabaseClient,
  userId: string,
): Promise<BandSummary[]> {
  const { data: memberships } = await supabase
    .from('band_members')
    .select('band_id')
    .eq('user_id', userId)

  const bandIds = (memberships ?? []).map((m) => m.band_id as string)
  if (bandIds.length === 0) return []

  const [{ data: bands }, { data: allMembers }, { data: messages }] = await Promise.all([
    supabase.from('bands').select('id, name, avatar_url, created_at').in('id', bandIds),
    supabase.from('band_members').select('band_id').in('band_id', bandIds),
    // select('*') so this keeps working before the chat_features migration
    // adds image_url / deleted_at — they're just undefined until then.
    supabase
      .from('band_messages')
      .select('*')
      .in('band_id', bandIds)
      .order('created_at', { ascending: false }),
  ])

  const memberCount = new Map<string, number>()
  for (const m of allMembers ?? []) {
    memberCount.set(m.band_id, (memberCount.get(m.band_id) ?? 0) + 1)
  }

  const lastMessage = new Map<string, BandSummary['lastMessage']>()
  const unread = new Map<string, number>()
  for (const m of messages ?? []) {
    if (!lastMessage.has(m.band_id)) {
      lastMessage.set(m.band_id, {
        content: m.content ?? '',
        created_at: m.created_at,
        image_url: m.image_url ?? null,
        deleted_at: m.deleted_at ?? null,
      })
    }
    if (m.from_id !== userId && !((m.read_by as string[] | null) ?? []).includes(userId)) {
      unread.set(m.band_id, (unread.get(m.band_id) ?? 0) + 1)
    }
  }

  return (bands ?? []).map((b) => ({
    band: b as BandSummary['band'],
    memberCount: memberCount.get(b.id) ?? 1,
    lastMessage: lastMessage.get(b.id) ?? null,
    unreadCount: unread.get(b.id) ?? 0,
  }))
}
