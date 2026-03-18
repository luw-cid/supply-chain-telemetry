import { Card, Col, Row, Select, Space, Statistic, Typography } from 'antd'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import RouteMap from '../components/RouteMap'
import StatusBadge from '../components/StatusBadge'
import TemperatureChart from '../components/TemperatureChart'
import {
  getCurrentTelemetryPoint,
  getTelemetryUntilCursor,
  selectShipmentById,
  useTelemetryStore,
} from '../store/useTelemetryStore'

export default function TrackingMapPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const shipmentIdFromQuery = searchParams.get('shipmentId')

  const shipments = useTelemetryStore((state) => state.shipments)
  const cursorByShipmentId = useTelemetryStore((state) => state.cursorByShipmentId)
  const selectedShipmentId = useTelemetryStore((state) => state.selectedShipmentId)
  const setSelectedShipment = useTelemetryStore((state) => state.setSelectedShipment)

  useEffect(() => {
    if (shipmentIdFromQuery && shipments.some((shipment) => shipment.id === shipmentIdFromQuery)) {
      setSelectedShipment(shipmentIdFromQuery)
    }
  }, [shipmentIdFromQuery, setSelectedShipment, shipments])

  const shipment = selectShipmentById(shipments, selectedShipmentId) ?? shipments[0]

  if (!shipment) {
    return null
  }

  const currentPoint = getCurrentTelemetryPoint(shipment, cursorByShipmentId)
  const historyPoints = getTelemetryUntilCursor(shipment, cursorByShipmentId)

  return (
    <Space direction="vertical" size={16} className="w-full">
      <Card className="dashboard-card" bodyStyle={{ padding: 14 }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Typography.Title level={4} className="!m-0 !text-slate-100">
            Tracking Map
          </Typography.Title>

          <Select
            value={shipment.id}
            style={{ width: 220 }}
            options={shipments.map((item) => ({ label: item.id, value: item.id }))}
            onChange={(value) => {
              setSelectedShipment(value)
              setSearchParams({ shipmentId: value })
            }}
          />
        </div>
      </Card>

      <Row gutter={16} className="min-h-[70vh]">
        <Col xs={24} lg={17}>
          <Card className="dashboard-card h-full" bodyStyle={{ height: '100%' }}>
            <RouteMap shipment={shipment} currentPoint={currentPoint} />
          </Card>
        </Col>

        <Col xs={24} lg={7}>
          <Space direction="vertical" size={16} className="w-full">
            <Card className="dashboard-card" bodyStyle={{ padding: 16 }}>
              <Space direction="vertical" size={10} className="w-full">
                <Typography.Text className="!text-slate-400">Shipment ID</Typography.Text>
                <Typography.Title level={3} className="!m-0 !text-slate-100">
                  {shipment.id}
                </Typography.Title>
                <StatusBadge status={currentPoint.status} />

                <Statistic
                  title="Current Temperature"
                  value={currentPoint.temperature}
                  precision={1}
                  suffix="°C"
                  valueStyle={{ color: '#e2e8f0' }}
                />

                <Typography.Text className="!text-slate-300">
                  {currentPoint.locationLabel} · {new Date(currentPoint.timestamp).toLocaleString()}
                </Typography.Text>
              </Space>
            </Card>

            <Card className="dashboard-card" bodyStyle={{ padding: 16 }}>
              <Typography.Title level={5} className="!text-slate-100">
                Temperature Trend
              </Typography.Title>
              <TemperatureChart points={historyPoints} compact />
            </Card>
          </Space>
        </Col>
      </Row>
    </Space>
  )
}
