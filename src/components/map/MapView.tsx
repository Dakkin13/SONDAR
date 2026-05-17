'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { NearbyMusician, Instrument, Objective } from '@/types'
import { INSTRUMENT_EMOJI } from './MusicianCard'

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''
const MADRID: [number, number] = [-3.7038, 40.4168]

interface Props {
  musicians: NearbyMusician[]
  selectedId: string | null
  onPinClick: (musician: NearbyMusician) => void
  center: [number, number]
  filters: { instrument: Instrument | ''; objective: Objective | '' }
  userLocation?: [number, number] | null
}

// PostGIS geography returns GeoJSON: { type: 'Point', coordinates: [lng, lat] }
// lng is ALWAYS first in GeoJSON coordinates.
function parseLocation(location: unknown): [number, number] | null {
  if (!location || typeof location !== 'object') return null
  const geo = location as { type?: string; coordinates?: [number, number] }
  if (geo.type === 'Point' && Array.isArray(geo.coordinates) && geo.coordinates.length === 2) {
    const [lng, lat] = geo.coordinates
    if (!isNaN(lng) && !isNaN(lat) && Math.abs(lng) <= 180 && Math.abs(lat) <= 90) {
      return [lng, lat]
    }
  }
  return null
}

function createUserPinEl(): HTMLElement {
  // wrapper: Mapbox applies transform here — anchor:'bottom' places geographic
  // point at the bottom-center of this wrapper, i.e. below the circle + label.
  // We flip the layout: label on top, circle on bottom, so the circle visually
  // sits on the map point.
  const wrapper = document.createElement('div')
  wrapper.style.cssText = 'width:56px;display:flex;flex-direction:column;align-items:center;gap:3px;cursor:default;'

  // "You" label — above the circle
  const label = document.createElement('span')
  label.textContent = 'You'
  label.style.cssText = [
    'font-size:10px',
    'color:rgba(240,239,235,0.5)',
    'font-family:var(--font-dm-sans,sans-serif)',
    'letter-spacing:0.04em',
    'white-space:nowrap',
    'background:rgba(13,13,13,0.7)',
    'padding:1px 5px',
    'border-radius:4px',
  ].join(';')

  // visual circle with purple ring — at the bottom, sitting on the map point
  const circle = document.createElement('div')
  circle.style.cssText = [
    'width:46px',
    'height:46px',
    'border-radius:50%',
    'background:#1a1a1a',
    'border:3px solid #8B5CF6',
    'box-shadow:0 0 0 6px rgba(139,92,246,0.25),0 0 20px rgba(139,92,246,0.4)',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'font-size:18px',
  ].join(';')
  circle.textContent = '📍'

  wrapper.appendChild(label)
  wrapper.appendChild(circle)
  return wrapper
}

function isActiveToday(lastActive: string | null): boolean {
  if (!lastActive) return false
  return Date.now() - new Date(lastActive).getTime() < 86400000
}

function createPinEl(musician: NearbyMusician, selected: boolean): HTMLElement {
  const active = isActiveToday(musician.last_active)
  const size = selected ? 52 : 44

  const baseShadow = selected
    ? `0 0 0 5px rgba(255,92,0,0.35),0 0 24px rgba(255,92,0,0.60)`
    : active
    ? `0 0 0 3px rgba(255,92,0,0.28),0 0 14px rgba(255,92,0,0.45)`
    : `0 0 0 2px rgba(240,239,235,0.12),0 0 8px rgba(0,0,0,0.45)`
  const hoverShadow = `0 0 0 6px rgba(255,92,0,0.40),0 0 32px rgba(255,92,0,0.70)`
  const borderColor = selected ? '#FF5C00' : active ? 'rgba(255,92,0,0.60)' : 'rgba(240,239,235,0.20)'

  // wrapper: Mapbox applies transform here — never mutate wrapper's transform
  const wrapper = document.createElement('div')
  wrapper.style.cssText = [`width:${size}px`, `height:${size}px`, 'position:relative', 'cursor:pointer'].join(';')

  // outer: safe to apply hover transforms here
  const outer = document.createElement('div')
  outer.style.cssText = [
    'width:100%',
    'height:100%',
    'border-radius:50%',
    `border:2px solid ${borderColor}`,
    'overflow:hidden',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'font-size:20px',
    'background:#1C1C1C',
    `box-shadow:${baseShadow}`,
    `transform:scale(${selected ? 1.12 : 1})`,
    'transition:transform 0.15s ease,box-shadow 0.15s ease',
  ].join(';')

  wrapper.addEventListener('mouseenter', () => {
    outer.style.transform = `scale(${selected ? 1.28 : 1.2})`
    outer.style.boxShadow = hoverShadow
  })
  wrapper.addEventListener('mouseleave', () => {
    outer.style.transform = `scale(${selected ? 1.12 : 1})`
    outer.style.boxShadow = baseShadow
  })

  if (musician.avatar_url) {
    const img = document.createElement('img')
    img.src = musician.avatar_url
    img.alt = musician.display_name ?? ''
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;pointer-events:none;'
    outer.appendChild(img)
  } else {
    outer.textContent = INSTRUMENT_EMOJI[musician.instruments[0]] ?? '🎵'
  }

  wrapper.appendChild(outer)
  return wrapper
}

export default function MapView({ musicians, selectedId, onPinClick, center, filters, userLocation }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<{ marker: mapboxgl.Marker; id: string }[]>([])
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const initialCenterSet = useRef(false)

  // ── Initialise map once ────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    if (!TOKEN) {
      console.error('[MapView] NEXT_PUBLIC_MAPBOX_TOKEN is not set')
      return
    }

    mapboxgl.accessToken = TOKEN

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: MADRID,
      zoom: 13,
      pitchWithRotate: false,
      attributionControl: false,
    })

    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left')
    mapRef.current = map

    return () => {
      markersRef.current.forEach(({ marker }) => marker.remove())
      markersRef.current = []
      userMarkerRef.current?.remove()
      userMarkerRef.current = null
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
      if (map.isStyleLoaded()) {
        map.flyTo({ center, zoom: 13, duration: 1200, essential: true })
      } else {
        map.once('load', () => map.flyTo({ center, zoom: 13, duration: 1200, essential: true }))
      }
    } else {
      map.flyTo({ center, zoom: 13, duration: 1500, essential: true })
    }
  }, [center])

  // ── User location pin ─────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !userLocation) return

    const addUserPin = () => {
      if (userMarkerRef.current) {
        userMarkerRef.current.setLngLat(userLocation)
      } else {
        userMarkerRef.current = new mapboxgl.Marker({ element: createUserPinEl(), anchor: 'bottom' })
          .setLngLat(userLocation)
          .addTo(map)
      }
    }

    if (map.isStyleLoaded()) addUserPin()
    else map.once('load', addUserPin)
  }, [userLocation])

  // ── Sync markers ───────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const addMarkers = () => {
      const visible = musicians.filter((m) => {
        if (filters.instrument && !m.instruments.includes(filters.instrument)) return false
        if (filters.objective && m.objective !== filters.objective) return false
        return true
      })

      const visibleIds = new Set(visible.map((m) => m.id))
      markersRef.current = markersRef.current.filter(({ marker, id }) => {
        if (!visibleIds.has(id)) { marker.remove(); return false }
        return true
      })

      const existingIds = new Set(markersRef.current.map(({ id }) => id))

      for (const musician of visible) {
        // Prefer flat lat/lng from RPC; fall back to GeoJSON location field
        let pinLng: number | null = (musician.lng != null && !isNaN(musician.lng)) ? musician.lng : null
        let pinLat: number | null = (musician.lat != null && !isNaN(musician.lat)) ? musician.lat : null

        if (pinLat == null || pinLng == null) {
          const coords = parseLocation((musician as unknown as Record<string, unknown>).location)
          if (coords) { [pinLng, pinLat] = coords }
        }

        if (pinLat == null || pinLng == null) {
          console.warn('[MapView] Skipping — no valid coords for:', musician.display_name)
          continue
        }

        // Validate bounds (catches zero/NaN/reversed coords)
        if (Math.abs(pinLng) > 180 || Math.abs(pinLat) > 90) {
          console.warn('[MapView] Out-of-bounds coords for', musician.display_name, { pinLng, pinLat })
          continue
        }

        console.log(`[MapView] Pin for ${musician.display_name ?? musician.id}: [${pinLng.toFixed(5)}, ${pinLat.toFixed(5)}]`)

        const isSelected = musician.id === selectedId
        const el = createPinEl(musician, isSelected)
        el.addEventListener('click', (e) => { e.stopPropagation(); onPinClick(musician) })

        if (existingIds.has(musician.id)) {
          const entry = markersRef.current.find(({ id }) => id === musician.id)!
          entry.marker.remove()
          entry.marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
            .setLngLat([pinLng, pinLat])
            .addTo(map)
        } else {
          const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
            .setLngLat([pinLng, pinLat])
            .addTo(map)
          markersRef.current.push({ marker, id: musician.id })
        }
      }
    }

    if (map.isStyleLoaded()) {
      addMarkers()
    } else {
      map.once('load', addMarkers)
    }
  }, [musicians, selectedId, filters, onPinClick])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
      }}
    />
  )
}
