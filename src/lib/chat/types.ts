// Shared message shapes for the 1:1 and band chat surfaces.
// Platform-agnostic: no React, no Next — reusable from a native client.

/** emoji → user ids who reacted with it */
export type Reactions = Record<string, string[]>

export interface ChatMessageBase {
  id: string
  created_at: string
  from_id: string
  content: string
  reactions: Reactions
  reply_to: string | null
  image_url: string | null
  deleted_at: string | null
  edited_at: string | null
}

export interface DmMessage extends ChatMessageBase {
  to_id: string
  read_at: string | null
}

export interface BandChatMessage extends ChatMessageBase {
  band_id: string
  read_by: string[]
}

// Normalizes a raw row from Supabase (history or a realtime payload) so the
// UI can rely on every optional column being present. Also reads the legacy
// liked_by column as ❤️ reactions until the chat_features migration has run
// and copied likes into `reactions` — nothing disappears in between.
export function normalizeMessageRow<T extends ChatMessageBase>(row: Record<string, unknown>): T {
  const reactions = normalizeReactions(row.reactions, row.liked_by)
  return {
    ...row,
    content: typeof row.content === 'string' ? row.content : '',
    reactions,
    reply_to: (row.reply_to as string | null | undefined) ?? null,
    image_url: (row.image_url as string | null | undefined) ?? null,
    deleted_at: (row.deleted_at as string | null | undefined) ?? null,
    edited_at: (row.edited_at as string | null | undefined) ?? null,
  } as T
}

function normalizeReactions(reactions: unknown, likedBy: unknown): Reactions {
  const out: Reactions = {}
  if (reactions && typeof reactions === 'object' && !Array.isArray(reactions)) {
    for (const [emoji, ids] of Object.entries(reactions as Record<string, unknown>)) {
      if (Array.isArray(ids) && ids.length > 0) out[emoji] = ids.filter((id): id is string => typeof id === 'string')
    }
  }
  if (Object.keys(out).length === 0 && Array.isArray(likedBy) && likedBy.length > 0) {
    out['❤️'] = likedBy.filter((id): id is string => typeof id === 'string')
  }
  return out
}

// Insert or replace a message keeping the list ordered by created_at. Realtime
// events can arrive out of order and an optimistic temp row may already be in
// the list, so callers pass the temp id to drop when the real row lands.
export function upsertMessage<T extends ChatMessageBase>(list: T[], msg: T, replaceTempId?: string): T[] {
  const withoutTemp = replaceTempId ? list.filter((m) => m.id !== replaceTempId) : list
  const idx = withoutTemp.findIndex((m) => m.id === msg.id)
  if (idx !== -1) {
    const next = withoutTemp.slice()
    next[idx] = { ...withoutTemp[idx], ...msg }
    return next
  }
  const next = withoutTemp.slice()
  const t = new Date(msg.created_at).getTime()
  let i = next.length
  while (i > 0 && new Date(next[i - 1].created_at).getTime() > t) i--
  next.splice(i, 0, msg)
  return next
}

export function isTempId(id: string): boolean {
  return id.startsWith('temp-')
}

// One-line preview for inbox rows and the notification bell.
export function messagePreview(row: {
  content?: string | null
  image_url?: string | null
  deleted_at?: string | null
}): string {
  if (row.deleted_at) return 'Message deleted'
  if (row.content) return row.content
  if (row.image_url) return '📷 Photo'
  return ''
}
