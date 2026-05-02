import { api } from './client'

export interface TelemetryLogRow {
  t: string
  temp?: number
  humidity?: number
  location?: { lat?: number; lng?: number; label?: string }
  meta?: { shipment_id?: string; device_id?: string }
}

export interface TelemetryLogsResult {
  logs: {
    timestamp: string
    device_id: string | null
    location:
      | { lat?: number; lng?: number; label?: string }
      | { type?: 'Point'; coordinates?: [number, number]; label?: string }
      | null
    temp: number
    humidity: number | null
  }[]
  pagination: { total: number; page: number; limit: number; totalPages: number; hasNext: boolean; hasPrev: boolean }
}

export async function getTelemetryLogs(
  shipmentId: string,
  params: { page?: number; limit?: number; startDate?: string; endDate?: string; sort?: string } = {},
) {
  const { data } = await api.get<{
    success: boolean
    data: { shipment_id: string; logs: TelemetryLogsResult['logs'] }
    pagination: TelemetryLogsResult['pagination']
  }>(`/api/shipments/${shipmentId}/telemetry/logs`, { params })
  const logs = (data.data.logs ?? []).map((l) => {
    const raw = l.location as unknown
    if (raw && typeof raw === 'object' && 'coordinates' in (raw as any)) {
      const coords = (raw as { coordinates?: unknown }).coordinates
      if (Array.isArray(coords) && coords.length === 2) {
        const lng = Number(coords[0])
        const lat = Number(coords[1])
        if (Number.isFinite(lng) && Number.isFinite(lat)) {
          return {
            ...l,
            location: {
              lng,
              lat,
              label: (raw as any).label,
            },
          }
        }
      }
    }
    return l
  })

  return { logs, pagination: data.pagination }
}

export interface TraceRouteResponse {
  type: string
  features: {
    type: string
    geometry: { type: string; coordinates: number[] }
    properties: Record<string, unknown>
  }[]
  metadata?: Record<string, unknown>
}

export async function getTraceRoute(shipmentId: string, maxPoints?: number) {
  const { data } = await api.get<{ success: boolean; data: TraceRouteResponse }>(
    `/api/v1/analytics/trace-route/${shipmentId}`,
    { params: maxPoints ? { maxPoints } : undefined },
  )
  return data.data
}

export async function getRouteOptimization(origin: string, destination: string, extra?: Record<string, string>) {
  const { data } = await api.get('/api/v1/analytics/route-optimization', {
    params: { origin, destination, ...extra },
    // Route optimization may return 4xx for business outcomes (e.g. no route found).
    // Let caller handle payload instead of treating it as transport failure.
    validateStatus: (status) => status < 500,
  })
  return data
}
