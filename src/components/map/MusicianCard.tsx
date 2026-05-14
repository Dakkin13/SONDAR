'use client'

import Link from 'next/link'
import type { NearbyMusician } from '@/types'

export const INSTRUMENT_EMOJI: Record<string, string> = {
  guitar: '🎸', bass: '🎸', drums: '🥁', keys: '🎹',
  piano: '🎹', violin: '🎻', cello: '🎻', trumpet: '🎺',
  saxophone: '🎷', flute: '🪈', vocals: '🎤', producer: '🎛️',
  dj: '🎧', other: '🎵',
}

function activeStatus(lastActive: string | null): { label: string; color: string } | null {
  if (!lastActive) return null
  const diffMs = Date.now() - new Date(lastActive).getTime()
  const days = diffMs / 86_400_000
  if (days < 1) return { label: 'Active today', color: '#B8FF00' }
  if (days < 7) return { label: 'Active this week', color: '#B8FF00' }
  return null
}

interface Props {
  musician: NearbyMusician
  compact?: boolean
}

export default function MusicianCard({ musician, compact = true }: Props) {
  const status = activeStatus(musician.last_active)
  const primary = musician.instruments[0]

  return (
    <Link
      href={`/profile/${musician.id}`}
      className="flex shrink-0 flex-col gap-3 rounded-2xl border border-[rgba(240,239,235,0.08)] bg-[rgba(18,18,18,0.96)] p-4 transition-opacity hover:opacity-90 active:opacity-80"
      style={{ width: compact ? 220 : '100%' }}
    >
      {/* Avatar + name */}
      <div className="flex items-center gap-3">
        <div
          className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-[#1C1C1C]"
          style={{
            border: '2px solid rgba(255,92,0,0.5)',
            boxShadow: '0 0 12px rgba(255,92,0,0.25)',
          }}
        >
          {musician.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={musician.avatar_url}
              alt={musician.display_name ?? ''}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-xl">
              {INSTRUMENT_EMOJI[primary] ?? '🎵'}
            </span>
          )}
          {status && (
            <span
              className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#121212]"
              style={{ background: status.color }}
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[#F0EFEB]">
            {musician.display_name ?? 'Unknown'}
          </p>
          {status ? (
            <p className="mt-0.5 text-[10px]" style={{ color: status.color }}>
              {status.label}
            </p>
          ) : (
            <p className="mt-0.5 text-[10px] text-[rgba(240,239,235,0.3)]">
              {musician.location_name ?? ''}
            </p>
          )}
        </div>
      </div>

      {/* Instruments */}
      {musician.instruments.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {musician.instruments.slice(0, compact ? 3 : 5).map((inst) => (
            <span
              key={inst}
              className="rounded-full bg-[#FF5C00] px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-black"
            >
              {inst}
            </span>
          ))}
        </div>
      )}

      {/* Genres */}
      {musician.genres.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {musician.genres.slice(0, compact ? 2 : 4).map((g) => (
            <span
              key={g}
              className="rounded-full border border-[rgba(240,239,235,0.14)] px-2 py-0.5 text-[9px] text-[rgba(240,239,235,0.5)]"
            >
              {g}
            </span>
          ))}
        </div>
      )}

      {/* Distance */}
      <p className="text-[9px] text-[rgba(240,239,235,0.28)]">
        {musician.distance_km < 1
          ? `${Math.round(musician.distance_km * 1000)} m away`
          : `${musician.distance_km.toFixed(1)} km away`}
      </p>
    </Link>
  )
}
