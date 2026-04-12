import { api } from './client'

export interface PortRow {
  PortCode: string
  Name: string
  Country: string
  Latitude: number | null
  Longitude: number | null
  Timezone: string | null
  Status: string
}

export async function listPorts(params?: { all?: boolean; map?: boolean }) {
  const q: Record<string, string> = {}
  if (params?.all) q.all = '1'
  if (params?.map) q.map = '1'
  const { data } = await api.get<{ success: boolean; data: PortRow[] }>('/api/reference/ports', {
    params: Object.keys(q).length ? q : undefined,
  })
  return data.data
}

export interface CreatePortPayload {
  portCode: string
  name: string
  country: string
  latitude?: number | null
  longitude?: number | null
  timezone?: string | null
  status?: string
}

export async function createPort(payload: CreatePortPayload) {
  const { data } = await api.post<{ success: boolean; data: PortRow }>('/api/reference/ports', payload)
  return data.data
}

export async function updatePort(portCode: string, payload: Partial<CreatePortPayload>) {
  const { data } = await api.put<{ success: boolean; data: PortRow }>(`/api/reference/ports/${encodeURIComponent(portCode)}`, payload)
  return data.data
}

export async function deletePort(portCode: string) {
  const { data } = await api.delete<{ success: boolean; data: { deleted: boolean; portCode: string } }>(
    `/api/reference/ports/${encodeURIComponent(portCode)}`,
  )
  return data.data
}

/** Dropdown: chỉ ACTIVE + 3 cột. Với `all: true` (ADMIN/LOGISTICS/AUDITOR): đủ cột + mọi trạng thái */
export interface PartyListItem {
  PartyID: string
  Name: string
  PartyType: string
  Email?: string | null
  Phone?: string | null
  Address?: string | null
  Status?: string
  CreatedAtUTC?: string
  UpdatedAtUTC?: string
}

export async function listParties(params?: { all?: boolean }) {
  const { data } = await api.get<{ success: boolean; data: PartyListItem[] }>('/api/reference/parties', {
    params: params?.all ? { all: '1' } : undefined,
  })
  return data.data
}

export interface CreatePartyPayload {
  partyId: string
  partyType: string
  name: string
  email?: string | null
  phone?: string | null
  address?: string | null
  status?: string
}

export async function createParty(payload: CreatePartyPayload) {
  const { data } = await api.post<{ success: boolean; data: PartyListItem }>('/api/reference/parties', payload)
  return data.data
}

export async function updateParty(partyId: string, payload: Partial<CreatePartyPayload>) {
  const { data } = await api.put<{ success: boolean; data: PartyListItem }>(
    `/api/reference/parties/${encodeURIComponent(partyId)}`,
    payload,
  )
  return data.data
}

export async function listCargoProfiles() {
  const { data } = await api.get<{
    success: boolean
    data: { CargoProfileID: string; CargoType: string; CargoName: string; TempMin: number; TempMax: number }[]
  }>('/api/reference/cargo-profiles')
  return data.data
}
