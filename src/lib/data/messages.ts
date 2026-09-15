import type { SupabaseClient } from '@supabase/supabase-js'

export interface UnreadCounts {
  dm: number
  bands: number
  total: number
}

// One definition of "unread" shared by the inbox, the notification bell,
// and anything else that shows a badge, so the numbers always agree:
// DMs addressed to me with no read_at, plus band messages from other
// members whose read_by doesn't include me.
export async function fetchUnreadCounts(supabase: SupabaseClient, userId: string): Promise<UnreadCounts> {
  const [{ count: dmCount }, { data: memberships }] = await Promise.all([
    supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('to_id', userId)
      .is('read_at', null),
    supabase.from('band_members').select('band_id').eq('user_id', userId),
  ])

  const bandIds = (memberships ?? []).map((m) => m.band_id as string)
  let bands = 0
  if (bandIds.length > 0) {
    const { data: bandMsgs } = await supabase
      .from('band_messages')
      .select('from_id, read_by')
      .in('band_id', bandIds)
    bands = (bandMsgs ?? []).filter(
      (m) => m.from_id !== userId && !((m.read_by as string[] | null) ?? []).includes(userId),
    ).length
  }

  const dm = dmCount ?? 0
  return { dm, bands, total: dm + bands }
}

// Marks every band message the user hasn't read as read. Done client-side
// per row (array append computed here) because supabase-js can't express
// array_append in an update.
export async function markBandMessagesRead(
  supabase: SupabaseClient,
  userId: string,
  rows: { id: string; from_id: string; read_by: string[] | null }[],
): Promise<void> {
  const pending = rows.filter((m) => m.from_id !== userId && !(m.read_by ?? []).includes(userId))
  await Promise.all(
    pending.map((m) =>
      supabase.from('band_messages').update({ read_by: [...(m.read_by ?? []), userId] }).eq('id', m.id),
    ),
  )
}
