import { Card, Col, Descriptions, Row, Space, Table, Tabs, Typography } from 'antd'
import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import CustodyTimeline from '../components/CustodyTimeline'
import StatusBadge from '../components/StatusBadge'
import TemperatureChart from '../components/TemperatureChart'
import {
  getCurrentTelemetryPoint,
  getTelemetryUntilCursor,
  selectShipmentById,
  useTelemetryStore,
} from '../store/useTelemetryStore'

export default function ShipmentDetailPage() {
  const { shipmentId } = useParams()
  const shipments = useTelemetryStore((state) => state.shipments)
  const cursorByShipmentId = useTelemetryStore((state) => state.cursorByShipmentId)

  const shipment = useMemo(
    () => selectShipmentById(shipments, shipmentId ?? '') ?? shipments[0],
    [shipmentId, shipments],
  )

  if (!shipment) {
    return null
  }

  const currentPoint = getCurrentTelemetryPoint(shipment, cursorByShipmentId)
  const historyPoints = getTelemetryUntilCursor(shipment, cursorByShipmentId)

  return (
    <Space direction="vertical" size={16} className="w-full">
      <Card className="dashboard-card" bodyStyle={{ padding: 16 }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Typography.Text className="!text-slate-400">Shipment ID</Typography.Text>
            <Typography.Title level={3} className="!m-0 !text-slate-100">
              {shipment.id}
            </Typography.Title>
          </div>
          <StatusBadge status={currentPoint.status} />
        </div>
      </Card>

      <Tabs
        defaultActiveKey="overview"
        className="app-tabs"
        items={[
          {
            key: 'overview',
            label: 'Overview',
            children: (
              <Card className="dashboard-card">
                <Row gutter={16}>
                  <Col span={24}>
                    <Descriptions column={1} className="app-descriptions">
                      <Descriptions.Item label="Current port">{currentPoint.locationLabel}</Descriptions.Item>
                      <Descriptions.Item label="Current owner">{shipment.currentOwner}</Descriptions.Item>
                      <Descriptions.Item label="Status">{currentPoint.status}</Descriptions.Item>
                    </Descriptions>
                  </Col>
                </Row>
              </Card>
            ),
          },
          {
            key: 'telemetry',
            label: 'Telemetry',
            children: (
              <Card className="dashboard-card">
                <TemperatureChart points={historyPoints} />
              </Card>
            ),
          },
          {
            key: 'custody',
            label: 'Custody',
            children: (
              <Card className="dashboard-card">
                <CustodyTimeline items={shipment.custodyChain} />
              </Card>
            ),
          },
          {
            key: 'history',
            label: 'History',
            children: (
              <Card className="dashboard-card" bodyStyle={{ padding: 0 }}>
                <Table
                  pagination={false}
                  dataSource={shipment.historyEvents}
                  columns={[
                    { title: 'Event', dataIndex: 'event', key: 'event' },
                    {
                      title: 'Time',
                      dataIndex: 'time',
                      key: 'time',
                      render: (value: string) => new Date(value).toLocaleString(),
                    },
                    { title: 'Location', dataIndex: 'location', key: 'location' },
                    { title: 'Actor', dataIndex: 'actor', key: 'actor' },
                  ]}
                />
              </Card>
            ),
          },
        ]}
      />
    </Space>
  )
}
