import { api } from './client'

export interface DeviceRow {
  DeviceID: string
  DeviceName: string | null
  DeviceType: string
  Status: string
  FirmwareVer: string | null
  LastPingAtUTC: string | null
  Metadata: Record<string, unknown> | null
  AssignedShipmentID: string | null
  CreatedAtUTC: string
  UpdatedAtUTC: string
}

export async function listDevices(params: {
  status?: string
  search?: string
  page?: number
  limit?: number
}) {
  const { data } = await api.get<{ success: boolean; data: DeviceRow[]; meta: { total: number } }>(
    '/api/v1/devices',
    { params },
  )
  return data
}

export async function getDevice(deviceId: string) {
  const { data } = await api.get<{ success: boolean; data: DeviceRow }>(
    `/api/v1/devices/${deviceId}`,
  )
  return data.data
}

export async function createDevice(payload: {
  DeviceID: string
  DeviceName?: string
  DeviceType?: string
  FirmwareVer?: string
}) {
  const { data } = await api.post<{ success: boolean; data: unknown }>(
    '/api/v1/devices',
    payload,
  )
  return data.data
}

export async function updateDevice(
  deviceId: string,
  payload: {
    DeviceName?: string
    DeviceType?: string
    Status?: string
    FirmwareVer?: string
    Metadata?: Record<string, unknown>
  },
) {
  const { data } = await api.patch<{ success: boolean; data: unknown }>(
    `/api/v1/devices/${deviceId}`,
    payload,
  )
  return data.data
}

export async function assignDevice(deviceId: string, shipmentId: string | null) {
  const { data } = await api.post<{ success: boolean; data: unknown }>(
    `/api/v1/devices/${deviceId}/assign`,
    { shipmentId },
  )
  return data.data
}
