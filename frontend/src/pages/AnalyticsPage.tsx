import { Card, Col, Row, Typography } from 'antd'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useMemo } from 'react'
import { useTelemetryStore } from '../store/useTelemetryStore'

export default function AnalyticsPage() {
  const shipments = useTelemetryStore((state) => state.shipments)

  const averageTransport = useMemo(() => {
    return shipments.map((shipment) => {
      const first = new Date(shipment.routePoints[0].timestamp).getTime()
      const last = new Date(shipment.routePoints[shipment.routePoints.length - 1].timestamp).getTime()
      const hours = (last - first) / (1000 * 60 * 60)
      return { name: shipment.id, value: Number(hours.toFixed(1)) }
    })
  }, [shipments])

  const mostUsedRoutes = useMemo(() => {
    return shipments.map((shipment) => ({
      name: `${shipment.routePoints[0].locationLabel} -> ${shipment.routePoints[shipment.routePoints.length - 1].locationLabel}`,
      value: shipment.routePoints.length,
    }))
  }, [shipments])

  const violationRoutes = useMemo(() => {
    return shipments.map((shipment) => ({
      name: shipment.id,
      value: shipment.routePoints.filter((point) => point.status !== 'NORMAL').length,
    }))
  }, [shipments])

  const chartCard = (title: string, data: Array<{ name: string; value: number }>, color: string) => (
    <Card className="dashboard-card h-full" bodyStyle={{ padding: 16 }}>
      <Typography.Title level={5} className="!text-slate-100">
        {title}
      </Typography.Title>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 28 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="name" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} angle={-14} textAnchor="end" interval={0} />
            <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                border: '1px solid #334155',
                background: '#0f172a',
                color: '#e2e8f0',
                borderRadius: 6,
              }}
            />
            <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} xl={8}>
        {chartCard('Average Transport Time (hours)', averageTransport, '#38bdf8')}
      </Col>
      <Col xs={24} xl={8}>
        {chartCard('Most Used Routes', mostUsedRoutes, '#22c55e')}
      </Col>
      <Col xs={24} xl={8}>
        {chartCard('Routes with Most Violations', violationRoutes, '#ef4444')}
      </Col>
    </Row>
  )
}
