import { useEffect, useMemo, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import type { Shipment, TelemetryPoint } from '../types'
import 'maplibre-gl/dist/maplibre-gl.css'

const fallbackStyle: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#0b1220' } }],
}

function mapTilerStyleUrl(apiKey: string, mapId: string): string {
  const key = encodeURIComponent(apiKey)
  const id = encodeURIComponent(mapId)
  return `https://api.maptiler.com/maps/${id}/style.json?key=${key}`
}

interface RouteMapProps {
  shipment: Shipment
  currentPoint: TelemetryPoint
}

const markerClassByStatus: Record<TelemetryPoint['status'], string> = {
  NORMAL: 'is-normal',
  VIOLATION: 'is-violation',
  ALARM: 'is-alarm',
}

export default function RouteMap({ shipment, currentPoint }: RouteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const currentPointRef = useRef(currentPoint)
  currentPointRef.current = currentPoint

  const routeCoordinates = useMemo(
    () => shipment.routePoints.map((point) => [point.lng, point.lat] as [number, number]),
    [shipment.routePoints],
  )

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return
    }

    const apiKey = import.meta.env.VITE_MAPTILER_API_KEY?.trim() ?? ''
    const mapId = import.meta.env.VITE_MAPTILER_MAP_ID?.trim() || 'streets-v2'
    const useMapTiler = Boolean(apiKey)

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: useMapTiler ? mapTilerStyleUrl(apiKey, mapId) : fallbackStyle,
      center: routeCoordinates[0],
      zoom: 3,
      attributionControl: useMapTiler ? undefined : false,
    })

    mapRef.current = map

    map.on('load', () => {
      map.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: routeCoordinates },
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

      const pt = currentPointRef.current
      const markerEl = document.createElement('div')
      markerEl.className = `map-marker ${markerClassByStatus[pt.status]}`
      markerRef.current = new maplibregl.Marker({ element: markerEl })
        .setLngLat([pt.lng, pt.lat])
        .addTo(map)

      const bounds = routeCoordinates.reduce(
        (acc, coord) => acc.extend(coord),
        new maplibregl.LngLatBounds(routeCoordinates[0], routeCoordinates[0]),
      )
      map.fitBounds(bounds, { padding: 56, duration: 1200 })
    })

    return () => {
      markerRef.current?.remove()
      markerRef.current = null
      map.remove()
      mapRef.current = null
    }
    // Only recreate when the route geometry changes (e.g. other shipment). Not on simulation ticks / marker moves.
  }, [routeCoordinates])

  useEffect(() => {
    if (!mapRef.current) {
      return
    }

    const map = mapRef.current
    const updateRoute = () => {
      const source = map.getSource('route') as maplibregl.GeoJSONSource | undefined
      source?.setData({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: routeCoordinates },
        properties: {},
      })

      const bounds = routeCoordinates.reduce(
        (acc, coord) => acc.extend(coord),
        new maplibregl.LngLatBounds(routeCoordinates[0], routeCoordinates[0]),
      )
      map.fitBounds(bounds, { padding: 56, duration: 900 })
    }

    if (map.isStyleLoaded()) {
      updateRoute()
    } else {
      map.once('load', updateRoute)
    }
  }, [routeCoordinates])

  useEffect(() => {
    if (!markerRef.current) {
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
