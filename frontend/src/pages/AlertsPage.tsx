import { Card, Table, Typography } from 'antd'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTelemetryStore } from '../store/useTelemetryStore'

type AlertRow = {
  key: string
  shipmentId: string
  temperature: number
  location: string
  time: string
  status: string
}

export default function AlertsPage() {
  const navigate = useNavigate()
  const shipments = useTelemetryStore((state) => state.shipments)

  const rows = useMemo<AlertRow[]>(() => {
    return shipments.flatMap((shipment) =>
      shipment.routePoints
        .filter((point) => point.status !== 'NORMAL')
        .map((point, idx) => ({
          key: `${shipment.id}-${idx}`,
          shipmentId: shipment.id,
          temperature: point.temperature,
          location: point.locationLabel,
          time: point.timestamp,
          status: point.status,
        })),
    )
  }, [shipments])

  return (
    <Card className="dashboard-card" bodyStyle={{ padding: 0 }}>
      <div className="px-4 pt-4 pb-2">
        <Typography.Title level={4} className="!m-0 !text-slate-100">
          Active and Historical Alerts
        </Typography.Title>
      </div>
      <Table
        rowClassName="cursor-pointer"
        dataSource={rows}
        columns={[
          { title: 'Shipment ID', dataIndex: 'shipmentId', key: 'shipmentId' },
          {
            title: 'Temperature',
            dataIndex: 'temperature',
            key: 'temperature',
            render: (value: number) => `${value.toFixed(1)}°C`,
          },
          { title: 'Location', dataIndex: 'location', key: 'location' },
          {
            title: 'Time',
            dataIndex: 'time',
            key: 'time',
            render: (value: string) => new Date(value).toLocaleString(),
          },
          { title: 'Status', dataIndex: 'status', key: 'status' },
        ]}
        onRow={(record) => ({
          onClick: () => navigate(`/tracking-map?shipmentId=${record.shipmentId}`),
        })}
      />
    </Card>
  )
}
