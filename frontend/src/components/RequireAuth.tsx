import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Spin } from 'antd'
import { getStoredToken } from '../api/auth'
import { useAuth } from '../contexts/AuthContext'

export default function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const token = getStoredToken()

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#030712]">
        <Spin size="large" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
