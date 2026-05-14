'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { NearbyMusician, Instrument, Objective } from '@/types'
import { INSTRUMENT_EMOJI } from './MusicianCard'

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!
const MADRID: [number, number] = [-3.7038, 40.4168]

interface Props {
  musicians: NearbyMusician[]
  selectedId: string | null
  onPinClick: (musician: NearbyMusician) => void
  center: [number, number]
  filters: { instrument: Instrument | ''; objective: Objective | '' }
}

// Creates a DOM element for a custom map pin
function createPinEl(musician: NearbyMusician, selected: boolean): HTMLElement {
  const outer = document.createElement('div')
  const size = selected ? 52 : 44
  outer.style.cssText = [
    `width:${size}px`,
    `height:${size}px`,
    'border-radius:50%',
    `border:2px solid ${selected ? '#FF5C00' : 'rgba(255,92,0,0.55)'}`,
    'overflow:hidden',
    'cursor:pointer',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'font-size:20px',
    'background:#1C1C1C',
    `box-shadow:0 0 0 ${selected ? 5 : 3}px rgba(255,92,0,${selected ? 0.30 : 0.15}),0 0 ${selected ? 22 : 12}px rgba(255,92,0,${selected ? 0.5 : 0.3})`,
    `transform:scale(${selected ? 1.12 : 1})`,
    'transition:transform 0.2s,box-shadow 0.2s',
  ].join(';')

  if (musician.avatar_url) {
    const img = document.createElement('img')
    img.src = musician.avatar_url
    img.alt = musician.display_name ?? ''
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;'
    outer.appendChild(img)
  } else {
    outer.textContent = INSTRUMENT_EMOJI[musician.instruments[0]] ?? '🎵'
  }

  return outer
}

export default function MapView({ musicians, selectedId, onPinClick, center, filters }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<{ marker: mapboxgl.Marker; id: string }[]>([])
  const initialCenterSet = useRef(false)

  // ── Initialise map once ────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    mapboxgl.accessToken = TOKEN
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: MADRID,
      zoom: 13,
      pitchWithRotate: false,
      attributionControl: false,
    })

    map.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      'bottom-left',
    )

    mapRef.current = map

    return () => {
      markersRef.current.forEach(({ marker }) => marker.remove())
      markersRef.current = []
      map.remove()
      mapRef.current = null
    }
  }, [])

  // ── Fly to center when it changes ─────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (!initialCenterSet.current) {
      initialCenterSet.current = true
      // First real center — fly immediately
      map.once('load', () => {
        map.flyTo({ center, zoom: 13, duration: 1200, essential: true })
      })
      // Also try right away in case map already loaded
      if (map.isStyleLoaded()) {
        map.flyTo({ center, zoom: 13, duration: 1200, essential: true })
      }
    } else {
      map.flyTo({ center, zoom: 13, duration: 1500, essential: true })
    }
  }, [center])

  // ── Sync markers ───────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Filter musicians
    const visible = musicians.filter((m) => {
      if (filters.instrument && !m.instruments.includes(filters.instrument)) return false
      if (filters.objective && !m.objectives.includes(filters.objective)) return false
      return true
    })

    // Remove markers that are no longer in the visible set
    const visibleIds = new Set(visible.map((m) => m.id))
    markersRef.current = markersRef.current.filter(({ marker, id }) => {
      if (!visibleIds.has(id)) {
        marker.remove()
        return false
      }
      return true
    })

    // Add or update markers
    const existingIds = new Set(markersRef.current.map(({ id }) => id))
    for (const musician of visible) {
      const isSelected = musician.id === selectedId

      if (existingIds.has(musician.id)) {
        // Rebuild element in place to update selected state
        const entry = markersRef.current.find(({ id }) => id === musician.id)!
        const el = createPinEl(musician, isSelected)
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          onPinClick(musician)
        })
        // Replace the marker's element by removing and re-adding
        entry.marker.remove()
        entry.marker = new mapboxgl.Marker({ element: el })
          .setLngLat([musician.location_lng, musician.location_lat])
          .addTo(map)
      } else {
        const el = createPinEl(musician, isSelected)
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          onPinClick(musician)
        })
        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([musician.location_lng, musician.location_lat])
          .addTo(map)
        markersRef.current.push({ marker, id: musician.id })
      }
    }
  }, [musicians, selectedId, filters, onPinClick])

  return <div ref={containerRef} className="absolute inset-0" />
}
