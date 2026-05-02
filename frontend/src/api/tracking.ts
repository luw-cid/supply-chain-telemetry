import { api } from './client'

export type TrackingEvent = {
  shipment_id: string
  type: 'CUSTODY_TRANSFER'
  t: string
  location?: { type: 'Point'; coordinates?: [number, number] }
  port_code?: string
  label?: string
  payload?: Record<string, unknown>
}

export async function getTrackingEvents(shipmentId: string, params: { limit?: number } = {}) {
  const { data } = await api.get<{ success: boolean; data: TrackingEvent[] }>(
    `/api/shipments/${shipmentId}/tracking/events`,
    { params },
  )
  return data.data
}

