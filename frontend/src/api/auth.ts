import { api, TOKEN_KEY } from './client'

export interface AuthUser {
  userId: string
  name: string
  email: string
  phone: string
  role: string
  partyId: string | null
}

export async function login(email: string, password: string): Promise<{ accessToken: string; user: AuthUser }> {
  const { data } = await api.post<{ success: boolean; data: { accessToken: string; user: AuthUser } }>(
    '/api/auth/login',
    { email, password },
  )
  return data.data
}

/** Validates JWT; payload is { sub, role, partyId } — use stored user from login for display name. */
export async function fetchMe(): Promise<{ sub: string; role: string; partyId: string | null }> {
  const { data } = await api.get<{ success: boolean; data: { sub: string; role: string; partyId: string | null } }>(
    '/api/auth/me',
  )
  return data.data
}

export function setStoredToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}
