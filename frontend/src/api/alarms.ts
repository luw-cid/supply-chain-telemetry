import { api } from './client'

export interface AlarmRow {
  AlarmEventID: string
  ShipmentID: string
  AlarmType: string
  Severity: string
  Status: string
  AlarmReason: string
  AlarmAtUTC: string
  Source: string
  CreatedAtUTC: string
  ShipmentStatus?: string
}

export async function listAlarms(params: {
  status?: string
  fromDate?: string
  toDate?: string
  page?: number
  limit?: number
}) {
  const { data } = await api.get<{ success: boolean; data: AlarmRow[]; meta: { total: number } }>(
    '/api/v1/alarms',
    { params },
  )
  return data
}
