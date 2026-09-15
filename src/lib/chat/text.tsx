import type { ReactNode } from 'react'

const URL_RE = /https?:\/\/[^\s<>"']+/g
const MENTION_RE = /@([\p{L}\p{N}_.]+)/gu

interface RenderOptions {
  /** Names that count as mentions (case-insensitive). Empty → no highlighting. */
  mentions?: string[]
  /** Called for a matched mention, e.g. to open a profile. */
  onMention?: (name: string) => void
}

// Turns a plain message into React nodes: URLs become links that open in a
// new tab, and @name tokens matching a known member are highlighted.
export function renderMessageText(text: string, opts: RenderOptions = {}): ReactNode {
  const mentionSet = new Set((opts.mentions ?? []).map((n) => n.toLowerCase()))
  const out: ReactNode[] = []
  let key = 0

  function pushText(segment: string) {
    if (!segment) return
    if (mentionSet.size === 0) { out.push(segment); return }
    let last = 0
    for (const m of segment.matchAll(MENTION_RE)) {
      const name = m[1]
      const start = m.index ?? 0
      if (!mentionSet.has(name.toLowerCase())) continue
      if (start > last) out.push(segment.slice(last, start))
      out.push(
        <span
          key={`m${key++}`}
          className="font-semibold"
          style={{ color: 'var(--color-accent)', cursor: opts.onMention ? 'pointer' : undefined }}
          onClick={opts.onMention ? () => opts.onMention?.(name) : undefined}
        >
          @{name}
        </span>,
      )
      last = start + m[0].length
    }
    if (last < segment.length) out.push(segment.slice(last))
  }

  let cursor = 0
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index ?? 0
    pushText(text.slice(cursor, start))
    const url = m[0].replace(/[.,;:!?)]+$/, '')
    const trailing = m[0].slice(url.length)
    out.push(
      <a
        key={`u${key++}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 break-all"
        onClick={(e) => e.stopPropagation()}
      >
        {url}
      </a>,
    )
    if (trailing) out.push(trailing)
    cursor = start + m[0].length
  }
  pushText(text.slice(cursor))

  return out.length === 1 ? out[0] : out
}

// Whether the text @-mentions any of the given names.
export function mentionsAny(text: string, names: string[]): boolean {
  const set = new Set(names.map((n) => n.toLowerCase()))
  for (const m of text.matchAll(MENTION_RE)) {
    if (set.has(m[1].toLowerCase())) return true
  }
  return false
}
