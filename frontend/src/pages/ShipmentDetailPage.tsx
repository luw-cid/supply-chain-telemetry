import { useQuery } from '@tanstack/react-query'
import { SwapOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Descriptions, Pagination, Space, Tabs, Typography } from 'antd'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getOwnershipHistory } from '../api/custody'
import { getShipment } from '../api/shipments'
import { getTelemetryLogs, getTraceRoute } from '../api/telemetry'
import CustodyTimeline from '../components/CustodyTimeline'
import ShipmentStatusBadge from '../components/ShipmentStatusBadge'
import TelemetryIoTChart from '../components/TelemetryIoTChart'
import TraceRouteMap from '../components/TraceRouteMap'
import { useAuth } from '../contexts/AuthContext'
import { useThemeMode } from '../contexts/ThemeContext'
import { mapOwnershipChainToEvents } from '../utils/ownershipTimeline'

export default function ShipmentDetailPage() {
  const { isDark } = useThemeMode()
  const { user } = useAuth()
  const { shipmentId = '' } = useParams()
  const canCustodyTransfer = user?.role === 'ADMIN' || user?.role === 'LOGISTICS'
  const [telPage, setTelPage] = useState(1)
  const [telLimit] = useState(100)

  const detailQ = useQuery({
    queryKey: ['shipment', shipmentId],
    queryFn: () => getShipment(shipmentId),
    enabled: Boolean(shipmentId),
  })

  const traceQ = useQuery({
    queryKey: ['trace', shipmentId],
    queryFn: () => getTraceRoute(shipmentId, 800),
    enabled: Boolean(shipmentId),
    retry: false,
  })

  const telQ = useQuery({
    queryKey: ['telemetry', shipmentId, telPage, telLimit],
    queryFn: () => getTelemetryLogs(shipmentId, { page: telPage, limit: telLimit, sort: 'asc' }),
    enabled: Boolean(shipmentId),
    retry: false,
  })

  const custodyQ = useQuery({
    queryKey: ['custody', shipmentId],
    queryFn: () => getOwnershipHistory(shipmentId, 'DETAILED'),
    enabled: Boolean(shipmentId),
    retry: false,
  })

  const shipment = detailQ.data?.shipment as Record<string, unknown> | undefined
  const status = String(shipment?.Status ?? '')
  const tempMin = shipment?.TempMin != null ? Number(shipment.TempMin) : null
  const tempMax = shipment?.TempMax != null ? Number(shipment.TempMax) : null

  const custodyEvents = useMemo(() => {
    const chain = (custodyQ.data?.chain ?? []) as Record<string, unknown>[]
    return mapOwnershipChainToEvents(chain)
  }, [custodyQ.data])

  if (!shipmentId) return null

  const labelCls = isDark ? '!text-slate-400' : '!text-slate-600'
  const headingCls = isDark ? '!m-0 !text-slate-100' : '!m-0 !text-slate-900'
  const traceLoadingCls = isDark ? 'text-slate-500' : 'text-slate-600'

  if (detailQ.isError) {
    return (
      <Alert
        type="error"
        message="Không tải được chi tiết lô hàng"
        description={(detailQ.error as Error)?.message}
      />
    )
  }

  return (
    <Space direction="vertical" size={16} className="w-full">
      <Card className="dashboard-card" bodyStyle={{ padding: 16 }} loading={detailQ.isLoading}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Typography.Text className={labelCls}>Shipment ID</Typography.Text>
            <Typography.Title level={3} className={headingCls}>
              {String(shipment?.ShipmentID ?? shipmentId)}
            </Typography.Title>
          </div>
          <Space wrap align="center">
            {canCustodyTransfer && status !== 'ALARM' && (
              <Link to={`/custody/transfer?shipmentId=${encodeURIComponent(shipmentId)}`}>
                <Button type="primary" icon={<SwapOutlined />}>
                  Bàn giao lô này
                </Button>
              </Link>
            )}
            {canCustodyTransfer && status === 'ALARM' && (
              <Typography.Text type="secondary">ALARM: xử lý cảnh báo trước khi bàn giao</Typography.Text>
            )}
            <ShipmentStatusBadge status={status} />
          </Space>
        </div>
        {shipment && (
          <Descriptions column={1} className="app-descriptions mt-4">
            <Descriptions.Item label="Cảng đi">{String(shipment.OriginPortCode)}</Descriptions.Item>
            <Descriptions.Item label="Cảng đến">{String(shipment.DestinationPortCode)}</Descriptions.Item>
            <Descriptions.Item label="Trọng lượng">{String(shipment.WeightKg)} kg</Descriptions.Item>
            <Descriptions.Item label="CargoProfile">{String(shipment.CargoProfileID)}</Descriptions.Item>
          </Descriptions>
        )}
      </Card>

      <Tabs
        defaultActiveKey="trace"
        className="app-tabs"
        items={[
          {
            key: 'trace',
            label: 'Hành trình (Trace)',
            children: (
              <Card className="dashboard-card">
                {traceQ.isLoading && <Typography.Text className={traceLoadingCls}>Đang tải trace…</Typography.Text>}
                {traceQ.isError && (
                  <Alert
                    type="warning"
                    showIcon
                    className="mb-3"
                    message="Chưa có dữ liệu trace hoặc lỗi API"
                    description={(traceQ.error as Error)?.message}
                  />
                )}
                {traceQ.data && <TraceRouteMap trace={traceQ.data} />}
              </Card>
            ),
          },
          {
            key: 'telemetry',
            label: 'Cảm biến (Telemetry)',
            children: (
              <Card className="dashboard-card">
                {telQ.isError && (
                  <Alert type="error" message="Không đọc được telemetry logs (cần JWT / dữ liệu)." className="mb-3" />
                )}
                <TelemetryIoTChart logs={telQ.data?.logs ?? []} tempMin={tempMin} tempMax={tempMax} />
                <div className="mt-4 flex justify-end">
                  <Pagination
                    current={telPage}
                    pageSize={telLimit}
                    total={telQ.data?.pagination.total ?? 0}
                    onChange={(p) => setTelPage(p)}
                    showSizeChanger={false}
                  />
                </div>
              </Card>
            ),
          },
          {
            key: 'custody',
            label: 'Chuỗi sở hữu',
            children: (
              <Card className="dashboard-card">
                {custodyQ.isError && (
                  <Alert type="warning" message="Không tải ownership-history (kiểm tra quyền JWT)." className="mb-3" />
                )}
                <CustodyTimeline items={custodyEvents} />
              </Card>
            ),
          },
        ]}
      />
    </Space>
  )
}
