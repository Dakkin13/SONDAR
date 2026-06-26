'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

export interface SpacePin {
  name: string
  neighborhood: string
  city: string
  price: string
  lat: number
  lng: number
}

interface Props {
  spaces: SpacePin[]
  centerCity: 'Madrid' | 'Berlin' | 'All'
  onSpaceClick?: (space: SpacePin) => void
}

const CITY_CENTERS: Record<'Madrid' | 'Berlin', { center: [number, number]; zoom: number }> = {
  Madrid: { center: [-3.7038, 40.4168], zoom: 12.5 },
  Berlin: { center: [13.4050, 52.5200], zoom: 11.5 },
}

function createSpaceMarker(space: SpacePin): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.style.cssText = 'display:flex;flex-direction:column;align-items:center;cursor:pointer'

  const dot = document.createElement('div')
  dot.style.cssText = [
    'width:14px;height:14px;border-radius:50%',
    'background:#FF5500',
    'border:2px solid rgba(255,255,255,0.9)',
    'box-shadow:0 0 12px rgba(255,85,0,0.8)',
    'position:relative',
  ].join(';')

  const ring = document.createElement('div')
  ring.style.cssText = [
    'position:absolute;inset:-5px;border-radius:50%',
    'border:1.5px solid rgba(255,85,0,0.4)',
    'animation:sondar-ping 2.5s ease-out infinite',
  ].join(';')
  dot.appendChild(ring)

  const label = document.createElement('div')
  label.style.cssText = [
    'margin-top:4px;padding:2px 6px;border-radius:4px',
    'background:rgba(13,13,13,0.88);border:1px solid rgba(255,85,0,0.3)',
    'font-size:9px;font-weight:600;letter-spacing:0.08em',
    'color:#F0EFEB;white-space:nowrap',
    'backdrop-filter:blur(8px)',
  ].join(';')
  label.textContent = space.name

  wrapper.appendChild(dot)
  wrapper.appendChild(label)
  return wrapper
}

export default function SpacesMap({ spaces, centerCity, onSpaceClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  // Keep a ref to onSpaceClick so the marker effect doesn't need it as a dep
  const onSpaceClickRef = useRef(onSpaceClick)
  onSpaceClickRef.current = onSpaceClick

  // ── Create map once ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    mapboxgl.accessToken = TOKEN

    const isAll = centerCity === 'All'
    const cityKey = isAll ? 'Madrid' : centerCity
    const { center, zoom } = CITY_CENTERS[cityKey as 'Madrid' | 'Berlin']

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: isAll ? [5.0, 50.0] : center,
      zoom: isAll ? 4 : zoom,
      attributionControl: false,
      logoPosition: 'bottom-right',
    })
    mapRef.current = map

    return () => {
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []
      map.remove()
      mapRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Render markers whenever spaces changes ───────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    function renderMarkers() {
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []

      spaces.forEach(space => {
        const el = createSpaceMarker(space)

        const popup = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 24,
          className: 'spaces-popup',
        }).setHTML(`
          <div style="font-family:system-ui;padding:8px 10px;background:rgba(13,13,13,0.96);border:1px solid rgba(255,85,0,0.25);border-radius:10px;min-width:140px">
            <p style="font-size:12px;font-weight:700;color:#F0EFEB;margin:0 0 2px">${space.name}</p>
            <p style="font-size:10px;color:rgba(240,239,235,0.45);margin:0 0 4px">${space.neighborhood} · ${space.city}</p>
            <p style="font-size:11px;font-weight:700;color:#FF5500;margin:0">${space.price}</p>
          </div>
        `)

        el.addEventListener('mouseenter', () => popup.addTo(map!))
        el.addEventListener('mouseleave', () => popup.remove())
        el.addEventListener('click', () => onSpaceClickRef.current?.(space))

        const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([space.lng, space.lat])
          .addTo(map!)

        markersRef.current.push(marker)
      })
    }

    if (map.loaded()) {
      renderMarkers()
    } else {
      map.once('load', renderMarkers)
    }
  }, [spaces])

  // ── Re-fly when city filter changes ─────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (centerCity === 'All') {
      map.flyTo({ center: [5.0, 50.0], zoom: 4, duration: 800 })
    } else {
      const { center, zoom } = CITY_CENTERS[centerCity]
      map.flyTo({ center, zoom, duration: 800 })
    }
  }, [centerCity])

  return (
    <div className="relative overflow-hidden rounded-2xl" style={{ height: 280 }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{ boxShadow: 'inset 0 0 32px rgba(13,13,13,0.5)' }}
      />
    </div>
  )
}
