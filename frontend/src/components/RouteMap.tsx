import { useEffect, useMemo, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import type { TelemetryPoint } from '../types'
import 'maplibre-gl/dist/maplibre-gl.css'

// Match Dashboard fallback behavior: show OSM raster if no MapTiler key.
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

interface RouteMapProps {
  routeCoordinates: [number, number][]
  currentPoint: TelemetryPoint
  events?: { lng: number; lat: number; title: string }[]
}

const markerClassByStatus: Record<TelemetryPoint['status'], string> = {
  NORMAL: 'is-normal',
  VIOLATION: 'is-violation',
  ALARM: 'is-alarm',
}

export default function RouteMap({ routeCoordinates, currentPoint, events = [] }: RouteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const eventMarkersRef = useRef<maplibregl.Marker[]>([])
  const currentPointRef = useRef(currentPoint)
  currentPointRef.current = currentPoint

  const safeRouteCoordinates = useMemo(() => {
    return (routeCoordinates ?? [])
      .map(([lng, lat]: [number, number]) => [Number(lng), Number(lat)] as [number, number])
      .filter(([lng, lat]: [number, number]) => Number.isFinite(lng) && Number.isFinite(lat))
  }, [routeCoordinates])

  const safeEventCoordinates = useMemo(() => {
    return (events ?? [])
      .map((e) => [Number(e.lng), Number(e.lat)] as [number, number])
      .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat))
  }, [events])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return
    }

    const apiKey = import.meta.env.VITE_MAPTILER_API_KEY?.trim() ?? ''
    const mapId = import.meta.env.VITE_MAPTILER_MAP_ID?.trim() || 'streets-v2'
    const useMapTiler = Boolean(apiKey)

    const start = safeRouteCoordinates[0] ?? ([105, 15] as [number, number])
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: useMapTiler ? mapTilerStyleUrl(apiKey, mapId) : fallbackStyle,
      center: start,
      zoom: safeRouteCoordinates.length ? 3 : 2,
      attributionControl: useMapTiler ? undefined : false,
    })

    mapRef.current = map

    map.on('load', () => {
      // Card/layout transitions can cause 0-size on first paint; force resize once.
      requestAnimationFrame(() => map.resize())

      // Always create the current-position marker, even without route data.
      const pt = currentPointRef.current
      const markerEl = document.createElement('div')
      markerEl.className = `map-marker ${markerClassByStatus[pt.status]}`
      markerEl.style.zIndex = '2'
      markerRef.current = new maplibregl.Marker({ element: markerEl })
        .setLngLat([pt.lng, pt.lat])
        .addTo(map)

      if (safeRouteCoordinates.length > 0) {
        map.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: safeRouteCoordinates },
            properties: {},
          },
        })

        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#0284c7',
            'line-width': 4,
            'line-opacity': 0.92,
          },
        })
      }

      // Fit bounds to all available coordinates (route + events + current point)
      const allCoords = [...safeRouteCoordinates, ...safeEventCoordinates]
      if (allCoords.length > 0) {
        const bounds = allCoords.reduce(
          (acc: maplibregl.LngLatBounds, coord: [number, number]) => acc.extend(coord),
          new maplibregl.LngLatBounds(allCoords[0], allCoords[0]),
        )
        map.fitBounds(bounds, { padding: 56, duration: 1200 })
      } else {
        // No route/event data yet — center on current point
        map.flyTo({ center: [pt.lng, pt.lat], zoom: 4, duration: 800 })
      }
    })

    return () => {
      markerRef.current?.remove()
      markerRef.current = null
      eventMarkersRef.current.forEach((m) => m.remove())
      eventMarkersRef.current = []
      map.remove()
      mapRef.current = null
    }
    // Only recreate when the route geometry changes (e.g. other shipment). Not on simulation ticks / marker moves.
  }, [safeRouteCoordinates, safeEventCoordinates])

  useEffect(() => {
    if (!mapRef.current) {
      return
    }

    if (safeRouteCoordinates.length === 0) {
      return
    }

    const map = mapRef.current
    const updateRoute = () => {
      // If the route source already exists, update it; otherwise create it.
      const source = map.getSource('route') as maplibregl.GeoJSONSource | undefined
      if (source) {
        source.setData({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: safeRouteCoordinates },
          properties: {},
        })
      } else {
        map.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: safeRouteCoordinates },
            properties: {},
          },
        })
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#0284c7',
            'line-width': 4,
            'line-opacity': 0.92,
          },
        })
      }

      const allCoords = [...safeRouteCoordinates, ...safeEventCoordinates]
      if (allCoords.length > 0) {
        const bounds = allCoords.reduce(
          (acc: maplibregl.LngLatBounds, coord: [number, number]) => acc.extend(coord),
          new maplibregl.LngLatBounds(allCoords[0], allCoords[0]),
        )
        map.fitBounds(bounds, { padding: 56, duration: 900 })
      }
    }

    if (map.isStyleLoaded()) {
      updateRoute()
    } else {
      map.once('load', updateRoute)
    }
  }, [safeRouteCoordinates, safeEventCoordinates])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const apply = () => {
      eventMarkersRef.current.forEach((m) => m.remove())
      eventMarkersRef.current = []

      events
        .filter((e) => Number.isFinite(e.lng) && Number.isFinite(e.lat))
        .forEach((e) => {
          const outer = document.createElement('div')
          outer.title = e.title

          const inner = document.createElement('div')
          inner.className = 'map-marker map-marker-event'
          inner.style.width = '22px'
          inner.style.height = '22px'
          inner.style.borderWidth = '2px'
          inner.style.zIndex = '3'
          // Rotate the INNER element. MapLibre controls outer transform for positioning.
          inner.style.transform = 'rotate(45deg)'
          outer.appendChild(inner)

          const marker = new maplibregl.Marker({ element: outer, anchor: 'center' })
            .setLngLat([e.lng, e.lat])
            .addTo(map)
          eventMarkersRef.current.push(marker)
        })
    }

    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  }, [events])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // If the marker was not yet created (e.g. map load fired before data arrived),
    // create it now so the current position is always visible.
    if (!markerRef.current) {
      const createMarker = () => {
        if (markerRef.current) return // already created by another path
        const markerEl = document.createElement('div')
        markerEl.className = `map-marker ${markerClassByStatus[currentPoint.status]}`
        markerEl.style.zIndex = '2'
        markerRef.current = new maplibregl.Marker({ element: markerEl })
          .setLngLat([currentPoint.lng, currentPoint.lat])
          .addTo(map)
      }
      if (map.isStyleLoaded()) createMarker()
      else map.once('load', createMarker)
      return
    }

    const className = `map-marker ${markerClassByStatus[currentPoint.status]}`
    const markerEl = markerRef.current.getElement()
    markerEl.className = className
    markerRef.current.setLngLat([currentPoint.lng, currentPoint.lat])
  }, [currentPoint])

  return (
    <div className="relative h-full min-h-[480px] w-full overflow-hidden rounded-md border border-slate-800">
      <div ref={mapContainerRef} className="h-full w-full" />
      <div className="pointer-events-none absolute bottom-3 right-3 rounded bg-slate-950/85 px-3 py-1 text-xs text-slate-300">
        {import.meta.env.VITE_MAPTILER_API_KEY?.trim()
          ? 'MapTiler · route simulation'
          : 'MapLibre · route simulation (add VITE_MAPTILER_API_KEY)'}
      </div>
    </div>
  )
}
