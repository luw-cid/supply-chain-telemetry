import { api } from './client'

export interface AuditRow {
  AuditID: number
  TableName: string
  Operation: string
  RecordID: string
  OldValue: unknown
  NewValue: unknown
  ChangedBy: string
  ChangedAtUTC: string
  ClientIP: string | null
  UserAgent: string | null
}

export async function listAuditLogs(params: {
  fromDate?: string
  toDate?: string
  tableName?: string
  page?: number
  limit?: number
}) {
  const { data } = await api.get<{ success: boolean; data: AuditRow[]; meta: { total: number } }>(
    '/api/v1/audit/logs',
    { params },
  )
  return data
}
