import { useEffect, useMemo, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import type { PortRow } from '../api/reference'
import 'maplibre-gl/dist/maplibre-gl.css'

const fallbackStyle: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
}

function mapTilerStyleUrl(apiKey: string, mapId: string): string {
  const key = encodeURIComponent(apiKey)
  const id = encodeURIComponent(mapId)
  return `https://api.maptiler.com/maps/${id}/style.json?key=${key}`
}

function markerColor(index: number, total: number): string {
  if (index === 0) return '#22c55e'
  if (index === total - 1) return '#ef4444'
  return '#38bdf8'
}

interface LegRoutePath {
  type?: string
  coordinates?: [number, number][]
}

interface Leg {
  from_port: string
  to_port: string
  route_path?: LegRoutePath | null
}

interface RouteOptimizationMapProps {
  path: string[]
  ports: PortRow[]
  legs?: Leg[]
}

export default function RouteOptimizationMap({ path, ports, legs = [] }: RouteOptimizationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRefs = useRef<maplibregl.Marker[]>([])
  const initialized = useRef(false)

  const coordinates = useMemo(() => {
    const lookup = new Map(ports.map((port) => [port.PortCode, port]))
    return path
      .map((portCode) => {
        const port = lookup.get(portCode)
        const lng = Number(port?.Longitude)
        const lat = Number(port?.Latitude)
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
        return { portCode, lng, lat }
      })
      .filter((item): item is { portCode: string; lng: number; lat: number } => Boolean(item))
  }, [path, ports])

  // Build full route coordinates from leg route_path (real shipping waypoints) or fallback to arcs
  const routeCoords = useMemo(() => {
    // If legs have route_path waypoints, use them
    if (legs.length > 0) {
      const allCoords: [number, number][] = []
      for (let i = 0; i < legs.length; i++) {
        const leg = legs[i]
        if (leg.route_path?.coordinates && leg.route_path.coordinates.length > 0) {
          const coords = leg.route_path.coordinates as [number, number][]
          if (i > 0) coords.shift() // Remove duplicate start point with previous leg's end
          allCoords.push(...coords)
        }
      }
      if (allCoords.length > 0) return allCoords
    }

    // Fallback: generate great-circle arcs
    if (coordinates.length < 2) return []
    const all: [number, number][] = []
    for (let i = 0; i < coordinates.length - 1; i++) {
      const a = coordinates[i]
      const b = coordinates[i + 1]
      const steps = 40
      const arc: [number, number][] = []
      const segCount = i < coordinates.length - 2 ? steps : steps
      for (let j = 0; j <= segCount; j++) {
        const f = j / steps
        const lng = a.lng + (b.lng - a.lng) * f
        const lat = a.lat + (b.lat - a.lat) * f
        const lngSpan = Math.abs(b.lng - a.lng)
        if (lngSpan > 20) {
          const curve = Math.sin(f * Math.PI) * (lngSpan * 0.08)
          arc.push([lng, lat + curve])
        } else {
          arc.push([lng, lat])
        }
      }
      if (i < coordinates.length - 2) arc.pop()
      all.push(...arc)
    }
    return all
  }, [legs, coordinates])

  const coordsKey = useMemo(() => JSON.stringify(routeCoords), [routeCoords])

  useEffect(() => {
    if (!mapContainerRef.current || initialized.current) return
    initialized.current = true

    const apiKey = import.meta.env.VITE_MAPTILER_API_KEY?.trim() ?? ''
    const mapId = import.meta.env.VITE_MAPTILER_MAP_ID?.trim() || 'streets-v2'
    const useMapTiler = Boolean(apiKey)

    const center = coordinates[0] ? [coordinates[0].lng, coordinates[0].lat] as [number, number] : [105, 15]
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: useMapTiler ? mapTilerStyleUrl(apiKey, mapId) : fallbackStyle,
      center,
      zoom: coordinates.length ? 3.5 : 2,
      attributionControl: useMapTiler ? undefined : false,
    })

    mapRef.current = map

    return () => {
      markerRefs.current.forEach((marker) => marker.remove())
      markerRefs.current = []
      map.remove()
      mapRef.current = null
      initialized.current = false
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || coordinates.length === 0 || routeCoords.length === 0) return

    const apply = () => {
      markerRefs.current.forEach((marker) => marker.remove())
      markerRefs.current = []

      if (map.getLayer('route-optimization-line')) map.removeLayer('route-optimization-line')
      if (map.getLayer('route-optimization-glow')) map.removeLayer('route-optimization-glow')
      if (map.getSource('route-optimization')) map.removeSource('route-optimization')

      if (routeCoords.length > 1) {
        const sourceData: GeoJSON.Feature = {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: routeCoords },
          properties: {},
        }

        map.addSource('route-optimization', { type: 'geojson', data: sourceData })
        map.addLayer({
          id: 'route-optimization-glow',
          type: 'line',
          source: 'route-optimization',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#38bdf8', 'line-width': 8, 'line-opacity': 0.12 },
        })
        map.addLayer({
          id: 'route-optimization-line',
          type: 'line',
          source: 'route-optimization',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#0ea5e9', 'line-width': 3, 'line-opacity': 0.85 },
        })
      }

      coordinates.forEach((coord, index) => {
        const el = document.createElement('div')
        el.className = 'map-marker map-marker-port'
        el.style.width = index === 0 || index === coordinates.length - 1 ? '22px' : '14px'
        el.style.height = el.style.width
        el.style.borderRadius = '999px'
        el.style.border = index === 0 || index === coordinates.length - 1 ? '3px solid #e2e8f0' : '2px solid #e2e8f0'
        el.style.background = markerColor(index, coordinates.length)
        el.style.boxShadow = index === 0 || index === coordinates.length - 1
          ? '0 0 0 6px rgba(34, 197, 94, 0.2)'
          : '0 0 0 4px rgba(56, 189, 248, 0.15)'
        el.title = coord.portCode

        markerRefs.current.push(new maplibregl.Marker({ element: el }).setLngLat([coord.lng, coord.lat]).addTo(map))
      })

      const bounds = routeCoords.reduce(
        (acc, coord) => acc.extend(coord),
        new maplibregl.LngLatBounds(routeCoords[0], routeCoords[0]),
      )
      map.fitBounds(bounds, { padding: 56, duration: 700 })
    }

    if (map.isStyleLoaded()) {
      apply()
    } else {
      map.once('load', apply)
    }
  }, [coordsKey])

  return <div ref={mapContainerRef} className="h-[340px] w-full overflow-hidden rounded-md border border-slate-800" />
}
