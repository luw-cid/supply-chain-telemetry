import { useEffect, useMemo, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import type { PortRow } from '../api/reference'
import type { ShipmentListItem } from '../api/shipments'
import { useThemeMode } from '../contexts/ThemeContext'
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
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])

  const portPoints = useMemo(
    () =>
      ports
        .filter((p) => p.Latitude != null && p.Longitude != null && !Number.isNaN(Number(p.Latitude)))
        .map((p) => ({
          id: p.PortCode,
          label: p.Name,
          lng: Number(p.Longitude),
          lat: Number(p.Latitude),
          country: p.Country,
          status: p.Status,
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
          status: s.Status,
          alarmReason: s.AlarmReason,
          shipper: s.ShipperName,
          consignee: s.ConsigneeName,
          origin: s.OriginPortCode,
          dest: s.DestinationPortCode,
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

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: useMapTiler ? mapTilerStyleUrl(apiKey, mapId) : fallbackStyle,
      center: [105, 15],
      zoom: 2,
      attributionControl: useMapTiler ? undefined : false,
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
        el.className = 'map-marker-port cursor-pointer'
        el.innerHTML = PORT_MARKER_SVG
        
        const popup = new maplibregl.Popup({ offset: 25, closeButton: true, maxWidth: '250px' })
          .setHTML(`
            <div class="p-1 min-w-[150px] text-slate-800">
              <h4 class="font-bold text-sm mb-1">${p.label}</h4>
              <p class="text-xs mb-1"><strong>Mã cảng:</strong> ${p.id}</p>
              <p class="text-xs mb-1"><strong>Quốc gia:</strong> ${p.country}</p>
              <p class="text-xs"><strong>Trạng thái:</strong> ${p.status}</p>
            </div>
          `)

        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([p.lng, p.lat])
          .setPopup(popup)
          .addTo(map)
          
        markersRef.current.push(marker)
      })

      shipmentPoints.forEach((p) => {
        const el = document.createElement('div')
        el.className = (p.alarm ? 'map-marker map-marker-alarm-pulse is-alarm' : 'map-marker is-normal') + ' cursor-pointer'
        
        const statusColor = p.alarm ? 'text-red-600' : 'text-green-600'
        const alarmInfo = p.alarm ? `<p class="text-xs mb-1 text-red-500"><strong>Lý do:</strong> ${p.alarmReason || 'Không rõ'}</p>` : ''
        
        const popup = new maplibregl.Popup({ offset: 15, closeButton: true, maxWidth: '300px' })
          .setHTML(`
            <div class="p-1 min-w-[200px] text-slate-800">
              <h4 class="font-bold text-sm mb-1 border-b pb-1">
                <a href="/shipments/${p.id}" class="text-blue-600 hover:underline">Lô hàng: ${p.id}</a>
              </h4>
              <p class="text-xs mb-1"><strong>Trạng thái:</strong> <span class="${statusColor} font-semibold">${p.status}</span></p>
              ${alarmInfo}
              <p class="text-xs mb-1"><strong>Tuyến:</strong> ${p.origin} ➔ ${p.dest}</p>
              <p class="text-xs mb-1"><strong>Shipper:</strong> ${p.shipper}</p>
              <p class="text-xs"><strong>Consignee:</strong> ${p.consignee}</p>
            </div>
          `)

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([p.lng, p.lat])
          .setPopup(popup)
          .addTo(map)
          
        markersRef.current.push(marker)
      })

      if (boundsPoints.length > 0) {
        const bounds = boundsPoints.reduce(
          (acc, pt) => acc.extend([pt.lng, pt.lat]),
          new maplibregl.LngLatBounds(
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
