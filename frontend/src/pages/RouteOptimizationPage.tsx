import { SearchOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, Form, Select, Space, Typography, Alert, Statistic, Row, Col } from 'antd'
import { useState } from 'react'
import { getRouteOptimization } from '../api/telemetry'
import { listPorts } from '../api/reference'
import { useThemeMode } from '../contexts/ThemeContext'

export default function RouteOptimizationPage() {
  const { isDark } = useThemeMode()
  const [origin, setOrigin] = useState<string | undefined>(undefined)
  const [destination, setDestination] = useState<string | undefined>(undefined)
  const [submitted, setSubmitted] = useState<{ o: string; d: string } | null>(null)

  const portsQ = useQuery({ queryKey: ['reference', 'ports'], queryFn: () => listPorts() })

  const optQ = useQuery({
    queryKey: ['route-opt', submitted?.o, submitted?.d],
    queryFn: () => getRouteOptimization(submitted!.o, submitted!.d),
    enabled: Boolean(submitted?.o && submitted?.d),
    retry: false,
  })

  const routes = (optQ.data as { routes?: unknown[] } | undefined)?.routes ?? []
  const success = (optQ.data as { success?: boolean } | undefined)?.success

  const titleCls = isDark ? '!text-slate-100' : '!text-slate-900'

  return (
    <Space direction="vertical" size={16} className="w-full">
      <Typography.Title level={3} className={titleCls}>
        Tối ưu lộ trình
      </Typography.Title>

      <Card className="dashboard-card">
        <Form layout="inline" className="flex flex-wrap gap-3 items-end" onFinish={() => {
          if (origin && destination) setSubmitted({ o: origin, d: destination })
        }}>
          <Form.Item label="Cảng đi" required>
            <Select
              showSearch
              optionFilterProp="label"
              style={{ width: 220 }}
              placeholder="Origin"
              value={origin}
              onChange={setOrigin}
              options={(portsQ.data ?? []).map((p) => ({
                value: p.PortCode,
                label: `${p.Name} (${p.PortCode})`,
              }))}
            />
          </Form.Item>
          <Form.Item label="Cảng đến" required>
            <Select
              showSearch
              optionFilterProp="label"
              style={{ width: 220 }}
              placeholder="Destination"
              value={destination}
              onChange={setDestination}
              options={(portsQ.data ?? []).map((p) => ({
                value: p.PortCode,
                label: `${p.Name} (${p.PortCode})`,
              }))}
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" icon={<SearchOutlined />} loading={optQ.isFetching}>
            Tra cứu
          </Button>
        </Form>
      </Card>

      {optQ.isError && (
        <Alert type="error" message="Không lấy được gợi ý lộ trình" description={(optQ.error as Error).message} />
      )}

      {submitted && optQ.isSuccess && success === false && (
        <Alert type="warning" message={(optQ.data as { message?: string }).message || 'No routes'} />
      )}

      {submitted && routes.length > 0 && (
        <Space direction="vertical" className="w-full" size={12}>
          {routes.map((route: unknown, idx: number) => {
            const r = route as {
              path?: string[]
              summary?: {
                total_hours?: number
                avg_alarm_rate?: number
                max_alarm_rate?: number
                total_stops?: number
              }
            }
            const pathStr = (r.path ?? []).join(' → ')
            return (
              <Card key={idx} className="dashboard-card" title={`Lộ trình ${idx + 1}`}>
                <Typography.Paragraph className="!text-slate-300">{pathStr || '—'}</Typography.Paragraph>
                <Row gutter={16}>
                  <Col span={8}>
                    <Statistic
                      title="Tổng giờ (ước tính)"
                      value={r.summary?.total_hours ?? '—'}
                      valueStyle={{ color: '#e2e8f0' }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="Avg alarm rate"
                      value={
                        r.summary?.avg_alarm_rate != null
                          ? `${(Number(r.summary.avg_alarm_rate) * 100).toFixed(2)}%`
                          : '—'
                      }
                      valueStyle={{ color: '#bae6fd' }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="Max alarm rate"
                      value={
                        r.summary?.max_alarm_rate != null
                          ? `${(Number(r.summary.max_alarm_rate) * 100).toFixed(2)}%`
                          : '—'
                      }
                      valueStyle={{ color: '#fca5a5' }}
                    />
                  </Col>
                </Row>
              </Card>
            )
          })}
        </Space>
      )}
    </Space>
  )
}
