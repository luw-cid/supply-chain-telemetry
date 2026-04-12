import { useQuery } from '@tanstack/react-query'
import { Alert, Card, Col, Row, Statistic, Table, Typography } from 'antd'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { listAlarms } from '../api/alarms'
import { listPorts } from '../api/reference'
import { listShipments } from '../api/shipments'
import GlobalFleetMap from '../components/GlobalFleetMap'
import { useAuth } from '../contexts/AuthContext'
import { useThemeMode } from '../contexts/ThemeContext'

export default function DashboardPage() {
  const { user } = useAuth()
  const { isDark } = useThemeMode()
  const isOwner = user?.role === 'OWNER'

  const shipmentsQ = useQuery({
    queryKey: ['shipments', 'dashboard', user?.role, user?.partyId],
    queryFn: () => listShipments({ limit: 200, page: 1 }),
  })

  const alarmsQ = useQuery({
    queryKey: ['alarms', 'dashboard-active'],
    queryFn: () => listAlarms({ status: 'OPEN', limit: 15, page: 1 }),
    retry: false,
    enabled: !isOwner,
  })

  const portsMapQ = useQuery({
    queryKey: ['reference', 'ports', 'map'],
    queryFn: () => listPorts({ map: true }),
    retry: false,
    enabled: !isOwner,
  })

  const items = shipmentsQ.data?.data ?? []

  const metrics = useMemo(() => {
    const total = items.length
    const normal = items.filter((s) => s.Status === 'NORMAL').length
    const alarm = items.filter((s) => s.Status === 'ALARM').length
    return { total, normal, alarm }
  }, [items])

  const alarmRows = (alarmsQ.data?.data ?? []).map((a) => ({ key: a.AlarmEventID, ...a }))

  const mapPorts = isOwner ? [] : (portsMapQ.data ?? [])

  return (
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <Typography.Title
          level={3}
          className={isDark ? '!text-slate-100 !mb-2' : '!text-slate-900 !mb-2'}
        >
          {isOwner ? 'Tổng quan lô hàng' : 'Tổng quan hệ thống'}
        </Typography.Title>
      </Col>
      {isOwner && !user?.partyId && (
        <Col span={24}>
          <Alert
            type="warning"
            showIcon
            message="Chưa gán PartyID"
            description="Liên hệ quản trị để gán đơn vị (Party) — sau đó bạn mới thấy lô hàng liên quan."
          />
        </Col>
      )}
      <Col xs={24} md={8}>
        <Card className="dashboard-card">
          <Statistic
            title={<span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Tổng lô đang theo dõi</span>}
            value={metrics.total}
            valueStyle={{ color: isDark ? '#e2e8f0' : '#0f172a' }}
          />
        </Card>
      </Col>
      <Col xs={24} md={8}>
        <Card className="dashboard-card">
          <Statistic
            title={<span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Lô NORMAL</span>}
            value={metrics.normal}
            valueStyle={{ color: '#22c55e' }}
          />
        </Card>
      </Col>
      <Col xs={24} md={8}>
        <Card className="dashboard-card">
          <Statistic
            title={<span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Lô ALARM</span>}
            value={metrics.alarm}
            valueStyle={{ color: '#ef4444' }}
          />
        </Card>
      </Col>

      <Col span={24}>
        <Card
          className="dashboard-card"
          title={
            <span className={isDark ? 'text-slate-200' : 'text-slate-800'}>
              {isOwner ? 'Vị trí lô hàng' : 'Bản đồ tổng quan'}
              {!isOwner && (
                <Typography.Text type="secondary" className="!ml-2 !text-xs !font-normal !text-slate-500">
                  · Biểu tượng cảng (kho + bến) · Tròn: lô hàng
                </Typography.Text>
              )}
              {isOwner && (
                <Typography.Text type="secondary" className="!ml-2 !text-xs !font-normal !text-slate-500">
                  · Chỉ các lô liên quan đến tài khoản của bạn
                </Typography.Text>
              )}
            </span>
          }
          bodyStyle={{ padding: 0 }}
        >
          {shipmentsQ.isLoading ? (
            <Typography.Text className={isDark ? 'text-slate-500 p-4 block' : 'text-slate-600 p-4 block'}>
              Đang tải…
            </Typography.Text>
          ) : (
            <div className="w-full h-[min(85vh,920px)] min-h-[520px]">
              <GlobalFleetMap shipments={items} ports={mapPorts} />
            </div>
          )}
        </Card>
      </Col>

      {!isOwner && (
        <Col span={24}>
          <Card
            className="dashboard-card"
            title={
              <span className={isDark ? 'text-slate-200' : 'text-slate-800'}>Sự cố cần xử lý (OPEN)</span>
            }
            bodyStyle={{ padding: 0 }}
          >
            <Table
              loading={alarmsQ.isLoading}
              pagination={false}
              dataSource={alarmRows}
              locale={{ emptyText: alarmsQ.isError ? 'Không tải được / chưa có bảng AlarmEvents.' : 'Không có cảnh báo OPEN.' }}
              columns={[
                { title: 'Shipment', dataIndex: 'ShipmentID', key: 's' },
                { title: 'Loại', dataIndex: 'AlarmType', key: 't' },
                { title: 'Mức độ', dataIndex: 'Severity', key: 'sev' },
                { title: 'Lý do', dataIndex: 'AlarmReason', key: 'r', ellipsis: true },
                {
                  title: '',
                  key: 'go',
                  width: 100,
                  render: (_, r) => (
                    <Link to={`/shipments/${r.ShipmentID}`}>Chi tiết</Link>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
      )}
    </Row>
  )
}
