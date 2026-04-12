import { useEffect, useMemo, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import type { TraceRouteResponse } from '../api/telemetry'
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

function extractLineCoords(data: TraceRouteResponse | null): [number, number][] {
  if (!data?.features?.length) return []
  const pts = data.features
    .filter((f) => f.geometry?.type === 'Point' && Array.isArray(f.geometry.coordinates))
    .map((f) => f.geometry.coordinates as [number, number])
  return pts
}

function lastSeverity(data: TraceRouteResponse | null): 'alarm' | 'normal' {
  const feats = data?.features ?? []
  for (let i = feats.length - 1; i >= 0; i--) {
    const sev = feats[i].properties?.severity ?? feats[i].properties?.violation_level
    if (sev === 'CRITICAL' || sev === 'HIGH') return 'alarm'
  }
  return 'normal'
}

interface TraceRouteMapProps {
  trace: TraceRouteResponse | null
}

export default function TraceRouteMap({ trace }: TraceRouteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markerRef = useRef<mapboxgl.Marker | null>(null)

  const coords = useMemo(() => extractLineCoords(trace), [trace])
  const coordsKey = useMemo(() => JSON.stringify(coords), [coords])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const apiKey = import.meta.env.VITE_MAPTILER_API_KEY?.trim() ?? ''
    const mapId = import.meta.env.VITE_MAPTILER_MAP_ID?.trim() || 'streets-v2'
    const useMapTiler = Boolean(apiKey)
    if (useMapTiler) mapboxgl.accessToken = apiKey

    const start = coords[0] ?? [105, 15]
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: useMapTiler ? mapTilerStyleUrl(apiKey, mapId) : fallbackStyle,
      center: start,
      zoom: coords.length ? 4 : 2,
      attributionControl: useMapTiler,
    })
    mapRef.current = map

    return () => {
      markerRef.current?.remove()
      markerRef.current = null
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const apply = () => {
      const line = coords
      if (line.length === 0) return

      const src = map.getSource('trace-route') as mapboxgl.GeoJSONSource | undefined
      const geo = {
        type: 'Feature' as const,
        geometry: { type: 'LineString' as const, coordinates: line },
        properties: {},
      }
      if (src) {
        src.setData(geo)
      } else {
        map.addSource('trace-route', { type: 'geojson', data: geo })
        map.addLayer({
          id: 'trace-line',
          type: 'line',
          source: 'trace-route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#0284c7', 'line-width': 4, 'line-opacity': 0.9 },
        })
      }

      const last = line[line.length - 1]
      const alarm = lastSeverity(trace) === 'alarm'
      if (markerRef.current) {
        markerRef.current.remove()
        markerRef.current = null
      }
      const el = document.createElement('div')
      el.className = alarm ? 'map-marker is-alarm' : 'map-marker is-normal'
      markerRef.current = new mapboxgl.Marker({ element: el }).setLngLat(last).addTo(map)

      const bounds = line.reduce(
        (acc, c) => acc.extend(c),
        new mapboxgl.LngLatBounds(line[0], line[0]),
      )
      map.fitBounds(bounds, { padding: 56, duration: 700 })
    }

    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  }, [coordsKey, trace])

  return (
    <div className="relative h-full min-h-[480px] w-full overflow-hidden rounded-md border border-slate-800">
      <div ref={mapContainerRef} className="h-full w-full" />
    </div>
  )
}
