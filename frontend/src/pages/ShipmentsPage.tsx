import { Button, Card, Space, Table, Typography } from 'antd'
import { Link } from 'react-router-dom'
import { useTelemetryStore } from '../store/useTelemetryStore'

export default function ShipmentsPage() {
  const shipments = useTelemetryStore((state) => state.shipments)

  return (
    <Card className="dashboard-card" bodyStyle={{ padding: 0 }}>
      <div className="px-4 pt-4 pb-2">
        <Typography.Title level={4} className="!m-0 !text-slate-100">
          Shipments
        </Typography.Title>
      </div>
      <Table
        dataSource={shipments.map((shipment) => ({
          key: shipment.id,
          shipmentId: shipment.id,
          owner: shipment.currentOwner,
          route: `${shipment.routePoints[0].locationLabel} -> ${shipment.routePoints[shipment.routePoints.length - 1].locationLabel}`,
        }))}
        columns={[
          { title: 'Shipment ID', dataIndex: 'shipmentId', key: 'shipmentId' },
          { title: 'Owner', dataIndex: 'owner', key: 'owner' },
          { title: 'Route', dataIndex: 'route', key: 'route' },
          {
            title: 'Actions',
            key: 'action',
            render: (_, row) => (
              <Space>
                <Link to={`/shipments/${row.shipmentId}`}>
                  <Button type="default" size="small">
                    Detail
                  </Button>
                </Link>
                <Link to={`/tracking-map?shipmentId=${row.shipmentId}`}>
                  <Button type="primary" size="small">
                    Track
                  </Button>
                </Link>
              </Space>
            ),
          },
        ]}
      />
    </Card>
  )
}
