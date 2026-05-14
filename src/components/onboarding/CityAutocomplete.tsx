'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface Suggestion {
  id: string
  placeName: string
  lat: number
  lng: number
}

interface CityAutocompleteProps {
  value: string
  onChange: (name: string) => void
  onSelect: (name: string, lat: number, lng: number) => void
}

const inputClass =
  'w-full rounded-xl border border-[rgba(240,239,235,0.08)] bg-[#1C1C1C] px-4 py-3 text-sm text-[#F0EFEB] placeholder:text-[rgba(240,239,235,0.3)] outline-none focus:border-[rgba(255,85,0,0.5)] focus:ring-1 focus:ring-[rgba(255,85,0,0.3)] transition-colors'

export default function CityAutocomplete({
  value,
  onChange,
  onSelect,
}: CityAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value
    onChange(q)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (q.length < 3) {
      setSuggestions([])
      setOpen(false)
      return
    }

    debounceRef.current = setTimeout(() => fetchSuggestions(q), 300)
  }

  async function fetchSuggestions(query: string) {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!token) return

    setLoading(true)
    try {
      const url =
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
        `?types=place&limit=5&access_token=${token}`

      const res = await fetch(url)
      if (!res.ok) return
      const json = await res.json() as {
        features: Array<{
          id: string
          place_name: string
          center: [number, number]
        }>
      }

      setSuggestions(
        json.features.map((f) => ({
          id: f.id,
          placeName: f.place_name,
          lng: f.center[0],
          lat: f.center[1],
        })),
      )
      setOpen(true)
    } finally {
      setLoading(false)
    }
  }

  function handleSelect(s: Suggestion) {
    onSelect(s.placeName, s.lat, s.lng)
    setSuggestions([])
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleChange}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder="Madrid, Berlin, Paris…"
          autoComplete="off"
          className={cn(inputClass, loading && 'pr-10')}
        />
        {loading && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[rgba(240,239,235,0.3)]">
            ···
          </span>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-[rgba(240,239,235,0.08)] bg-[#141414] py-1 shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl">
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleSelect(s)
                }}
                className="flex w-full items-start gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-[rgba(255,85,0,0.1)] hover:text-[#FF5500]"
              >
                <span className="mt-0.5 shrink-0 text-[rgba(240,239,235,0.3)]">
                  📍
                </span>
                <span className="text-[#F0EFEB] line-clamp-1">{s.placeName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
