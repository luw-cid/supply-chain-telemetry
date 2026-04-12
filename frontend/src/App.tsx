import { ConfigProvider, theme } from 'antd'
import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import MainLayout from './layouts/MainLayout'
import AlertsPage from './pages/AlertsPage'
import AnalyticsPage from './pages/AnalyticsPage'
import DashboardPage from './pages/DashboardPage'
import ShipmentDetailPage from './pages/ShipmentDetailPage'
import ShipmentsPage from './pages/ShipmentsPage'
import TrackingMapPage from './pages/TrackingMapPage'
import { useTelemetryStore } from './store/useTelemetryStore'

function App() {
  const startSimulation = useTelemetryStore((state) => state.startSimulation)

  useEffect(() => {
    startSimulation()
  }, [startSimulation])

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#38bdf8',
          borderRadius: 6,
          colorBgBase: '#020617',
          colorTextBase: '#e2e8f0',
          colorBorder: '#1f2937',
          fontFamily: 'IBM Plex Sans, Segoe UI, sans-serif',
        },
        components: {
          Layout: {
            headerBg: '#0f172a',
            siderBg: '#0a0f1c',
            bodyBg: '#020617',
          },
          Menu: {
            darkItemBg: '#0a0f1c',
            darkItemSelectedBg: '#0f213d',
            darkItemSelectedColor: '#bae6fd',
            darkItemColor: '#94a3b8',
            darkItemHoverBg: '#111b2e',
          },
        },
      }}
    >
      <BrowserRouter>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/shipments" element={<ShipmentsPage />} />
            <Route path="/shipments/:shipmentId" element={<ShipmentDetailPage />} />
            <Route path="/tracking-map" element={<TrackingMapPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="*" element={<Navigate to="/tracking-map" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  )
}

export default App
