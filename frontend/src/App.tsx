import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import RequireAuth from './components/RequireAuth'
import MainLayout from './layouts/MainLayout'
import AuditAlertsPage from './pages/AuditAlertsPage'
import CustodyTransferPage from './pages/CustodyTransferPage'
import ChainCustodyPage from './pages/ChainCustodyPage'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import RouteOptimizationPage from './pages/RouteOptimizationPage'
import PartiesPage from './pages/PartiesPage'
import PortsPage from './pages/PortsPage'
import ShipmentDetailPage from './pages/ShipmentDetailPage'
import ShipmentsPage from './pages/ShipmentsPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<MainLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/ports" element={<PortsPage />} />
            <Route path="/parties" element={<PartiesPage />} />
            <Route path="/shipments" element={<ShipmentsPage />} />
            <Route path="/shipments/:shipmentId" element={<ShipmentDetailPage />} />
            <Route path="/custody/transfer" element={<CustodyTransferPage />} />
            <Route path="/custody/chain" element={<ChainCustodyPage />} />
            <Route path="/analytics/route-optimization" element={<RouteOptimizationPage />} />
            <Route path="/audit-alerts" element={<AuditAlertsPage />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
