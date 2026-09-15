import type { Reactions } from './types'

export const REACTION_EMOJIS = ['❤️', '😂', '🔥', '👍', '😮', '🎸'] as const

export function hasReacted(reactions: Reactions, emoji: string, userId: string): boolean {
  return (reactions[emoji] ?? []).includes(userId)
}

// Returns a new reactions map with the user's reaction toggled. Empty emoji
// buckets are dropped so the stored JSON stays tidy.
export function toggleReaction(reactions: Reactions, emoji: string, userId: string): Reactions {
  const next: Reactions = { ...reactions }
  const current = next[emoji] ?? []
  const updated = current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]
  if (updated.length === 0) delete next[emoji]
  else next[emoji] = updated
  return next
}

export interface ReactionSummary {
  emoji: string
  count: number
  mine: boolean
}

export function summarizeReactions(reactions: Reactions, userId: string): ReactionSummary[] {
  return Object.entries(reactions)
    .filter(([, ids]) => ids.length > 0)
    .map(([emoji, ids]) => ({ emoji, count: ids.length, mine: ids.includes(userId) }))
}
