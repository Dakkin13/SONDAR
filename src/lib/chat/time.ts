import type { ChatMessageBase } from './types'

export function formatBubbleTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function formatDayLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
}

export function isSameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

// Consecutive messages from the same sender within this window collapse into
// one visual group (tighter spacing, a single timestamp on the last bubble).
const GROUP_WINDOW_MS = 2 * 60 * 1000

export function isGroupedWithPrevious(prev: ChatMessageBase | undefined, cur: ChatMessageBase): boolean {
  if (!prev) return false
  if (prev.from_id !== cur.from_id) return false
  if (!isSameDay(prev.created_at, cur.created_at)) return false
  return new Date(cur.created_at).getTime() - new Date(prev.created_at).getTime() < GROUP_WINDOW_MS
}

// "last seen" label for a chat header, from profiles.last_active.
export function formatLastSeen(iso: string | null | undefined): string | null {
  if (!iso) return null
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'last seen just now'
  if (mins < 60) return `last seen ${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `last seen ${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'last seen yesterday'
  if (days < 7) return `last seen ${days}d ago`
  return `last seen ${new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' })}`
}

// Compact relative time for feeds: "just now", "5m", "3h", "2d", "Sep 3".
export function formatTimeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d`
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function canStillEdit(createdAt: string, windowMinutes = 15): boolean {
  return Date.now() - new Date(createdAt).getTime() < windowMinutes * 60 * 1000
}
