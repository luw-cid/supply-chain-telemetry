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
  AcknowledgedBy: string | null
  AcknowledgedAtUTC: string | null
  AssignedTo: string | null
  AssignedAtUTC: string | null
  ResolvedBy: string | null
  ResolvedAtUTC: string | null
  CreatedAtUTC: string
  ShipmentStatus?: string
  AlarmAgeHours?: number
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

export async function acknowledgeAlarm(alarmEventId: string) {
  const { data } = await api.patch<{ success: boolean; data: unknown }>(
    `/api/v1/alarms/${alarmEventId}/ack`,
  )
  return data
}

export async function assignAlarm(alarmEventId: string, assignedTo: string) {
  const { data } = await api.patch<{ success: boolean; data: unknown }>(
    `/api/v1/alarms/${alarmEventId}/assign`,
    { assignedTo },
  )
  return data
}

export async function resolveAlarm(alarmEventId: string, resolution: string, newStatus?: string) {
  const { data } = await api.patch<{ success: boolean; data: unknown }>(
    `/api/v1/alarms/${alarmEventId}/resolve`,
    { resolution, newStatus: newStatus || 'RESOLVED' },
  )
  return data
}

export async function getAlarmStats() {
  const { data } = await api.get<{ success: boolean; data: Record<string, unknown> }>(
    '/api/v1/alarms/stats',
  )
  return data.data
}
