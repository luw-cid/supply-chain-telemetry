import { Card, Col, Row, Typography } from 'antd'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useMemo } from 'react'
import { useTelemetryStore } from '../store/useTelemetryStore'
import { useThemeMode } from '../contexts/ThemeContext'

export default function AnalyticsPage() {
  const { isDark } = useThemeMode()
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

  const gridStroke = isDark ? '#1f2937' : '#e2e8f0'
  const axisStroke = isDark ? '#64748b' : '#94a3b8'
  const tickFill = isDark ? '#94a3b8' : '#475569'
  const tooltipStyle = isDark
    ? {
        border: '1px solid #334155',
        background: '#0f172a',
        color: '#e2e8f0',
        borderRadius: 6,
      }
    : {
        border: '1px solid #e2e8f0',
        background: '#ffffff',
        color: '#0f172a',
        borderRadius: 6,
      }

  const chartCard = (title: string, data: Array<{ name: string; value: number }>, color: string) => (
    <Card className="dashboard-card h-full" bodyStyle={{ padding: 16 }}>
      <Typography.Title level={5} className={isDark ? '!text-slate-100' : '!text-slate-900'}>
        {title}
      </Typography.Title>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 28 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis
              dataKey="name"
              stroke={axisStroke}
              tick={{ fill: tickFill, fontSize: 11 }}
              angle={-14}
              textAnchor="end"
              interval={0}
            />
            <YAxis stroke={axisStroke} tick={{ fill: tickFill, fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} />
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
