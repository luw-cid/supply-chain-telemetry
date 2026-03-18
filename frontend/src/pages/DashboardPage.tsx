import { Card, Col, Row, Statistic, Typography } from 'antd'
import { useMemo } from 'react'
import { useTelemetryStore } from '../store/useTelemetryStore'

export default function DashboardPage() {
  const shipments = useTelemetryStore((state) => state.shipments)

  const metrics = useMemo(() => {
    const totalShipments = shipments.length
    const activeAlerts = shipments.reduce(
      (sum, shipment) => sum + shipment.routePoints.filter((point) => point.status !== 'NORMAL').length,
      0,
    )
    const averageTemp =
      shipments.reduce(
        (sum, shipment) =>
          sum + shipment.routePoints.reduce((innerSum, point) => innerSum + point.temperature, 0) / shipment.routePoints.length,
        0,
      ) / shipments.length

    return {
      totalShipments,
      activeAlerts,
      averageTemp: Number(averageTemp.toFixed(1)),
    }
  }, [shipments])

  return (
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <Typography.Title level={3} className="!text-slate-100 !mb-2">
          Dashboard
        </Typography.Title>
      </Col>
      <Col xs={24} md={8}>
        <Card className="dashboard-card">
          <Statistic title="Total Shipments" value={metrics.totalShipments} valueStyle={{ color: '#e2e8f0' }} />
        </Card>
      </Col>
      <Col xs={24} md={8}>
        <Card className="dashboard-card">
          <Statistic title="Alert Events" value={metrics.activeAlerts} valueStyle={{ color: '#fca5a5' }} />
        </Card>
      </Col>
      <Col xs={24} md={8}>
        <Card className="dashboard-card">
          <Statistic title="Avg Temperature" value={metrics.averageTemp} suffix="°C" valueStyle={{ color: '#bae6fd' }} />
        </Card>
      </Col>
    </Row>
  )
}
