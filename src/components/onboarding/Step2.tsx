'use client'

import { cn } from '@/lib/utils'
import type { Objective } from '@/types'

type Level = 'beginner' | 'intermediate' | 'advanced' | 'professional'
type Availability = 'weekday-evenings' | 'weekends' | 'flexible'

const OBJECTIVES: { value: Objective; label: string; emoji: string; subtitle: string }[] = [
  { value: 'jam',          label: 'Casual jam',      emoji: '🎶', subtitle: 'Low-key sessions, no pressure' },
  { value: 'form-band',    label: 'Form a band',     emoji: '🤘', subtitle: 'Build something serious together' },
  { value: 'record',       label: 'Studio sessions', emoji: '🎙️', subtitle: 'Record and produce original music' },
  { value: 'perform-live', label: 'Live gigs',        emoji: '🎤', subtitle: 'Hit stages and perform live' },
]

const LEVELS: { value: Level; label: string }[] = [
  { value: 'beginner',     label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced',     label: 'Advanced' },
  { value: 'professional', label: 'Professional' },
]

const AVAILABILITY_OPTIONS: { value: Availability; label: string }[] = [
  { value: 'weekday-evenings', label: 'Weekday evenings' },
  { value: 'weekends',         label: 'Weekends' },
  { value: 'flexible',         label: 'Flexible' },
]

interface Step2Props {
  objectives: Objective[]
  level: Level | null
  availability: Availability[]
  onObjectivesChange: (objectives: Objective[]) => void
  onLevelChange: (level: Level) => void
  onAvailabilityChange: (availability: Availability[]) => void
}

// tap() fires on touch devices via touchend (with preventDefault to avoid double-fire)
// and falls back to onClick on desktop. Works on iOS Safari + Android Chrome + desktop.
function tap(fn: () => void) {
  return {
    onClick: fn,
    onTouchEnd: (e: React.TouchEvent) => { e.preventDefault(); fn() },
  }
}

export default function Step2({ objectives, level, availability, onObjectivesChange, onLevelChange, onAvailabilityChange }: Step2Props) {
  const tapStyle = { WebkitTapHighlightColor: 'rgba(255,85,0,0.2)', touchAction: 'manipulation' as const }

  function toggleObjective(value: Objective) {
    try { navigator.vibrate?.(10) } catch {}
    onObjectivesChange(
      objectives.includes(value)
        ? objectives.filter((o) => o !== value)
        : [...objectives, value],
    )
  }

  function toggleAvailability(value: Availability) {
    try { navigator.vibrate?.(10) } catch {}
    onAvailabilityChange(
      availability.includes(value)
        ? availability.filter((a) => a !== value)
        : [...availability, value],
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="mb-1 text-4xl text-[#F0EFEB]" style={{ fontFamily: 'var(--font-bebas)' }}>
          What are you looking for?
        </h2>
        <p className="text-sm text-[rgba(240,239,235,0.45)]">Pick everything that applies</p>
      </div>

      {/* Objective cards */}
      <div className="flex flex-col gap-3">
        {OBJECTIVES.map(({ value, label, emoji, subtitle }) => {
          const selected = objectives.includes(value)
          return (
            <button
              key={value}
              type="button"
              {...tap(() => toggleObjective(value))}
              style={tapStyle}
              className={cn(
                'relative flex w-full items-start gap-4 rounded-2xl p-4 text-left min-h-[64px]',
                'active:scale-[0.98]',
                selected
                  ? 'bg-[#FF5500] text-black shadow-[0_0_24px_rgba(255,85,0,0.45)]'
                  : 'glass text-[#F0EFEB]',
              )}
            >
              {selected && (
                <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-black/20">
                  <svg viewBox="0 0 12 10" fill="none" className="h-3 w-3">
                    <path d="M1 5l3 3 7-7" stroke="black" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              )}
              <span className="mt-0.5 text-2xl">{emoji}</span>
              <div>
                <p className="font-semibold">{label}</p>
                <p className={cn('text-xs', selected ? 'text-black/70' : 'text-[rgba(240,239,235,0.45)]')}>{subtitle}</p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Level */}
      <div>
        <p className="mb-3 text-sm text-[rgba(240,239,235,0.45)]">Your level</p>
        <div className="flex flex-wrap gap-2">
          {LEVELS.map(({ value, label }) => {
            const selected = level === value
            return (
              <button
                key={value}
                type="button"
                {...tap(() => { try { navigator.vibrate?.(10) } catch {}; onLevelChange(value) })}
                style={tapStyle}
                className={cn(
                  'flex h-[40px] flex-1 items-center justify-center rounded-full px-3 text-[13px] font-medium min-w-[70px]',
                  'active:scale-95',
                  selected ? 'bg-[#FF5500] text-black shadow-[0_0_12px_rgba(255,85,0,0.5)]' : 'glass text-[#F0EFEB]',
                )}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Availability */}
      <div>
        <p className="mb-3 text-sm text-[rgba(240,239,235,0.45)]">Availability</p>
        <div className="flex flex-wrap gap-2">
          {AVAILABILITY_OPTIONS.map(({ value, label }) => {
            const selected = availability.includes(value)
            return (
              <button
                key={value}
                type="button"
                {...tap(() => toggleAvailability(value))}
                style={tapStyle}
                className={cn(
                  'rounded-full px-4 py-1.5 text-sm font-medium',
                  'active:scale-95',
                  selected ? 'bg-[#FF5500] text-black shadow-[0_0_12px_rgba(255,85,0,0.5)]' : 'glass text-[#F0EFEB]',
                )}
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
