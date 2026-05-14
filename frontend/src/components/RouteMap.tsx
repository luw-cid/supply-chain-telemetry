import { useEffect, useMemo, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import type { TelemetryPoint } from '../types'
import type { ShipmentListItem } from '../api/shipments'
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

/** SVG marker cho cảng xuất phát (xanh lá) */
const ORIGIN_MARKER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 48" width="36" height="48" aria-hidden="true">
  <path d="M18 0 C8.06 0 0 8.06 0 18 C0 30 18 48 18 48 C18 48 36 30 36 18 C36 8.06 27.94 0 18 0Z" fill="#16a34a"/>
  <path d="M18 3 C9.72 3 3 9.72 3 18 C3 28.5 18 45 18 45 C18 45 33 28.5 33 18 C33 9.72 26.28 3 18 3Z" fill="#22c55e"/>
  <circle cx="18" cy="18" r="7" fill="white" opacity="0.95"/>
  <text x="18" y="22" font-size="11" font-weight="bold" text-anchor="middle" fill="#16a34a">A</text>
</svg>`

/** SVG marker cho vị trí hiện tại */
function buildCurrentMarkerSVG(isAlarm: boolean, isViolation: boolean): string {
  const fill = isAlarm ? '#dc2626' : isViolation ? '#f97316' : '#0284c7'
  const inner = isAlarm ? '#fca5a5' : isViolation ? '#fed7aa' : '#bae6fd'
  const letter = isAlarm ? '!' : isViolation ? '~' : '▶'
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 52" width="40" height="52" aria-hidden="true">
  <path d="M20 0 C9 0 0 9 0 20 C0 34 20 52 20 52 C20 52 40 34 40 20 C40 9 31 0 20 0Z" fill="${fill}"/>
  <circle cx="20" cy="20" r="12" fill="${inner}" opacity="0.95"/>
  <text x="20" y="25" font-size="13" font-weight="bold" text-anchor="middle" fill="${fill}">${letter}</text>
</svg>`
}

interface EventMarker {
  lng: number
  lat: number
  title: string
  type?: string
  portCode?: string
  timestamp?: string
}

interface OwnershipMarker {
  lng: number
  lat: number
  stepNumber: number
  ownerName: string
  ownerType: string
  previousOwnerName: string | null
  portCode: string
  portName: string
  portCountry: string
  handoverCondition: string
  startAtUTC: string
  endAtUTC: string | null
  ownershipStatus: string
}

interface RouteMapProps {
  routeCoordinates: [number, number][]
  currentPoint: TelemetryPoint
  shipment?: ShipmentListItem
  events?: EventMarker[]
  ownershipMarkers?: OwnershipMarker[]
  /** Exact coordinates of the origin port – passed separately so the marker
   *  sits on the port, not on the first telemetry GPS fix which can differ. */
  originCoord?: [number, number] | null
}

const markerClassByStatus: Record<TelemetryPoint['status'], string> = {
  NORMAL: 'is-normal',
  VIOLATION: 'is-violation',
  ALARM: 'is-alarm',
}

function formatEventType(type?: string): string {
  if (!type) return 'Sự kiện'
  const map: Record<string, string> = {
    CUSTODY_TRANSFER: 'Bàn giao quyền sở hữu',
    PORT_ARRIVAL: 'Tàu cập cảng',
    PORT_DEPARTURE: 'Tàu rời cảng',
    ALARM: 'Cảnh báo',
    CHECKPOINT: 'Điểm kiểm tra',
  }
  return map[type] ?? type
}

function buildCurrentPopupHTML(pt: TelemetryPoint, ship?: ShipmentListItem): string {
  const isAlarm = pt.status === 'ALARM'
  const isViolation = pt.status === 'VIOLATION'
  const statusColor = isAlarm ? '#dc2626' : isViolation ? '#f97316' : '#16a34a'
  const statusLabel = isAlarm ? '🔴 ALARM' : isViolation ? '🟠 VIOLATION' : '🟢 NORMAL'
  const tempStr = Number.isFinite(pt.temperature) ? `${pt.temperature.toFixed(1)}°C` : 'N/A'
  const timeStr = pt.timestamp ? new Date(pt.timestamp).toLocaleString('vi-VN') : ''
  const alarmRow = (isAlarm && ship?.AlarmReason)
    ? `<p style="margin:3px 0;font-size:11px;color:#dc2626"><strong>Lý do:</strong> ${ship.AlarmReason}</p>`
    : ''
  const routeStr = ship ? `${ship.OriginPortName ?? ship.OriginPortCode} → ${ship.DestinationPortName ?? ship.DestinationPortCode}` : ''
  const shipperRow = ship?.ShipperName
    ? `<p style="margin:3px 0;font-size:11px;color:#0f172a"><strong>Shipper:</strong> ${ship.ShipperName}</p>`
    : ''

  return `
    <div style="padding:8px;min-width:190px;font-family:sans-serif;color:#0f172a;background:#ffffff">
      <h4 style="margin:0 0 6px;font-size:13px;font-weight:700;color:#0f172a;border-bottom:1px solid #e2e8f0;padding-bottom:4px">
        🚢 ${ship?.ShipmentID ?? 'Lô hàng'}
      </h4>
      <p style="margin:3px 0;font-size:11px;color:#0f172a"><strong>Trạng thái:</strong>
        <span style="color:${statusColor};font-weight:600">${statusLabel}</span>
      </p>
      ${alarmRow}
      <p style="margin:3px 0;font-size:11px;color:#0f172a"><strong>Nhiệt độ:</strong> ${tempStr}</p>
      ${pt.locationLabel ? `<p style="margin:3px 0;font-size:11px;color:#0f172a"><strong>Vị trí:</strong> ${pt.locationLabel}</p>` : ''}
      ${routeStr ? `<p style="margin:3px 0;font-size:11px;color:#0f172a"><strong>Tuyến:</strong> ${routeStr}</p>` : ''}
      ${shipperRow}
      ${timeStr ? `<p style="margin:3px 0;font-size:10px;color:#475569">${timeStr}</p>` : ''}
    </div>`
}

function buildOriginPopupHTML(ship?: ShipmentListItem): string {
  if (!ship) return '<div style="padding:6px;color:#0f172a;background:#ffffff">Điểm xuất phát</div>'
  return `
    <div style="padding:8px;min-width:160px;font-family:sans-serif;color:#0f172a;background:#ffffff">
      <h4 style="margin:0 0 6px;font-size:13px;font-weight:700;color:#16a34a;border-bottom:1px solid #e2e8f0;padding-bottom:4px">
        🟢 Cảng xuất phát
      </h4>
      <p style="margin:3px 0;font-size:11px;color:#0f172a"><strong>Mã cảng:</strong> ${ship.OriginPortCode}</p>
      <p style="margin:3px 0;font-size:11px;color:#0f172a"><strong>Tên cảng:</strong> ${ship.OriginPortName ?? ship.OriginPortCode}</p>
      <p style="margin:3px 0;font-size:11px;color:#0f172a"><strong>Lô hàng:</strong> ${ship.ShipmentID}</p>
      <p style="margin:3px 0;font-size:11px;color:#0f172a"><strong>Shipper:</strong> ${ship.ShipperName}</p>
    </div>`
}

function buildEventPopupHTML(e: EventMarker): string {
  const timeStr = e.timestamp ? new Date(e.timestamp).toLocaleString('vi-VN') : ''
  const typeName = formatEventType(e.type)
  return `
    <div style="padding:8px;min-width:150px;font-family:sans-serif;color:#0f172a;background:#ffffff">
      <h4 style="margin:0 0 6px;font-size:13px;font-weight:700;color:#7c3aed;border-bottom:1px solid #e2e8f0;padding-bottom:4px">
        📍 ${typeName}
      </h4>
      ${e.portCode ? `<p style="margin:3px 0;font-size:11px;color:#0f172a"><strong>Cảng:</strong> ${e.portCode}</p>` : ''}
      ${e.title && !e.portCode ? `<p style="margin:3px 0;font-size:11px;color:#0f172a">${e.title}</p>` : ''}
      ${timeStr ? `<p style="margin:3px 0;font-size:10px;color:#475569">${timeStr}</p>` : ''}
    </div>`
}

function buildOwnershipPopupHTML(m: OwnershipMarker): string {
  const isActive = m.ownershipStatus === 'ACTIVE' || m.endAtUTC === null
  const accentColor = isActive ? '#d97706' : '#64748b'
  const statusLabel = isActive ? '🟡 Đang giữ' : '⏹ Đã bàn giao'
  const startStr = new Date(m.startAtUTC).toLocaleString('vi-VN')
  const endStr = m.endAtUTC ? new Date(m.endAtUTC).toLocaleString('vi-VN') : 'Hiện tại'
  const fromRow = m.previousOwnerName
    ? `<p style="margin:3px 0;font-size:11px;color:#0f172a"><strong>Từ:</strong> ${m.previousOwnerName}</p>`
    : `<p style="margin:3px 0;font-size:11px;color:#0f172a"><em>Sở hữu ban đầu</em></p>`
  const conditionColor = m.handoverCondition === 'GOOD' ? '#16a34a' : m.handoverCondition === 'DAMAGED' ? '#dc2626' : '#f97316'

  return `
    <div style="padding:8px;min-width:180px;font-family:sans-serif;color:#0f172a;background:#ffffff">
      <h4 style="margin:0 0 6px;font-size:13px;font-weight:700;color:${accentColor};border-bottom:1px solid #e2e8f0;padding-bottom:4px">
        ⛓️ Bước #${m.stepNumber} — ${statusLabel}
      </h4>
      ${fromRow}
      <p style="margin:3px 0;font-size:11px;color:#0f172a"><strong>→ Chủ sở hữu:</strong> ${m.ownerName}</p>
      <p style="margin:3px 0;font-size:11px;color:#0f172a"><strong>Loại:</strong> ${m.ownerType}</p>
      <p style="margin:3px 0;font-size:11px;color:#0f172a"><strong>Cảng:</strong> ${m.portName || m.portCode} (${m.portCode})</p>
      <p style="margin:3px 0;font-size:11px;color:#0f172a"><strong>Điều kiện:</strong>
        <span style="color:${conditionColor};font-weight:600">${m.handoverCondition}</span>
      </p>
      <hr style="border:none;border-top:1px solid #f1f5f9;margin:5px 0"/>
      <p style="margin:3px 0;font-size:10px;color:#475569">⏱ Bắt đầu: ${startStr}</p>
      <p style="margin:3px 0;font-size:10px;color:#475569">⏹ Kết thúc: ${endStr}</p>
    </div>`
}

export default function RouteMap({ routeCoordinates, currentPoint, shipment, events = [], ownershipMarkers = [], originCoord }: RouteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const originMarkerRef = useRef<maplibregl.Marker | null>(null)
  const eventMarkersRef = useRef<maplibregl.Marker[]>([])
  const ownershipMarkersRef = useRef<maplibregl.Marker[]>([])
  const currentPointRef = useRef(currentPoint)
  const shipmentRef = useRef(shipment)
  currentPointRef.current = currentPoint
  shipmentRef.current = shipment

  // Resolved origin coord: prefer explicit prop, then first telemetry point
  const resolvedOriginCoord = useMemo<[number, number] | null>(() => {
    if (originCoord && Number.isFinite(originCoord[0]) && Number.isFinite(originCoord[1])) {
      return originCoord
    }
    return null
  }, [originCoord])

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

  // ── Khởi tạo bản đồ (chỉ chạy 1 lần) ───────────────────────────────────
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

      const pt = currentPointRef.current
      const ship = shipmentRef.current
      const isAlarm = pt.status === 'ALARM'
      const isViolation = pt.status === 'VIOLATION'

      // ── Marker vị trí hiện tại + popup ────────────────────────────────
      const markerEl = document.createElement('div')
      markerEl.className = `map-marker ${markerClassByStatus[pt.status]}`
      markerEl.style.zIndex = '3'
      markerEl.innerHTML = buildCurrentMarkerSVG(isAlarm, isViolation)
      markerEl.style.width = '40px'
      markerEl.style.height = '52px'
      markerEl.style.background = 'transparent'
      markerEl.style.border = 'none'

      const currentPopup = new maplibregl.Popup({ offset: [0, -48], closeButton: true, maxWidth: '240px' })
        .setHTML(buildCurrentPopupHTML(pt, ship))

      // Cập nhật popup mỗi lần click để lấy data mới nhất
      markerEl.addEventListener('click', () => {
        currentPopup.setHTML(buildCurrentPopupHTML(currentPointRef.current, shipmentRef.current))
      })

      markerRef.current = new maplibregl.Marker({ element: markerEl, anchor: 'bottom' })
        .setLngLat([pt.lng, pt.lat])
        .setPopup(currentPopup)
        .addTo(map)

      // ── Marker cảng xuất phát ────────────────────────────────────────────
      const originLatLng = resolvedOriginCoord ?? (safeRouteCoordinates.length > 0 ? safeRouteCoordinates[0] : null)
      if (originLatLng) {
        const originEl = document.createElement('div')
        originEl.style.width = '36px'
        originEl.style.height = '48px'
        originEl.style.cursor = 'pointer'
        originEl.style.zIndex = '10'
        originEl.style.position = 'relative'
        originEl.innerHTML = ORIGIN_MARKER_SVG

        const originPopup = new maplibregl.Popup({ offset: [0, -44], closeButton: true, maxWidth: '220px' })
          .setHTML(buildOriginPopupHTML(shipmentRef.current))

        originMarkerRef.current = new maplibregl.Marker({ element: originEl, anchor: 'bottom' })
          .setLngLat(originLatLng)
          .setPopup(originPopup)
          .addTo(map)
      }

      // ── Route line ─────────────────────────────────────────────────────
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

      // ── Fit bounds ─────────────────────────────────────────────────────
      const allCoords = [...safeRouteCoordinates, ...safeEventCoordinates]
      if (allCoords.length > 0) {
        const bounds = allCoords.reduce(
          (acc: maplibregl.LngLatBounds, coord: [number, number]) => acc.extend(coord),
          new maplibregl.LngLatBounds(allCoords[0], allCoords[0]),
        )
        map.fitBounds(bounds, { padding: 56, duration: 1200 })
      } else {
        map.flyTo({ center: [pt.lng, pt.lat], zoom: 4, duration: 800 })
      }
    })

    return () => {
      markerRef.current?.remove()
      markerRef.current = null
      originMarkerRef.current?.remove()
      originMarkerRef.current = null
      eventMarkersRef.current.forEach((m) => m.remove())
      eventMarkersRef.current = []
      ownershipMarkersRef.current.forEach((m) => m.remove())
      ownershipMarkersRef.current = []
      map.remove()
      mapRef.current = null
    }
  }, [safeRouteCoordinates, safeEventCoordinates])

  // ── Cập nhật route line + tạo/cập nhật origin marker khi coords thay đổi ──
  useEffect(() => {
    if (!mapRef.current) return
    if (safeRouteCoordinates.length === 0) return

    const map = mapRef.current
    const updateRoute = () => {
      // Route line
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

      // Origin marker: tạo mới nếu chưa có, cập nhật nếu đã có
      const originLatLng2 = resolvedOriginCoord ?? (safeRouteCoordinates.length > 0 ? safeRouteCoordinates[0] : null)
      if (originLatLng2) {
        if (!originMarkerRef.current) {
          const originEl = document.createElement('div')
          originEl.style.width = '36px'
          originEl.style.height = '48px'
          originEl.style.cursor = 'pointer'
          originEl.style.zIndex = '10'
          originEl.style.position = 'relative'
          originEl.innerHTML = ORIGIN_MARKER_SVG

          const originPopup = new maplibregl.Popup({ offset: [0, -44], closeButton: true, maxWidth: '220px' })
            .setHTML(buildOriginPopupHTML(shipmentRef.current))

          originMarkerRef.current = new maplibregl.Marker({ element: originEl, anchor: 'bottom' })
            .setLngLat(originLatLng2)
            .setPopup(originPopup)
            .addTo(map)
        } else {
          originMarkerRef.current.setLngLat(originLatLng2)
          const originPopup = originMarkerRef.current.getPopup()
          if (originPopup) originPopup.setHTML(buildOriginPopupHTML(shipmentRef.current))
          // Re-lift origin marker to top of DOM stack so it isn't hidden by later-added markers
          const originEl = originMarkerRef.current.getElement()
          originEl.parentElement?.appendChild(originEl)
        }
      }

      // Fit bounds
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

  // ── Render ownership markers (1 per step) ────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const apply = () => {
      ownershipMarkersRef.current.forEach((m) => m.remove())
      ownershipMarkersRef.current = []

      const validMarkers = ownershipMarkers
        .filter((m) => Number.isFinite(m.lng) && Number.isFinite(m.lat))

      // Group same-location ownership markers for initial fan-out
      const coordGroups: Record<string, number[]> = {}
      validMarkers.forEach((m, idx) => {
        const key = `${m.lng.toFixed(3)},${m.lat.toFixed(3)}`
        if (!coordGroups[key]) coordGroups[key] = []
        coordGroups[key].push(idx)
      })

      const OWN_RADIUS = 22
      const ownOffsets: [number, number][] = new Array(validMarkers.length).fill([0, 0])
      Object.values(coordGroups).forEach((indices) => {
        if (indices.length <= 1) return
        const count = indices.length
        indices.forEach((idx, i) => {
          const angle = (2 * Math.PI * i) / count - Math.PI / 2
          ownOffsets[idx] = [
            Math.round(Math.cos(angle) * OWN_RADIUS),
            Math.round(Math.sin(angle) * OWN_RADIUS),
          ]
        })
      })

      validMarkers.forEach((m, idx) => {
        const isActive = m.ownershipStatus === 'ACTIVE' || m.endAtUTC === null
        const bgColor = isActive ? '#d97706' : '#64748b'
        const borderColor = isActive ? '#92400e' : '#334155'

        const coordKey = `${m.lng.toFixed(3)},${m.lat.toFixed(3)}`
        const hasOverlap = (coordGroups[coordKey]?.length ?? 0) > 1
        const [ox, oy] = ownOffsets[idx]

        const el = document.createElement('div')
        el.style.cssText = [
          `width:30px`, `height:30px`,
          `border-radius:50%`,
          `background:${bgColor}`,
          `border:3px solid ${borderColor}`,
          `display:flex`, `align-items:center`, `justify-content:center`,
          `color:#ffffff`, `font-size:12px`, `font-weight:700`,
          `cursor:pointer`,
          `box-shadow:0 2px 6px rgba(0,0,0,0.35)`,
          `position:relative`,
          // Apply initial same-type fan-out via transform (event pass may update this)
          `transform:translate(${ox}px,${oy}px)`,
          hasOverlap ? `outline:2px dashed ${borderColor};outline-offset:3px` : '',
          isActive ? `animation:ownershipPulse 2s ease-in-out infinite` : '',
        ].join(';')
        el.textContent = String(m.stepNumber)
        el.title = `Bước #${m.stepNumber}: ${m.ownerName}`

        const samePortNote = hasOverlap
          ? `<p style="margin:4px 0 0;font-size:10px;color:#d97706;font-style:italic">⚠️ Nhiều bàn giao tại cùng cảng này</p>`
          : ''

        const popup = new maplibregl.Popup({ offset: 18, closeButton: true, maxWidth: '250px' })
          .setHTML(buildOwnershipPopupHTML(m) + samePortNote)

        // Use offset:[0,0]; actual position set via el.style.transform above
        const marker = new maplibregl.Marker({ element: el, anchor: 'center', offset: [0, 0] })
          .setLngLat([m.lng, m.lat])
          .setPopup(popup)
          .addTo(map)

        ownershipMarkersRef.current.push(marker)
      })
    }

    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  }, [ownershipMarkers])

  // ── Cập nhật event markers khi events thay đổi ───────────────────────
  useEffect(() => {

    const map = mapRef.current
    if (!map) return

    const apply = () => {
      eventMarkersRef.current.forEach((m) => m.remove())
      eventMarkersRef.current = []

      const validEvents = events.filter((e) => Number.isFinite(e.lng) && Number.isFinite(e.lat))

      // ── Cross-type overlap resolution ────────────────────────────────
      // Collect ALL occupied positions: ownership markers + events (+ origin/current)
      // then assign radial pixel offsets so every marker is visible.
      type SlotEntry = { type: 'ownership' | 'event' | 'pin'; idx: number }
      const posMap: Record<string, SlotEntry[]> = {}

      const addPos = (lng: number, lat: number, entry: SlotEntry) => {
        const key = `${lng.toFixed(3)},${lat.toFixed(3)}`
        if (!posMap[key]) posMap[key] = []
        posMap[key].push(entry)
      }

      // Register ownership marker positions
      ownershipMarkersRef.current.forEach((m, idx) => {
        const ll = m.getLngLat()
        addPos(ll.lng, ll.lat, { type: 'ownership', idx })
      })
      // Register event positions
      validEvents.forEach((e, idx) => addPos(e.lng, e.lat, { type: 'event', idx }))

      // Compute per-slot pixel offsets (radial fan-out)
      const EVENT_OFFSET_RADIUS = 28
      const eventOffsets: [number, number][] = validEvents.map(() => [0, 0])

      Object.values(posMap).forEach((slots) => {
        if (slots.length <= 1) return
        const total = slots.length
        slots.forEach((slot, i) => {
          const angle = (2 * Math.PI * i) / total - Math.PI / 2
          const ox = Math.round(Math.cos(angle) * EVENT_OFFSET_RADIUS)
          const oy = Math.round(Math.sin(angle) * EVENT_OFFSET_RADIUS)
          if (slot.type === 'event') {
            eventOffsets[slot.idx] = [ox, oy]
          }
          // Re-apply updated offset to already-placed ownership markers
          if (slot.type === 'ownership') {
            const owned = ownershipMarkersRef.current[slot.idx]
            if (owned) {
              // maplibre-gl Marker doesn't expose setOffset, so we move the DOM element
              const el = owned.getElement()
              el.style.transform = `translate(${ox}px,${oy}px)`
            }
          }
        })
      })

      // Place event markers with computed offsets
      validEvents.forEach((e, idx) => {
        const [ox, oy] = eventOffsets[idx]

        const outer = document.createElement('div')
        outer.title = e.title
        outer.style.cursor = 'pointer'

        const inner = document.createElement('div')
        inner.className = 'map-marker map-marker-event'
        inner.style.width = '20px'
        inner.style.height = '20px'
        inner.style.borderWidth = '2px'
        inner.style.zIndex = '3'
        inner.style.transform = 'rotate(45deg)'
        outer.appendChild(inner)

        const popup = new maplibregl.Popup({ offset: 16, closeButton: true, maxWidth: '220px' })
          .setHTML(buildEventPopupHTML(e))

        const marker = new maplibregl.Marker({ element: outer, anchor: 'center', offset: [ox, oy] })
          .setLngLat([e.lng, e.lat])
          .setPopup(popup)
          .addTo(map)
        eventMarkersRef.current.push(marker)
      })

      // Re-lift origin marker to top of DOM stack after event markers are added,
      // ensuring origin icon always renders above overlapping event diamonds
      if (originMarkerRef.current) {
        const originEl = originMarkerRef.current.getElement()
        originEl.style.zIndex = '10'
        originEl.parentElement?.appendChild(originEl)
      }
    }

    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  }, [events])

  // ── Cập nhật vị trí & trạng thái marker hiện tại ────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Nếu marker chưa được tạo (map load chưa xong), tạo mới
    if (!markerRef.current) {
      const createMarker = () => {
        if (markerRef.current) return
        const pt = currentPoint
        const isAlarm = pt.status === 'ALARM'
        const isViolation = pt.status === 'VIOLATION'

        const markerEl = document.createElement('div')
        markerEl.className = `map-marker ${markerClassByStatus[pt.status]}`
        markerEl.style.zIndex = '3'
        markerEl.innerHTML = buildCurrentMarkerSVG(isAlarm, isViolation)
        markerEl.style.width = '40px'
        markerEl.style.height = '52px'
        markerEl.style.background = 'transparent'
        markerEl.style.border = 'none'

        const popup = new maplibregl.Popup({ offset: [0, -48], closeButton: true, maxWidth: '240px' })
          .setHTML(buildCurrentPopupHTML(pt, shipmentRef.current))
        markerEl.addEventListener('click', () => {
          popup.setHTML(buildCurrentPopupHTML(currentPointRef.current, shipmentRef.current))
        })

        markerRef.current = new maplibregl.Marker({ element: markerEl, anchor: 'bottom' })
          .setLngLat([pt.lng, pt.lat])
          .setPopup(popup)
          .addTo(map)
      }
      if (map.isStyleLoaded()) createMarker()
      else map.once('load', createMarker)
      return
    }

    // Cập nhật class và vị trí
    const isAlarm = currentPoint.status === 'ALARM'
    const isViolation = currentPoint.status === 'VIOLATION'
    const markerEl = markerRef.current.getElement()
    markerEl.className = `map-marker ${markerClassByStatus[currentPoint.status]}`
    markerEl.innerHTML = buildCurrentMarkerSVG(isAlarm, isViolation)
    markerEl.style.width = '40px'
    markerEl.style.height = '52px'
    markerEl.style.background = 'transparent'
    markerEl.style.border = 'none'
    markerRef.current.setLngLat([currentPoint.lng, currentPoint.lat])
  }, [currentPoint])

  return (
    <div className="relative h-full min-h-[480px] w-full overflow-hidden rounded-md border border-slate-800">
      <style>{`
        @keyframes ownershipPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(217, 119, 6, 0.5), 0 2px 6px rgba(0,0,0,0.35); }
          50% { box-shadow: 0 0 0 8px rgba(217, 119, 6, 0), 0 2px 6px rgba(0,0,0,0.35); }
        }
      `}</style>
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* Legend */}
      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-1">
        <div className="rounded bg-slate-950/85 px-2 py-1 text-xs text-slate-300 flex items-center gap-1.5">
          <span style={{display:'inline-block',width:12,height:12,borderRadius:'50%',background:'#16a34a',flexShrink:0}}/>
          Cảng xuất phát
        </div>
        <div className="rounded bg-slate-950/85 px-2 py-1 text-xs text-slate-300 flex items-center gap-1.5">
          <span style={{display:'inline-block',width:12,height:12,borderRadius:'50%',background:'#0284c7',flexShrink:0}}/>
          Vị trí hiện tại
        </div>
        <div className="rounded bg-slate-950/85 px-2 py-1 text-xs text-slate-300 flex items-center gap-1.5">
          <span style={{display:'inline-block',width:12,height:12,borderRadius:'50%',background:'#d97706',flexShrink:0}}/>
          Sở hữu (đang giữ)
        </div>
        <div className="rounded bg-slate-950/85 px-2 py-1 text-xs text-slate-300 flex items-center gap-1.5">
          <span style={{display:'inline-block',width:12,height:12,borderRadius:'50%',background:'#64748b',flexShrink:0}}/>
          Sở hữu (đã bàn giao)
        </div>
        <div className="rounded bg-slate-950/85 px-2 py-1 text-xs text-slate-300 flex items-center gap-1.5">
          <span style={{display:'inline-block',width:10,height:10,background:'#7c3aed',transform:'rotate(45deg)',flexShrink:0}}/>
          Sự kiện vận chuyển
        </div>
      </div>

      {/* Attribution */}
      <div className="pointer-events-none absolute bottom-3 right-3 rounded bg-slate-950/85 px-3 py-1 text-xs text-slate-300">
        {import.meta.env.VITE_MAPTILER_API_KEY?.trim()
          ? 'MapTiler · route simulation'
          : 'MapLibre · route simulation (add VITE_MAPTILER_API_KEY)'}
      </div>
    </div>
  )
}
