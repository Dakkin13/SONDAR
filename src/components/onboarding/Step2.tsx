'use client'

import { cn } from '@/lib/utils'
import type { Objective } from '@/types'

type Level = 'beginner' | 'intermediate' | 'advanced' | 'professional'
type Availability = 'weekday-evenings' | 'weekends' | 'flexible'

const OBJECTIVES: {
  value: Objective
  label: string
  emoji: string
  subtitle: string
}[] = [
  {
    value: 'jam',
    label: 'Casual jam',
    emoji: '🎶',
    subtitle: 'Low-key sessions, no pressure',
  },
  {
    value: 'form-band',
    label: 'Form a band',
    emoji: '🤘',
    subtitle: 'Build something serious together',
  },
  {
    value: 'record',
    label: 'Studio sessions',
    emoji: '🎙️',
    subtitle: 'Record and produce original music',
  },
  {
    value: 'perform-live',
    label: 'Live gigs',
    emoji: '🎤',
    subtitle: 'Hit stages and perform live',
  },
]

const LEVELS: { value: Level; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'professional', label: 'Professional' },
]

const AVAILABILITY_OPTIONS: { value: Availability; label: string }[] = [
  { value: 'weekday-evenings', label: 'Weekday evenings' },
  { value: 'weekends', label: 'Weekends' },
  { value: 'flexible', label: 'Flexible' },
]

interface Step2Props {
  objectives: Objective[]
  level: Level | null
  availability: Availability[]
  onObjectivesChange: (objectives: Objective[]) => void
  onLevelChange: (level: Level) => void
  onAvailabilityChange: (availability: Availability[]) => void
}

export default function Step2({
  objectives,
  level,
  availability,
  onObjectivesChange,
  onLevelChange,
  onAvailabilityChange,
}: Step2Props) {
  function toggleObjective(value: Objective) {
    onObjectivesChange(
      objectives.includes(value)
        ? objectives.filter((o) => o !== value)
        : [...objectives, value],
    )
  }

  function toggleAvailability(value: Availability) {
    onAvailabilityChange(
      availability.includes(value)
        ? availability.filter((a) => a !== value)
        : [...availability, value],
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2
          className="mb-1 text-4xl text-[#F0EFEB]"
          style={{ fontFamily: 'var(--font-bebas)' }}
        >
          What are you looking for?
        </h2>
        <p className="text-sm text-[rgba(240,239,235,0.45)]">
          Choose everything that fits
        </p>
      </div>

      {/* Objective cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {OBJECTIVES.map(({ value, label, emoji, subtitle }) => {
          const selected = objectives.includes(value)
          return (
            <button
              key={value}
              onClick={() => toggleObjective(value)}
              className={cn(
                'flex items-start gap-4 rounded-2xl px-5 py-4 text-left transition-all duration-200',
                selected
                  ? 'bg-[#FF5500] text-black shadow-[0_0_24px_rgba(255,85,0,0.4)]'
                  : 'glass text-[#F0EFEB] hover:border-[rgba(240,239,235,0.2)]',
              )}
            >
              <span className="mt-0.5 text-2xl">{emoji}</span>
              <div>
                <p className="font-semibold">{label}</p>
                <p
                  className={cn(
                    'text-xs',
                    selected
                      ? 'text-black/70'
                      : 'text-[rgba(240,239,235,0.45)]',
                  )}
                >
                  {subtitle}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Level */}
      <div>
        <p className="mb-3 text-sm text-[rgba(240,239,235,0.45)]">
          Your level
        </p>
        <div className="flex flex-wrap gap-2">
          {LEVELS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onLevelChange(value)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200',
                level === value
                  ? 'bg-[#FF5500] text-black shadow-[0_0_12px_rgba(255,85,0,0.45)]'
                  : 'glass text-[#F0EFEB]',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Availability */}
      <div>
        <p className="mb-3 text-sm text-[rgba(240,239,235,0.45)]">
          Availability
        </p>
        <div className="flex flex-wrap gap-2">
          {AVAILABILITY_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => toggleAvailability(value)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200',
                availability.includes(value)
                  ? 'bg-[#FF5500] text-black shadow-[0_0_12px_rgba(255,85,0,0.45)]'
                  : 'glass text-[#F0EFEB]',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
