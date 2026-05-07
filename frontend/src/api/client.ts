import axios, { type AxiosError } from 'axios'

const baseURL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:3000'

export const TOKEN_KEY = 'sct_access_token'

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  console.log('📤 API Request:', config.method?.toUpperCase(), config.url, config.data || '')
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    if (err.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign('/login')
      }
    }
    return Promise.reject(err)
  },
)

export function getApiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string; error?: string } | undefined
    const rawMessage = data?.message || data?.error || err.message || 'Request failed'

    if (rawMessage.includes('FromPartyID is not the current owner - transfer not authorized')) {
      return 'Không thể bàn giao vì bên giao hiện tại không phải là chủ sở hữu hợp lệ của lô hàng.'
    }

    if (rawMessage.includes('No active ownership found for this shipment')) {
      return 'Không thể bàn giao vì chưa có thông tin chủ sở hữu hiện tại của lô hàng.'
    }

    if (rawMessage.includes('fromPartyId and toPartyId must be different parties')) {
      return 'Không thể bàn giao vì bên giao và bên nhận phải là hai đơn vị khác nhau.'
    }

    if (rawMessage.includes('Only the current owner can confirm alarm resolution')) {
      return 'Chỉ bên đang nắm lô hàng mới có thể xác nhận đã xử lý cảnh báo.'
    }

    if (rawMessage.includes('Shipment has no active owner to authorize alarm resolution')) {
      return 'Không thể xác nhận xử lý cảnh báo vì lô hàng chưa có chủ sở hữu hiện tại.'
    }

    return rawMessage
  }
  return err instanceof Error ? err.message : 'Unknown error'
}
