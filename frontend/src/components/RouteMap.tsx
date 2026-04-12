import { useEffect, useMemo, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import type { Shipment, TelemetryPoint } from '../types'
import 'mapbox-gl/dist/mapbox-gl.css'

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
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markerRef = useRef<mapboxgl.Marker | null>(null)

  const routeCoordinates = useMemo(
    () => shipment.routePoints.map((point) => [point.lng, point.lat] as [number, number]),
    [shipment.routePoints],
  )

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return
    }

    const token = (import.meta as ImportMeta).env?.VITE_MAPBOX_TOKEN ?? ''
    if (token) {
      mapboxgl.accessToken = token
    }

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {},
        layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#0b1220' } }],
      },
      center: routeCoordinates[0],
      zoom: 3,
      attributionControl: false,
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
          'line-color': '#38bdf8',
          'line-width': 4,
          'line-opacity': 0.88,
        },
      })

      const markerEl = document.createElement('div')
      markerEl.className = 'map-marker'
      markerRef.current = new mapboxgl.Marker({ element: markerEl })
        .setLngLat([currentPoint.lng, currentPoint.lat])
        .addTo(map)

      const bounds = routeCoordinates.reduce(
        (acc, coord) => acc.extend(coord),
        new mapboxgl.LngLatBounds(routeCoordinates[0], routeCoordinates[0]),
      )
      map.fitBounds(bounds, { padding: 56, duration: 1200 })
    })

    return () => {
      markerRef.current?.remove()
      map.remove()
      mapRef.current = null
    }
  }, [routeCoordinates, currentPoint.lat, currentPoint.lng])

  useEffect(() => {
    if (!mapRef.current) {
      return
    }

    const map = mapRef.current
    const updateRoute = () => {
      const source = map.getSource('route') as mapboxgl.GeoJSONSource | undefined
      source?.setData({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: routeCoordinates },
        properties: {},
      })

      const bounds = routeCoordinates.reduce(
        (acc, coord) => acc.extend(coord),
        new mapboxgl.LngLatBounds(routeCoordinates[0], routeCoordinates[0]),
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
        Mapbox GL route simulation
      </div>
    </div>
  )
}
