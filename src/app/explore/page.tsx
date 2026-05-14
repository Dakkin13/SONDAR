'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { NearbyMusician } from '@/types'
import type { FiltersState, ViewMode } from '@/components/map/FilterBar'
import FilterBar from '@/components/map/FilterBar'
import BottomSheet from '@/components/map/BottomSheet'
import MusicianCard from '@/components/map/MusicianCard'

// MapView uses mapbox-gl which is browser-only — dynamic import prevents SSR
const MapView = dynamic(() => import('@/components/map/MapView'), { ssr: false })

const MADRID: [number, number] = [-3.7038, 40.4168]

export default function ExplorePage() {
  const [musicians, setMusicians] = useState<NearbyMusician[]>([])
  const [selected, setSelected] = useState<NearbyMusician | null>(null)
  const [center, setCenter] = useState<[number, number]>(MADRID)
  const [filters, setFilters] = useState<FiltersState>({ instrument: '', objective: '' })
  const [viewMode, setViewMode] = useState<ViewMode>('map')
  const fetchedFor = useRef<string>('')

  // Touch last_active and request geolocation on mount
  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) void supabase.rpc('touch_last_active')
    })

    navigator.geolocation?.getCurrentPosition(
      (pos) => setCenter([pos.coords.longitude, pos.coords.latitude]),
      () => {}, // silent fallback — Madrid stays
    )
  }, [])

  // Fetch nearby musicians whenever center changes
  useEffect(() => {
    const key = center.join(',')
    if (fetchedFor.current === key) return
    fetchedFor.current = key

    const supabase = createClient()
    supabase
      .rpc('get_nearby_musicians', {
        lat: center[1],
        lng: center[0],
        radius_km: 50,
      })
      .then(({ data }) => {
        if (data) setMusicians(data as NearbyMusician[])
      })
  }, [center])

  // Apply client-side filters for the bottom sheet / list view
  const filtered = musicians.filter((m) => {
    if (filters.instrument && !m.instruments.includes(filters.instrument)) return false
    if (filters.objective && !m.objectives.includes(filters.objective)) return false
    return true
  })

  const handlePinClick = useCallback((m: NearbyMusician) => setSelected(m), [])
  const handleClose = useCallback(() => setSelected(null), [])

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0D0D0D]">
      {/* ── Map (always mounted so Mapbox stays initialised) ── */}
      <div
        className="absolute inset-0"
        style={{ visibility: viewMode === 'map' ? 'visible' : 'hidden' }}
      >
        <MapView
          musicians={musicians}
          selectedId={selected?.id ?? null}
          onPinClick={handlePinClick}
          center={center}
          filters={filters}
        />
      </div>

      {/* ── List view overlay ── */}
      {viewMode === 'list' && (
        <div className="absolute inset-0 overflow-y-auto bg-[#0D0D0D] px-4 pt-28 pb-8">
          {filtered.length === 0 ? (
            <p className="mt-20 text-center text-sm text-[rgba(240,239,235,0.35)]">
              No musicians found nearby yet.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((m) => (
                <MusicianCard key={m.id} musician={m} compact={false} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Top bar ── */}
      <div className="absolute left-0 right-0 top-0 z-20 px-4 pt-4">
        <div className="glass flex items-center justify-between px-4 py-3">
          {/* Wordmark */}
          <Link
            href="/"
            className="text-[22px] leading-none tracking-[0.08em] text-[#F0EFEB]"
            style={{ fontFamily: 'var(--font-bebas)' }}
          >
            SONUS
          </Link>

          <FilterBar
            filters={filters}
            onFiltersChange={setFilters}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            count={filtered.length}
          />
        </div>
      </div>

      {/* ── Bottom sheet (map mode only) ── */}
      {viewMode === 'map' && (
        <div className="absolute bottom-0 left-0 right-0 z-20">
          <BottomSheet
            musicians={filtered}
            selected={selected}
            onClose={handleClose}
          />
        </div>
      )}
    </div>
  )
}
