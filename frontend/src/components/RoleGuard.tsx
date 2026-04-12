import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/** OWNER chỉ được Dashboard + Lô hàng (danh sách & chi tiết). */
function ownerAllowedPath(pathname: string): boolean {
  if (pathname === '/dashboard') return true
  if (pathname === '/shipments') return true
  if (pathname.startsWith('/shipments/')) return true
  return false
}

export default function RoleGuard({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { pathname } = useLocation()

  if (user?.role === 'OWNER' && !ownerAllowedPath(pathname)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
