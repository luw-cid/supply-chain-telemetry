import { useEffect, useMemo, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import type { TraceRouteResponse } from '../api/telemetry'
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

function extractLineCoords(data: TraceRouteResponse | null): [number, number][] {
  if (!data?.features?.length) return []
  const pts = data.features
    .filter((f) => f.geometry?.type === 'Point' && Array.isArray(f.geometry.coordinates))
    .map((f) => [Number(f.geometry.coordinates[0]), Number(f.geometry.coordinates[1])] as [number, number])
    .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat))
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
  shipment?: Record<string, unknown>
  ports?: PortRow[]
  custodyChain?: Array<Record<string, unknown>>
}

export default function TraceRouteMap({ trace, shipment, ports = [], custodyChain = [] }: TraceRouteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])
  const boundsRef = useRef<maplibregl.LngLatBounds | null>(null)
  const wasInvisibleRef = useRef<boolean>(true)
  const initialFitDoneRef = useRef<boolean>(false)

  const coords = useMemo(() => extractLineCoords(trace), [trace])
  const coordsKey = useMemo(() => JSON.stringify(coords), [coords])

  // Extract custody chain route - ports in order of ownership transfer
  const custodyRoute = useMemo(() => {
    if (!custodyChain || custodyChain.length === 0) return []
    
    console.log('🔍 Custody chain data:', custodyChain)
    
    const route: Array<{ lng: number; lat: number; portCode: string; portName: string; stepNumber: number; owner: string }> = []
    
    custodyChain.forEach((step) => {
      const handoverPort = step.handoverPort as Record<string, unknown> | undefined
      console.log('🔍 Processing step:', step.stepNumber, 'handoverPort:', handoverPort)
      
      if (handoverPort && handoverPort.latitude && handoverPort.longitude) {
        const lat = Number(handoverPort.latitude)
        const lng = Number(handoverPort.longitude)
        console.log('🔍 Coordinates:', { lat, lng, isFinite: Number.isFinite(lat) && Number.isFinite(lng) })
        
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          route.push({
            lng,
            lat,
            portCode: String(handoverPort.code || ''),
            portName: String(handoverPort.name || ''),
            stepNumber: Number(step.stepNumber || 0),
            owner: String((step.currentOwner as Record<string, unknown>)?.name || '')
          })
        }
      }
    })
    
    console.log('🗺️ Final custody route:', route)
    return route
  }, [custodyChain])

  const custodyRouteKey = useMemo(() => JSON.stringify(custodyRoute), [custodyRoute])

  const portPoints = useMemo(() => {
    const relevantPortCodes = new Set([
      shipment?.OriginPortCode,
      shipment?.DestinationPortCode,
      shipment?.CurrentPortCode,
    ].filter(Boolean))

    return ports
      .filter((p) => relevantPortCodes.has(p.PortCode) && p.Latitude != null && p.Longitude != null && !Number.isNaN(Number(p.Latitude)))
      .map((p) => {
        const roles = []
        if (p.PortCode === shipment?.OriginPortCode) roles.push('Cảng đi')
        if (p.PortCode === shipment?.DestinationPortCode) roles.push('Cảng đến')
        if (p.PortCode === shipment?.CurrentPortCode) roles.push('Hiện tại')
        return {
          id: p.PortCode,
          label: p.Name,
          lng: Number(p.Longitude),
          lat: Number(p.Latitude),
          country: p.Country,
          status: p.Status,
          roles,
        }
      })
  }, [ports, shipment])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const apiKey = import.meta.env.VITE_MAPTILER_API_KEY?.trim() ?? ''
    const mapId = import.meta.env.VITE_MAPTILER_MAP_ID?.trim() || 'streets-v2'
    const useMapTiler = Boolean(apiKey)

    const start = coords[0] ?? (portPoints.length > 0 ? [portPoints[0].lng, portPoints[0].lat] : [105, 15])
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: useMapTiler ? mapTilerStyleUrl(apiKey, mapId) : fallbackStyle,
      center: start as [number, number],
      zoom: coords.length ? 4 : 2,
      attributionControl: useMapTiler ? undefined : false,
    })
    mapRef.current = map

    wasInvisibleRef.current = mapContainerRef.current.clientWidth === 0

    const ro = new ResizeObserver(() => {
      map.resize()
      
      const isVisible = mapContainerRef.current && mapContainerRef.current.clientWidth > 0 && mapContainerRef.current.clientHeight > 0
      if (wasInvisibleRef.current && isVisible && boundsRef.current && !initialFitDoneRef.current) {
        setTimeout(() => {
          if (boundsRef.current) {
            map.fitBounds(boundsRef.current, { padding: 56, duration: 0, maxZoom: 12 })
            initialFitDoneRef.current = true
          }
        }, 100)
        wasInvisibleRef.current = false
      } else if (!isVisible) {
        wasInvisibleRef.current = true
      }
    })
    ro.observe(mapContainerRef.current)

    return () => {
      ro.disconnect()
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const apply = () => {
      const line = coords

      markersRef.current.forEach(m => m.remove())
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
              <p class="text-xs mb-1"><strong>Vai trò:</strong> ${p.roles.join(', ')}</p>
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

      if (line.length > 0) {
        const src = map.getSource('trace-route') as maplibregl.GeoJSONSource | undefined
        if (line.length > 1) {
          const geo = {
            type: 'FeatureCollection' as const,
            features: [
              {
                type: 'Feature' as const,
                geometry: { type: 'LineString' as const, coordinates: line },
                properties: {},
              },
              ...(trace?.features ?? [])
                .filter(f => {
                  const c = (f.geometry as any).coordinates
                  return Array.isArray(c) && c.length >= 2 && Number.isFinite(Number(c[0])) && Number.isFinite(Number(c[1]))
                })
                .map(f => ({
                  ...f,
                  type: 'Feature' as const,
                  geometry: {
                    type: 'Point' as const,
                    coordinates: [Number((f.geometry as any).coordinates[0]), Number((f.geometry as any).coordinates[1])] as [number, number]
                  }
                }))
            ],
          }
          if (src) {
            src.setData(geo)
          } else {
            map.addSource('trace-route', { type: 'geojson', data: geo })
            
            // Draw the line path
            map.addLayer({
              id: 'trace-line',
              type: 'line',
              source: 'trace-route',
              filter: ['==', '$type', 'LineString'],
              layout: { 'line-cap': 'round', 'line-join': 'round' },
              paint: { 'line-color': '#0284c7', 'line-width': 4, 'line-opacity': 0.8 },
            })
            
            // Draw directional arrows along the line
            map.addLayer({
              id: 'trace-line-arrows',
              type: 'symbol',
              source: 'trace-route',
              filter: ['==', '$type', 'LineString'],
              layout: {
                'symbol-placement': 'line',
                'symbol-spacing': 80,
                'text-field': '▶',
                'text-size': 14,
                'text-keep-upright': false
              },
              paint: {
                'text-color': '#0369a1',
                'text-halo-color': '#ffffff',
                'text-halo-width': 1
              }
            })

            // Draw individual telemetry points
            map.addLayer({
              id: 'trace-points',
              type: 'circle',
              source: 'trace-route',
              filter: ['==', '$type', 'Point'],
              paint: {
                'circle-radius': 5,
                'circle-color': [
                  'case',
                  ['==', ['get', 'severity'], 'CRITICAL'], '#dc2626',
                  ['==', ['get', 'severity'], 'HIGH'], '#ea580c',
                  ['==', ['get', 'violation_level'], 'CRITICAL'], '#dc2626',
                  ['==', ['get', 'violation_level'], 'HIGH'], '#ea580c',
                  '#ffffff'
                ],
                'circle-stroke-width': 2,
                'circle-stroke-color': [
                  'case',
                  ['==', ['get', 'severity'], 'CRITICAL'], '#991b1b',
                  ['==', ['get', 'severity'], 'HIGH'], '#9a3412',
                  ['==', ['get', 'violation_level'], 'CRITICAL'], '#991b1b',
                  ['==', ['get', 'violation_level'], 'HIGH'], '#9a3412',
                  '#0284c7'
                ],
              },
            })

            // Interactive popups for points
            map.on('click', 'trace-points', (e) => {
              if (!e.features?.[0]) return
              const p = e.features[0].properties
              const coords = (e.features[0].geometry as any).coordinates
              
              const timeStr = p.time || p.timestamp || p.recorded_at
              const time = timeStr ? new Date(timeStr).toLocaleString('vi-VN') : 'Không rõ'
              const temp = p.temp !== undefined && p.temp !== null ? `${Number(p.temp).toFixed(1)}°C` : 'N/A'
              const hum = p.humidity !== undefined && p.humidity !== null ? `${Number(p.humidity).toFixed(1)}%` : 'N/A'
              const sev = p.severity || p.violation_level || 'NORMAL'
              
              new maplibregl.Popup({ offset: 10, closeButton: true })
                .setLngLat(coords)
                .setHTML(`
                  <div class="p-1 min-w-[160px] text-slate-800">
                    <h4 class="font-bold text-sm mb-2 border-b pb-1">Chi tiết đo lường</h4>
                    <p class="text-xs mb-1"><strong>Thời gian:</strong> ${time}</p>
                    <p class="text-xs mb-1"><strong>Nhiệt độ:</strong> ${temp}</p>
                    <p class="text-xs mb-1"><strong>Độ ẩm:</strong> ${hum}</p>
                    <p class="text-xs"><strong>Trạng thái:</strong> <span class="${sev !== 'NORMAL' ? 'text-red-600 font-semibold' : 'text-green-600 font-medium'}">${sev}</span></p>
                  </div>
                `)
                .addTo(map)
            })

            map.on('mouseenter', 'trace-points', () => {
              map.getCanvas().style.cursor = 'pointer'
            })
            map.on('mouseleave', 'trace-points', () => {
              map.getCanvas().style.cursor = ''
            })
          }
        } else if (src) {
          src.setData({ type: 'FeatureCollection' as const, features: [] })
        }

        const last = line[line.length - 1]
        const alarm = lastSeverity(trace) === 'alarm'
        
        const el = document.createElement('div')
        el.className = (alarm ? 'map-marker map-marker-alarm-pulse is-alarm' : 'map-marker is-normal') + ' cursor-pointer'
        
        const statusColor = alarm ? 'text-red-600' : 'text-green-600'
        const alarmReasonStr = shipment?.AlarmReason ? `<p class="text-xs mb-1 text-red-500"><strong>Lý do:</strong> ${shipment.AlarmReason}</p>` : ''
        
        const popup = new maplibregl.Popup({ offset: 15, closeButton: true, maxWidth: '250px' })
          .setHTML(`
            <div class="p-1 min-w-[150px] text-slate-800">
              <h4 class="font-bold text-sm mb-1 border-b pb-1">Vị trí hiện tại</h4>
              <p class="text-xs mb-1"><strong>Trạng thái:</strong> <span class="${statusColor} font-semibold">${alarm ? 'ALARM' : 'NORMAL'}</span></p>
              ${alarmReasonStr}
              <p class="text-xs mb-1"><strong>Lô hàng:</strong> ${shipment?.ShipmentID ?? ''}</p>
            </div>
          `)

        const shipmentMarker = new maplibregl.Marker({ element: el })
          .setLngLat(last)
          .setPopup(popup)
          .addTo(map)
          
        markersRef.current.push(shipmentMarker)

        const bounds = line.reduce(
          (acc, c) => acc.extend(c),
          new maplibregl.LngLatBounds(line[0], line[0]),
        )
        portPoints.forEach(p => bounds.extend([p.lng, p.lat]))
        boundsRef.current = bounds
        
        if (mapContainerRef.current && mapContainerRef.current.clientWidth > 0 && mapContainerRef.current.clientHeight > 0) {
          map.fitBounds(bounds, { padding: 56, duration: 700, maxZoom: 12 })
          initialFitDoneRef.current = true
        }
      } else if (portPoints.length > 0) {
        // Center on ports if no route available
        const bounds = portPoints.reduce(
          (acc, c) => acc.extend([c.lng, c.lat]),
          new maplibregl.LngLatBounds([portPoints[0].lng, portPoints[0].lat], [portPoints[0].lng, portPoints[0].lat]),
        )
        boundsRef.current = bounds
        
        if (mapContainerRef.current && mapContainerRef.current.clientWidth > 0 && mapContainerRef.current.clientHeight > 0) {
          map.fitBounds(bounds, { padding: 56, duration: 700, maxZoom: 8 })
          initialFitDoneRef.current = true
        }
      }

      // Draw custody chain route
      if (custodyRoute.length > 1) {
        const custodySrc = map.getSource('custody-route') as maplibregl.GeoJSONSource | undefined
        const custodyLineCoords = custodyRoute.map(r => [r.lng, r.lat] as [number, number])
        
        // Check if all points are the same (all transfers at same port)
        const allSameLocation = custodyRoute.every(r => 
          r.lng === custodyRoute[0].lng && r.lat === custodyRoute[0].lat
        )
        
        console.log('🗺️ Custody route visualization:', {
          pointCount: custodyRoute.length,
          allSameLocation,
          points: custodyRoute
        })
        
        const custodyGeo = {
          type: 'FeatureCollection' as const,
          features: [
            // Only add line if points are different
            ...(!allSameLocation ? [{
              type: 'Feature' as const,
              geometry: { type: 'LineString' as const, coordinates: custodyLineCoords },
              properties: {},
            }] : []),
            ...custodyRoute.map((r, idx) => ({
              type: 'Feature' as const,
              geometry: { type: 'Point' as const, coordinates: [r.lng, r.lat] as [number, number] },
              properties: {
                stepNumber: r.stepNumber,
                portCode: r.portCode,
                portName: r.portName,
                owner: r.owner,
                isFirst: idx === 0,
                isLast: idx === custodyRoute.length - 1,
                // Add offset for overlapping points
                offsetIndex: allSameLocation ? idx : 0
              }
            }))
          ]
        }

        if (custodySrc) {
          custodySrc.setData(custodyGeo)
        } else {
          map.addSource('custody-route', { type: 'geojson', data: custodyGeo })
          
          // Draw custody chain line only if points are different
          if (!allSameLocation) {
            map.addLayer({
              id: 'custody-line',
              type: 'line',
              source: 'custody-route',
              filter: ['==', '$type', 'LineString'],
              layout: { 'line-cap': 'round', 'line-join': 'round' },
              paint: { 
                'line-color': '#f59e0b', 
                'line-width': 3, 
                'line-opacity': 0.9,
                'line-dasharray': [2, 2]
              },
            })
          }

          // Draw custody transfer points
          map.addLayer({
            id: 'custody-points',
            type: 'circle',
            source: 'custody-route',
            filter: ['==', '$type', 'Point'],
            paint: {
              'circle-radius': 8,
              'circle-color': '#f59e0b',
              'circle-stroke-width': 3,
              'circle-stroke-color': '#ffffff',
            },
          })

          // Add step numbers as labels
          map.addLayer({
            id: 'custody-labels',
            type: 'symbol',
            source: 'custody-route',
            filter: ['==', '$type', 'Point'],
            layout: {
              'text-field': ['get', 'stepNumber'],
              'text-size': 12,
              'text-offset': [0, 0],
            },
            paint: {
              'text-color': '#ffffff',
            }
          })

          // Interactive popups for custody points
          map.on('click', 'custody-points', (e) => {
            if (!e.features?.[0]) return
            const p = e.features[0].properties
            const coords = (e.features[0].geometry as any).coordinates
            
            const sameLocationNote = allSameLocation 
              ? '<p class="text-xs mt-2 text-amber-600 italic">⚠️ Tất cả bàn giao tại cùng cảng</p>' 
              : ''
            
            new maplibregl.Popup({ offset: 10, closeButton: true })
              .setLngLat(coords)
              .setHTML(`
                <div class="p-2 min-w-[180px] text-slate-800">
                  <h4 class="font-bold text-sm mb-2 border-b pb-1 text-amber-600">Bàn giao #${p.stepNumber}</h4>
                  <p class="text-xs mb-1"><strong>Cảng:</strong> ${p.portName} (${p.portCode})</p>
                  <p class="text-xs mb-1"><strong>Chủ sở hữu:</strong> ${p.owner}</p>
                  ${sameLocationNote}
                </div>
              `)
              .addTo(map)
          })

          map.on('mouseenter', 'custody-points', () => {
            map.getCanvas().style.cursor = 'pointer'
          })
          map.on('mouseleave', 'custody-points', () => {
            map.getCanvas().style.cursor = ''
          })
        }

        // Update bounds to include custody route
        if (boundsRef.current) {
          custodyRoute.forEach(r => boundsRef.current!.extend([r.lng, r.lat]))
        } else {
          const bounds = custodyRoute.reduce(
            (acc, r) => acc.extend([r.lng, r.lat]),
            new maplibregl.LngLatBounds([custodyRoute[0].lng, custodyRoute[0].lat], [custodyRoute[0].lng, custodyRoute[0].lat])
          )
          boundsRef.current = bounds
          
          if (mapContainerRef.current && mapContainerRef.current.clientWidth > 0 && mapContainerRef.current.clientHeight > 0) {
            map.fitBounds(bounds, { padding: 56, duration: 700, maxZoom: 8 })
            initialFitDoneRef.current = true
          }
        }
      } else if (custodyRoute.length > 0) {
        // Remove custody route if only one point
        const custodySrc = map.getSource('custody-route') as maplibregl.GeoJSONSource | undefined
        if (custodySrc) {
          custodySrc.setData({ type: 'FeatureCollection' as const, features: [] })
        }
      }
    }

    if (map.isStyleLoaded()) {
      apply()
    } else {
      map.once('load', apply)
    }
  }, [coordsKey, trace, portPoints, custodyRouteKey, custodyRoute])

  // Additional effect to handle visibility changes and ensure map renders correctly
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapContainerRef.current) return

    const checkAndResize = () => {
      const container = mapContainerRef.current
      if (!container) return
      
      const isVisible = container.clientWidth > 0 && container.clientHeight > 0
      
      console.log('🗺️ TraceRouteMap visibility check:', {
        isVisible,
        width: container.clientWidth,
        height: container.clientHeight,
        hasBounds: !!boundsRef.current,
        initialFitDone: initialFitDoneRef.current
      })
      
      if (isVisible) {
        map.resize()
        
        // If we have bounds and haven't done initial fit yet, do it now
        if (boundsRef.current && !initialFitDoneRef.current) {
          console.log('🗺️ Fitting bounds after visibility change')
          setTimeout(() => {
            if (boundsRef.current) {
              map.fitBounds(boundsRef.current, { padding: 56, duration: 300, maxZoom: 12 })
              initialFitDoneRef.current = true
            }
          }, 150)
        }
      }
    }

    // Check immediately
    checkAndResize()

    // Also check after a short delay to handle tab switching
    const timer = setTimeout(checkAndResize, 200)

    return () => clearTimeout(timer)
  }, [coordsKey]) // Re-run when coords change

  return (
    <div className="relative h-full w-full overflow-hidden rounded-md border border-slate-800">
      <div ref={mapContainerRef} className="absolute inset-0 h-full w-full" />
      {coords.length === 0 && custodyRoute.length === 0 && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="bg-slate-900/80 backdrop-blur-sm p-3 rounded-lg border border-slate-700 shadow-lg pointer-events-auto">
            <p className="text-white text-sm">Chưa có dữ liệu hành trình để vẽ bản đồ</p>
          </div>
        </div>
      )}
      {custodyRoute.length > 1 && custodyRoute.every(r => r.lng === custodyRoute[0].lng && r.lat === custodyRoute[0].lat) && (
        <div className="absolute top-4 left-4 z-10 pointer-events-none">
          <div className="bg-amber-500/90 backdrop-blur-sm px-3 py-2 rounded-lg border border-amber-600 shadow-lg pointer-events-auto">
            <p className="text-white text-xs font-medium">⚠️ Tất cả bàn giao xảy ra tại cùng một cảng</p>
          </div>
        </div>
      )}
    </div>
  )
}
