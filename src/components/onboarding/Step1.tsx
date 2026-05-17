'use client'

import { cn } from '@/lib/utils'
import type { Genre, Instrument } from '@/types'

const INSTRUMENTS: { value: Instrument; label: string; emoji: string }[] = [
  { value: 'guitar',    label: 'Guitar',   emoji: '🎸' },
  { value: 'bass',      label: 'Bass',     emoji: '🎵' },
  { value: 'drums',     label: 'Drums',    emoji: '🥁' },
  { value: 'keys',      label: 'Keys',     emoji: '🎹' },
  { value: 'vocals',    label: 'Vocals',   emoji: '🎤' },
  { value: 'violin',    label: 'Violin',   emoji: '🎻' },
  { value: 'saxophone', label: 'Sax',      emoji: '🎷' },
  { value: 'trumpet',   label: 'Trumpet',  emoji: '🎺' },
  { value: 'producer',  label: 'Producer', emoji: '🎛️' },
  { value: 'dj',        label: 'DJ',       emoji: '💿' },
  { value: 'other',     label: 'Other',    emoji: '🎼' },
]

const GENRES: { value: Genre; label: string }[] = [
  { value: 'rock',         label: 'Rock' },
  { value: 'indie',        label: 'Indie' },
  { value: 'jazz',         label: 'Jazz' },
  { value: 'electronic',   label: 'Electronic' },
  { value: 'hip-hop',      label: 'Hip-Hop' },
  { value: 'classical',    label: 'Classical' },
  { value: 'metal',        label: 'Metal' },
  { value: 'folk',         label: 'Folk' },
  { value: 'r&b',          label: 'R&B' },
  { value: 'pop',          label: 'Pop' },
  { value: 'punk',         label: 'Punk' },
  { value: 'experimental', label: 'Experimental' },
]

interface Step1Props {
  instruments: Instrument[]
  genres: Genre[]
  onInstrumentsChange: (instruments: Instrument[]) => void
  onGenresChange: (genres: Genre[]) => void
}

// tap() fires on touch devices via touchend (with preventDefault so no double-fire)
// and falls back to onClick on desktop. Works on iOS Safari + Android Chrome + desktop.
function tap(fn: () => void) {
  return {
    onClick: fn,
    onTouchEnd: (e: React.TouchEvent) => { e.preventDefault(); fn() },
  }
}

export default function Step1({ instruments, genres, onInstrumentsChange, onGenresChange }: Step1Props) {
  function toggleInstrument(value: Instrument) {
    try { navigator.vibrate?.(10) } catch {}
    onInstrumentsChange(
      instruments.includes(value)
        ? instruments.filter((i) => i !== value)
        : [...instruments, value],
    )
  }

  function toggleGenre(value: Genre) {
    try { navigator.vibrate?.(10) } catch {}
    if (genres.includes(value)) {
      onGenresChange(genres.filter((g) => g !== value))
    } else if (genres.length < 3) {
      onGenresChange([...genres, value])
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="mb-1 text-4xl text-[#F0EFEB]" style={{ fontFamily: 'var(--font-bebas)' }}>
          What do you play?
        </h2>
        <p className="text-sm text-[rgba(240,239,235,0.45)]">Select all that apply</p>
      </div>

      {/* Instruments */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {INSTRUMENTS.map(({ value, label, emoji }) => {
          const selected = instruments.includes(value)
          return (
            <button
              key={value}
              type="button"
              {...tap(() => toggleInstrument(value))}
              className={cn(
                'flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 font-medium text-[13px]',
                'active:scale-95',
                selected
                  ? 'bg-[#FF5500] text-black shadow-[0_0_16px_rgba(255,85,0,0.55)]'
                  : 'glass text-[#F0EFEB]',
              )}
              style={{ WebkitTapHighlightColor: 'rgba(255,85,0,0.2)', touchAction: 'manipulation' }}
            >
              <span className="text-xl">{emoji}</span>
              <span>{label}</span>
            </button>
          )
        })}
      </div>

      {/* Genres */}
      <div>
        <p className="mb-3 text-sm text-[rgba(240,239,235,0.45)]">Pick up to 3 genres</p>
        <div className="flex flex-wrap gap-2">
          {GENRES.map(({ value, label }) => {
            const selected = genres.includes(value)
            const maxed = genres.length >= 3 && !selected
            return (
              <button
                key={value}
                type="button"
                {...(maxed ? {} : tap(() => toggleGenre(value)))}
                disabled={maxed}
                className={cn(
                  'flex h-[36px] items-center rounded-full px-3 text-[13px] font-medium',
                  'active:scale-95',
                  selected ? 'bg-[#FF5500] text-black shadow-[0_0_12px_rgba(255,85,0,0.5)]' : 'glass text-[#F0EFEB]',
                  maxed && 'opacity-30 cursor-not-allowed',
                )}
                style={{ WebkitTapHighlightColor: 'rgba(255,85,0,0.2)', touchAction: 'manipulation' }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
