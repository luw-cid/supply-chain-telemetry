import { useQuery } from '@tanstack/react-query'
import { Alert, Card, Col, Row, Select, Space, Spin, Statistic, Typography } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getTelemetryLogs, getTraceRoute } from '../api/telemetry'
import { listShipments, type ShipmentListItem } from '../api/shipments'
import { getTrackingEvents } from '../api/tracking'
import RouteMap from '../components/RouteMap'
import StatusBadge from '../components/StatusBadge'
import TemperatureChart from '../components/TemperatureChart'
import type { ShipmentStatus, TelemetryPoint } from '../types'
import { useThemeMode } from '../contexts/ThemeContext'
import { getApiErrorMessage } from '../api/client'

function uiStatusFromShipment(s: ShipmentListItem | undefined): ShipmentStatus {
  // BUG #6 FIX: xử lý đủ cả 3 trạng thái: ALARM > VIOLATION > NORMAL
  if (s?.Status === 'ALARM') return 'ALARM'
  // LastTelemetryStatus = 'VIOLATION' khi nhiệt vượt ngưỡng nhưng chưa trigger ALARM
  if (s?.LastTelemetryStatus === 'VIOLATION') return 'VIOLATION'
  return 'NORMAL'
}

export default function TrackingMapPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const shipmentIdFromQuery = searchParams.get('shipmentId')
  const { isDark } = useThemeMode()
  const [selectedShipmentId, setSelectedShipmentId] = useState<string>('')

  const shipmentsQ = useQuery({
    queryKey: ['shipments', 'tracking-map'],
    queryFn: () => listShipments({ page: 1, limit: 200 }),
  })

  const shipments = shipmentsQ.data?.data ?? []

  useEffect(() => {
    if (!shipments.length) return

    const fromQuery = shipmentIdFromQuery?.trim()
    if (fromQuery && shipments.some((s) => s.ShipmentID === fromQuery)) {
      setSelectedShipmentId(fromQuery)
      return
    }

    if (!selectedShipmentId) {
      setSelectedShipmentId(shipments[0].ShipmentID)
      setSearchParams({ shipmentId: shipments[0].ShipmentID })
    }
  }, [shipmentIdFromQuery, selectedShipmentId, setSearchParams, shipments])

  const selectedShipment = useMemo(
    () => shipments.find((s) => s.ShipmentID === selectedShipmentId),
    [shipments, selectedShipmentId],
  )

  const logsQ = useQuery({
    queryKey: ['telemetry', selectedShipmentId, 'tracking'],
    queryFn: () => getTelemetryLogs(selectedShipmentId, { page: 1, limit: 800, sort: 'asc' }),
    enabled: Boolean(selectedShipmentId),
    retry: false,
    // BUG #8 FIX: refresh định kỳ để map hiển thị vị trí mới nhất từ IoT
    refetchInterval: 30_000,
  })

  // BUG #4 FIX: Chỉ gọi traceRoute khi telemetry logs chưa đủ để render route.
  // Tính từ raw logsQ.data (không phụ thuộc historyPoints) để tránh circular dependency.
  const hasEnoughLogs = (logsQ.data?.logs?.length ?? 0) > 1

  const traceQ = useQuery({
    queryKey: ['trace', selectedShipmentId],
    queryFn: () => getTraceRoute(selectedShipmentId, 800),
    enabled: Boolean(selectedShipmentId) && !hasEnoughLogs,
    retry: false,
  })

  const eventsQ = useQuery({
    queryKey: ['tracking-events', selectedShipmentId],
    queryFn: () => getTrackingEvents(selectedShipmentId, { limit: 200 }),
    enabled: Boolean(selectedShipmentId),
    retry: false,
    // BUG #8 FIX: refresh events (có thể có CUSTODY_TRANSFER mới trong quá trình vận chuyển)
    refetchInterval: 30_000,
  })

  const historyPoints = useMemo<TelemetryPoint[]>(() => {
    const status = uiStatusFromShipment(selectedShipment)
    const logs = logsQ.data?.logs ?? []
    return logs
      .map((l) => {
        // BUG #2 FIX: MongoDB lưu GeoJSON {type:'Point', coordinates:[lng,lat]}.
        // telemetry.ts đã normalize coordinates -> {lng, lat}, nhưng nếu
        // dữ liệu cũ lưu {lat, lng} thậ thì vẫn xử lý được.
        // Đọc coordinates tườ ng minh: ưu tiên {lat,lng} rồi mới fallback coordinates[]
        const raw = l.location as any
        let lat: number, lng: number
        if (raw?.coordinates?.length === 2) {
          // GeoJSON format: coordinates = [lng, lat]
          lng = Number(raw.coordinates[0])
          lat = Number(raw.coordinates[1])
        } else {
          lat = Number(raw?.lat)
          lng = Number(raw?.lng)
        }
        const temperature = Number(l.temp)
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(temperature)) return null
        return {
          lat,
          lng,
          temperature,
          timestamp: l.timestamp,
          locationLabel: raw?.label || selectedShipment?.CurrentLocation || '',
          status,
        } satisfies TelemetryPoint
      })
      .filter((x): x is TelemetryPoint => Boolean(x))
  }, [logsQ.data, selectedShipment])

  const routeCoordinates = useMemo<[number, number][]>(() => {
    const fromLogs = historyPoints.map((p) => [p.lng, p.lat] as [number, number])
    if (fromLogs.length > 1) return fromLogs

    const feats = traceQ.data?.features ?? []
    const coords = feats
      .filter((f) => f.geometry?.type === 'Point' && Array.isArray(f.geometry.coordinates))
      .map((f) => f.geometry.coordinates as [number, number])
      .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat))
    return coords
  }, [historyPoints, traceQ.data])

  const currentPoint = useMemo<TelemetryPoint>(() => {
    const status = uiStatusFromShipment(selectedShipment)
    const lastLog = historyPoints[historyPoints.length - 1]
    if (lastLog) return { ...lastLog, status }

    const lastCoord = routeCoordinates[routeCoordinates.length - 1]
    if (lastCoord) {
      return {
        lat: lastCoord[1],
        lng: lastCoord[0],
        temperature: Number.NaN,
        timestamp: new Date().toISOString(),
        locationLabel: selectedShipment?.CurrentLocation || selectedShipment?.CurrentPortCode || '',
        status,
      }
    }

    // BUG #3 FIX: Không hardcode toạ độ Việt Nam.
    // Dùng MarkerLat/MarkerLng từ shipment (tờ a độ cảng hiện tại hoặc cảng xuất phát)
    // được JOIN sẵn trong listShipments query.
    const markerLat = Number(selectedShipment?.MarkerLat)
    const markerLng = Number(selectedShipment?.MarkerLng)
    if (Number.isFinite(markerLat) && Number.isFinite(markerLng)) {
      return {
        lat: markerLat,
        lng: markerLng,
        temperature: Number.NaN,
        timestamp: new Date().toISOString(),
        locationLabel: selectedShipment?.CurrentLocation || selectedShipment?.CurrentPortCode || '',
        status,
      }
    }

    // Ultimate fallback: giữa biển, không làm chương bản đồ
    return {
      lat: 20,
      lng: 0,
      temperature: Number.NaN,
      timestamp: new Date().toISOString(),
      locationLabel: selectedShipment?.CurrentLocation || '',
      status,
    }
  }, [historyPoints, routeCoordinates, selectedShipment])

  const eventMarkers = useMemo(() => {
    const evs = eventsQ.data ?? []
    return evs
      .map((e) => {
        const coords = e.location?.coordinates
        if (!coords || coords.length !== 2) return null
        const lng = Number(coords[0])
        const lat = Number(coords[1])
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
        const label = e.label || e.port_code || 'Event'
        return { lng, lat, title: `${e.type} · ${label}` }
      })
      .filter((x): x is { lng: number; lat: number; title: string } => Boolean(x))
  }, [eventsQ.data])

  return (
    <Space orientation="vertical" size={16} className="w-full">
      <Card className="dashboard-card" styles={{ body: { padding: 14 } }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Typography.Title level={4} className="!m-0 !text-slate-100">
            Tracking Map
          </Typography.Title>

          <Select
            value={selectedShipmentId || undefined}
            style={{ width: 220 }}
            loading={shipmentsQ.isLoading}
            options={shipments.map((s) => ({ label: s.ShipmentID, value: s.ShipmentID }))}
            onChange={(value) => {
              setSelectedShipmentId(value)
              setSearchParams({ shipmentId: value })
            }}
          />
        </div>
      </Card>

      <Row gutter={16} className="min-h-[70vh]">
        <Col xs={24} lg={17}>
          <Card className="dashboard-card h-full" styles={{ body: { height: '100%' } }}>
            {shipmentsQ.isLoading && (
              <div className="min-h-[520px] flex items-center justify-center">
                <Spin />
              </div>
            )}
            {shipmentsQ.isError && (
              <Alert
                type="error"
                showIcon
                title="Không tải được danh sách shipments"
                description={getApiErrorMessage(shipmentsQ.error)}
              />
            )}
            {!shipmentsQ.isLoading && !shipmentsQ.isError && (
              <RouteMap routeCoordinates={routeCoordinates} currentPoint={currentPoint} events={eventMarkers} />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={7}>
          <Space orientation="vertical" size={16} className="w-full">
            <Card className="dashboard-card" styles={{ body: { padding: 16 } }}>
              <Space orientation="vertical" size={10} className="w-full">
                <Typography.Text className="!text-slate-400">Shipment ID</Typography.Text>
                <Typography.Title level={3} className="!m-0 !text-slate-100">
                  {selectedShipmentId || '—'}
                </Typography.Title>
                <StatusBadge status={currentPoint.status} />

                <Statistic
                  title="Current Temperature"
                  value={Number.isFinite(currentPoint.temperature) ? currentPoint.temperature : '—'}
                  precision={1}
                  suffix="°C"
                  styles={{ content: { color: '#e2e8f0' } }}
                />

                <Typography.Text className="!text-slate-300">
                  {currentPoint.locationLabel} · {new Date(currentPoint.timestamp).toLocaleString()}
                </Typography.Text>
              </Space>
            </Card>

            <Card className="dashboard-card" styles={{ body: { padding: 16 } }}>
              <Typography.Title level={5} className={isDark ? '!text-slate-100' : '!text-slate-900'}>
                Temperature Trend
              </Typography.Title>
              {logsQ.isError && (
                <Alert
                  type="warning"
                  showIcon
                  title="Không tải được telemetry logs"
                  description={getApiErrorMessage(logsQ.error)}
                />
              )}
              <TemperatureChart points={historyPoints} compact />
            </Card>
          </Space>
        </Col>
      </Row>
    </Space>
  )
}
