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

interface RouteOptimizationMapProps {
  path: string[]
  ports: PortRow[]
}

export default function RouteOptimizationMap({ path, ports }: RouteOptimizationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRefs = useRef<maplibregl.Marker[]>([])

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

  const coordsKey = useMemo(() => JSON.stringify(coordinates), [coordinates])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

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
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || coordinates.length === 0) return

    const apply = () => {
      markerRefs.current.forEach((marker) => marker.remove())
      markerRefs.current = []

      const lineCoords = coordinates.map((c) => [c.lng, c.lat] as [number, number])
      const sourceData = {
        type: 'Feature' as const,
        geometry: { type: 'LineString' as const, coordinates: lineCoords },
        properties: {},
      }

      const source = map.getSource('route-optimization') as maplibregl.GeoJSONSource | undefined
      if (source) {
        source.setData(sourceData)
      } else {
        map.addSource('route-optimization', { type: 'geojson', data: sourceData })
        map.addLayer({
          id: 'route-optimization-line',
          type: 'line',
          source: 'route-optimization',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#0ea5e9', 'line-width': 4, 'line-opacity': 0.92 },
        })
      }

      coordinates.forEach((coord, index) => {
        const el = document.createElement('div')
        el.className = 'map-marker map-marker-port'
        el.style.width = index === 0 || index === coordinates.length - 1 ? '22px' : '16px'
        el.style.height = el.style.width
        el.style.borderRadius = '999px'
        el.style.border = '3px solid #e2e8f0'
        el.style.background = markerColor(index, coordinates.length)
        el.style.boxShadow = '0 0 0 6px rgba(2, 132, 199, 0.12)'
        el.title = coord.portCode

        markerRefs.current.push(new maplibregl.Marker({ element: el }).setLngLat([coord.lng, coord.lat]).addTo(map))
      })

      const bounds = lineCoords.reduce(
        (acc, coord) => acc.extend(coord),
        new maplibregl.LngLatBounds(lineCoords[0], lineCoords[0]),
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