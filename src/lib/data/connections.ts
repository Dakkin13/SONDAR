import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProfileSummary } from '@/types'

// People the user has a DM thread with. This is the v1 definition of a
// "connection" — the only pool you can add band members from, since the
// app has no user search. Optionally excludes ids (e.g. existing members).
export async function fetchConnections(
  supabase: SupabaseClient,
  userId: string,
  options: { exclude?: Iterable<string> } = {},
): Promise<ProfileSummary[]> {
  const { data: msgs } = await supabase
    .from('messages')
    .select('from_id, to_id')
    .or(`from_id.eq.${userId},to_id.eq.${userId}`)

  const partnerIds = new Set<string>()
  for (const m of msgs ?? []) {
    partnerIds.add(m.from_id === userId ? m.to_id : m.from_id)
  }
  for (const id of options.exclude ?? []) partnerIds.delete(id)

  if (partnerIds.size === 0) return []

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', Array.from(partnerIds))

  return (profiles ?? []) as ProfileSummary[]
}
