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
    location: { lat?: number; lng?: number; label?: string } | null
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
  return { logs: data.data.logs, pagination: data.pagination }
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
