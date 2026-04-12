import { api } from './client'

export interface TransferPayload {
  fromPartyId: string
  toPartyId: string
  handoverPortCode: string
  handoverCondition?: 'GOOD' | 'DAMAGED' | 'PARTIAL'
  handoverNotes?: string
  handoverSignature?: string
  witnessPartyId?: string
}

export async function transferCustody(shipmentId: string, body: TransferPayload) {
  const { data } = await api.post<{ success: boolean; message?: string; data: unknown }>(
    `/api/v1/shipments/${shipmentId}/transfer`,
    body,
  )
  return data
}

export async function getOwnershipHistory(shipmentId: string, detail: 'DETAILED' | 'SUMMARY' = 'DETAILED') {
  const { data } = await api.get<{ success: boolean; data: OwnershipHistoryData }>(
    `/api/v1/shipments/${shipmentId}/ownership-history`,
    { params: { detail } },
  )
  return data.data
}

export interface OwnershipHistoryData {
  shipmentId: string
  detailLevel: string
  totalTransfers: number
  chain: Record<string, unknown>[]
}
