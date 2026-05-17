'use client'

import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import type { NearbyMusician } from '@/types'
import MusicianCard, { INSTRUMENT_EMOJI } from './MusicianCard'

const SPRING = { type: 'spring' as const, damping: 20, stiffness: 300 }

// ── Expanded selected musician view ──────────────────────────────────────────

function ExpandedView({ musician, onClose }: { musician: NearbyMusician; onClose: () => void }) {
  return (
    <div className="px-4 pb-8">
      <button
        onClick={onClose}
        className="mb-4 flex min-h-[44px] items-center text-xs text-[rgba(240,239,235,0.4)] transition-colors hover:text-[#F0EFEB]"
      >
        ← Back
      </button>

      <div className="flex gap-4">
        {/* Avatar */}
        <div
          className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-[#1C1C1C]"
          style={{
            border: '2px solid rgba(255,92,0,0.5)',
            boxShadow: '0 0 20px rgba(255,92,0,0.3)',
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
            <span className="flex h-full w-full items-center justify-center text-3xl">
              {INSTRUMENT_EMOJI[musician.instruments[0]] ?? '🎵'}
            </span>
          )}
        </div>

        {/* Name + location */}
        <div className="flex flex-col justify-center gap-1">
          <h3
            className="text-2xl leading-none text-[#F0EFEB]"
            style={{ fontFamily: 'var(--font-bebas)', letterSpacing: '0.04em' }}
          >
            {musician.display_name ?? 'Unknown'}
          </h3>
          {musician.city && (
            <p className="text-xs text-[rgba(240,239,235,0.4)]">{musician.city}</p>
          )}
          <p className="text-[10px] text-[rgba(240,239,235,0.3)]">
            {musician.distance_km < 1
              ? `${Math.round(musician.distance_km * 1000)} m away`
              : `${musician.distance_km.toFixed(1)} km away`}
          </p>
        </div>
      </div>

      {/* Bio */}
      {musician.bio && (
        <p className="mt-5 text-sm leading-relaxed text-[rgba(240,239,235,0.6)]">
          {musician.bio}
        </p>
      )}

      {/* Instruments */}
      {musician.instruments.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {musician.instruments.map((inst) => (
            <span
              key={inst}
              className="rounded-full bg-[#FF5C00] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-black"
            >
              {inst}
            </span>
          ))}
        </div>
      )}

      {/* Genres */}
      {musician.genres.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {musician.genres.map((g) => (
            <span
              key={g}
              className="rounded-full border border-[rgba(240,239,235,0.15)] px-2.5 py-1 text-[10px] text-[rgba(240,239,235,0.55)]"
            >
              {g}
            </span>
          ))}
        </div>
      )}

      {/* CTA */}
      <Link
        href={`/profile/${musician.id}`}
        className="mt-6 block rounded-xl bg-[#FF5C00] px-6 py-3 text-center text-sm font-semibold text-black shadow-[0_0_20px_rgba(255,92,0,0.35)] transition-opacity hover:opacity-90"
      >
        View full profile →
      </Link>
    </div>
  )
}

// ── Bottom sheet ──────────────────────────────────────────────────────────────

interface Props {
  musicians: NearbyMusician[]
  selected: NearbyMusician | null
  onClose: () => void
}

const PEEK_H = 210   // height when showing musician cards
const EXPAND_H = 480 // height when showing selected musician

export default function BottomSheet({ musicians, selected, onClose }: Props) {
  return (
    <motion.div
      className="overflow-hidden rounded-t-3xl"
      style={{
        background: 'rgba(18,18,18,0.72)',
        backdropFilter: 'blur(36px) saturate(220%)',
        WebkitBackdropFilter: 'blur(36px) saturate(220%)',
        border: '1px solid rgba(255,255,255,0.09)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14), 0 -8px 48px rgba(0,0,0,0.55)',
      }}
      animate={{ height: selected ? EXPAND_H : PEEK_H }}
      transition={SPRING}
    >
      {/* Handle — opacity animates on hover */}
      <div className="flex shrink-0 justify-center pb-2 pt-3">
        <motion.div
          className="h-1 w-10 rounded-full bg-[rgba(240,239,235,0.4)]"
          initial={{ opacity: 0.4 }}
          whileHover={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {selected ? (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={SPRING}
          >
            <ExpandedView musician={selected} onClose={onClose} />
          </motion.div>
        ) : (
          <motion.div
            key="peek"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <p className="mb-3 px-4 text-[10px] tracking-[0.2em] uppercase text-[rgba(240,239,235,0.35)]">
              {musicians.length} musicians nearby
            </p>
            <div
              className="flex gap-3 overflow-x-auto px-4 pb-4"
              style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
            >
              {musicians.slice(0, 20).map((m) => (
                <MusicianCard key={m.id} musician={m} compact />
              ))}
              {musicians.length === 0 && (
                <p className="text-sm text-[rgba(240,239,235,0.3)]">
                  No musicians found in this area yet.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
