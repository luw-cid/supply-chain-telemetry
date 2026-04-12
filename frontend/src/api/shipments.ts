import { api } from './client'

export interface ShipmentListItem {
  ShipmentID: string
  Status: string
  WeightKg: number
  OriginPortCode: string
  DestinationPortCode: string
  CurrentPortCode: string | null
  CurrentLocation: string | null
  LastTelemetryAtUTC: string | null
  AlarmAtUTC: string | null
  AlarmReason: string | null
  ShipperName: string
  ConsigneeName: string
  OriginPortName: string
  DestinationPortName: string
  MarkerLat: number | null
  MarkerLng: number | null
}

export interface ListShipmentsParams {
  status?: string
  search?: string
  page?: number
  limit?: number
}

export async function listShipments(params: ListShipmentsParams = {}) {
  const { data } = await api.get<{
    success: boolean
    data: ShipmentListItem[]
    meta: { total: number; page: number; limit: number }
  }>('/api/shipments', { params })
  return data
}

export interface ShipmentDetailsResponse {
  shipment: Record<string, unknown>
  route: Record<string, unknown> | null
}

export async function getShipment(id: string) {
  const { data } = await api.get<{ success: boolean; data: ShipmentDetailsResponse }>(`/api/shipments/${id}`)
  return data.data
}

export interface CreateShipmentPayload {
  CargoProfileID: string
  WeightKg: number
  ShipperPartyID: string
  ConsigneePartyID: string
  OriginPortCode: string
  DestinationPortCode: string
  ShipmentID?: string
}

export async function createShipment(body: CreateShipmentPayload) {
  const { data } = await api.post<{ success: boolean; data: unknown }>('/api/shipments', body)
  return data.data
}
