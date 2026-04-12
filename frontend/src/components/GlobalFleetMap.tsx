import { useEffect, useMemo, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import type { PortRow } from '../api/reference'
import type { ShipmentListItem } from '../api/shipments'
import { useThemeMode } from '../contexts/ThemeContext'
import 'mapbox-gl/dist/mapbox-gl.css'

const fallbackStyle: mapboxgl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#0b1220' } }],
}

function mapTilerStyleUrl(apiKey: string, mapId: string): string {
  const key = encodeURIComponent(apiKey)
  const id = encodeURIComponent(mapId)
  return `https://api.maptiler.com/maps/${id}/style.json?key=${key}`
}

/** SVG: kho cảng + mặt nước + bến + cần cẩu — neo đáy giữa (mép nước) */
const PORT_MARKER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
  <rect width="64" height="64" fill="none"/>
  <rect x="2" y="44" width="60" height="16" rx="2.5" fill="#38bdf8" fill-opacity="0.45"/>
  <rect x="4" y="40" width="56" height="5" fill="#475569"/>
  <rect x="10" y="16" width="44" height="26" rx="3" fill="#0284c7" stroke="#0f172a" stroke-width="1.5"/>
  <rect x="12" y="18" width="40" height="6" rx="1" fill="#0369a1"/>
  <rect x="17" y="28" width="7" height="10" rx="1" fill="#e0f2fe"/>
  <rect x="28.5" y="28" width="7" height="10" rx="1" fill="#e0f2fe"/>
  <rect x="40" y="28" width="7" height="10" rx="1" fill="#e0f2fe"/>
  <line x1="52" y1="10" x2="52" y2="17" stroke="#ea580c" stroke-width="3" stroke-linecap="round"/>
  <line x1="52" y1="17" x2="42" y2="24" stroke="#ea580c" stroke-width="2.5" stroke-linecap="round"/>
  <circle cx="42" cy="24" r="2.5" fill="#f97316"/>
</svg>`

interface GlobalFleetMapProps {
  shipments: ShipmentListItem[]
  /** All DB ports with coordinates (dashboard overlay) */
  ports?: PortRow[]
}

export default function GlobalFleetMap({ shipments, ports = [] }: GlobalFleetMapProps) {
  const { isDark } = useThemeMode()
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])

  const portPoints = useMemo(
    () =>
      ports
        .filter((p) => p.Latitude != null && p.Longitude != null && !Number.isNaN(Number(p.Latitude)))
        .map((p) => ({
          id: p.PortCode,
          label: p.Name,
          lng: Number(p.Longitude),
          lat: Number(p.Latitude),
        })),
    [ports],
  )

  const shipmentPoints = useMemo(
    () =>
      shipments
        .filter((s) => s.MarkerLat != null && s.MarkerLng != null && !Number.isNaN(Number(s.MarkerLat)))
        .map((s) => ({
          id: s.ShipmentID,
          lng: Number(s.MarkerLng),
          lat: Number(s.MarkerLat),
          alarm: s.Status === 'ALARM',
        })),
    [shipments],
  )

  const boundsPoints = useMemo(() => {
    const out: { lng: number; lat: number }[] = []
    portPoints.forEach((p) => out.push({ lng: p.lng, lat: p.lat }))
    shipmentPoints.forEach((p) => out.push({ lng: p.lng, lat: p.lat }))
    return out
  }, [portPoints, shipmentPoints])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const apiKey = import.meta.env.VITE_MAPTILER_API_KEY?.trim() ?? ''
    const mapId = import.meta.env.VITE_MAPTILER_MAP_ID?.trim() || 'streets-v2'
    const useMapTiler = Boolean(apiKey)
    if (useMapTiler) mapboxgl.accessToken = apiKey

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: useMapTiler ? mapTilerStyleUrl(apiKey, mapId) : fallbackStyle,
      center: [105, 15],
      zoom: 2,
      attributionControl: useMapTiler,
    })
    mapRef.current = map

    return () => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const run = () => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []

      portPoints.forEach((p) => {
        const el = document.createElement('div')
        el.className = 'map-marker-port'
        el.title = `${p.label} (${p.id})`
        el.innerHTML = PORT_MARKER_SVG
        const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat([p.lng, p.lat]).addTo(map)
        markersRef.current.push(marker)
      })

      shipmentPoints.forEach((p) => {
        const el = document.createElement('div')
        el.className = p.alarm ? 'map-marker map-marker-alarm-pulse is-alarm' : 'map-marker is-normal'
        el.title = p.id
        const marker = new mapboxgl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map)
        markersRef.current.push(marker)
      })

      if (boundsPoints.length > 0) {
        const bounds = boundsPoints.reduce(
          (acc, pt) => acc.extend([pt.lng, pt.lat]),
          new mapboxgl.LngLatBounds(
            [boundsPoints[0].lng, boundsPoints[0].lat],
            [boundsPoints[0].lng, boundsPoints[0].lat],
          ),
        )
        map.fitBounds(bounds, { padding: 56, maxZoom: 8, duration: 600 })
      }
    }

    if (map.isStyleLoaded()) run()
    else map.once('load', run)
  }, [portPoints, shipmentPoints, boundsPoints])

  return (
    <div
      className={
        isDark
          ? 'relative h-full w-full min-h-[480px] overflow-hidden rounded-md border border-slate-800'
          : 'relative h-full w-full min-h-[480px] overflow-hidden rounded-md border border-slate-200'
      }
    >
      <div ref={mapContainerRef} className="absolute inset-0 h-full w-full" />
    </div>
  )
}
