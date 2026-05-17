'use client'

import type { Instrument, Objective } from '@/types'

export type ViewMode = 'map' | 'list'

export interface FiltersState {
  instrument: Instrument | ''
  objective: Objective | ''
}

interface Props {
  filters: FiltersState
  onFiltersChange: (f: FiltersState) => void
  viewMode: ViewMode
  onViewModeChange: (m: ViewMode) => void
  count: number
}

const INSTRUMENTS: Instrument[] = [
  'guitar', 'bass', 'drums', 'keys', 'piano', 'violin', 'cello',
  'trumpet', 'saxophone', 'flute', 'vocals', 'producer', 'dj', 'other',
]

const OBJECTIVES: Objective[] = [
  'jam', 'form-band', 'record', 'perform-live',
]

const OBJECTIVE_LABELS: Record<Objective, string> = {
  'jam': 'Jam',
  'form-band': 'Form band',
  'record': 'Record',
  'perform-live': 'Perform live',
}

const selectClass = [
  'appearance-none rounded-xl px-3 py-2 text-xs text-[#F0EFEB] outline-none cursor-pointer',
  'border border-[rgba(240,239,235,0.10)] bg-[rgba(13,13,13,0.7)]',
  'transition-colors focus:border-[rgba(255,92,0,0.4)]',
].join(' ')

export default function FilterBar({ filters, onFiltersChange, viewMode, onViewModeChange, count }: Props) {
  const hasFilter = filters.instrument !== '' || filters.objective !== ''

  return (
    <div className="flex flex-nowrap items-center justify-end gap-1.5">
      {/* Live count — only on wider screens */}
      <span className="hidden shrink-0 text-[10px] tracking-widest text-[rgba(240,239,235,0.4)] sm:inline">
        {count} nearby
      </span>

      {/* Instrument */}
      <select
        value={filters.instrument}
        onChange={(e) =>
          onFiltersChange({ ...filters, instrument: e.target.value as Instrument | '' })
        }
        className={selectClass}
      >
        <option value="">Instrument</option>
        {INSTRUMENTS.map((i) => (
          <option key={i} value={i}>
            {i.charAt(0).toUpperCase() + i.slice(1)}
          </option>
        ))}
      </select>

      {/* Objective */}
      <select
        value={filters.objective}
        onChange={(e) =>
          onFiltersChange({ ...filters, objective: e.target.value as Objective | '' })
        }
        className={selectClass}
      >
        <option value="">Goal</option>
        {OBJECTIVES.map((o) => (
          <option key={o} value={o}>
            {OBJECTIVE_LABELS[o]}
          </option>
        ))}
      </select>

      {/* Clear filters — icon-only to save space */}
      {hasFilter && (
        <button
          onClick={() => onFiltersChange({ instrument: '', objective: '' })}
          className="shrink-0 rounded-xl border border-[rgba(255,92,0,0.4)] px-2.5 py-2 text-[11px] text-[#FF5C00] transition-opacity hover:opacity-75"
          aria-label="Clear filters"
        >
          ✕
        </button>
      )}

      {/* Map / List toggle — icon-only on mobile */}
      <button
        onClick={() => onViewModeChange(viewMode === 'map' ? 'list' : 'map')}
        className="shrink-0 rounded-xl border border-[rgba(240,239,235,0.10)] bg-[rgba(13,13,13,0.7)] px-2.5 py-2 text-[11px] text-[#F0EFEB] transition-colors hover:border-[rgba(255,92,0,0.4)]"
        aria-label={viewMode === 'map' ? 'Switch to list' : 'Switch to map'}
      >
        <span className="hidden sm:inline">{viewMode === 'map' ? '≡ List' : '⊙ Map'}</span>
        <span className="sm:hidden">{viewMode === 'map' ? '≡' : '⊙'}</span>
      </button>
    </div>
  )
}
