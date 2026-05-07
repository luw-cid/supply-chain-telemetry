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
  ResolutionNote?: string | null
  ResolvedBy?: string | null
  ResolvedAtUTC?: string | null
  CreatedAtUTC: string
  ShipmentStatus?: string
}

export async function listAlarms(params: {
  status?: string
  severity?: string
  alarmType?: string
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

export async function createAlarm(params: {
  shipmentId: string
  alarmType?: string
  severity?: string
  alarmReason?: string
  source?: string
}) {
  const { data } = await api.post<{ success: boolean; data: unknown }>('/api/v1/alarms', params)
  return data
}

export async function updateAlarm(alarmId: string, status: 'ACKNOWLEDGED' | 'RESOLVED' | 'FALSE_ALARM', resolutionNote?: string | null) {
  const { data } = await api.patch<{ success: boolean; data: unknown }>(`/api/v1/alarms/${alarmId}`, { status, resolutionNote })
  return data
}
