import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircleFilled, DownloadOutlined, SwapOutlined } from '@ant-design/icons'
import { Alert, Button, Card, DatePicker, Descriptions, Modal, Pagination, Select, Space, Tabs, Typography, message } from 'antd'
import type { Dayjs } from 'dayjs'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getOwnershipHistory } from '../api/custody'
import { getApiErrorMessage } from '../api/client'
import { getShipment, updateShipmentStatus } from '../api/shipments'
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
  const qc = useQueryClient()
  const { shipmentId = '' } = useParams()
  const canCustodyTransfer = user?.role === 'ADMIN' || user?.role === 'LOGISTICS'

  const [telPage, setTelPage] = useState(1)
  const [telLimit] = useState(100)
  const [telDateRange, setTelDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null])
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<string>('NORMAL')
  const [alarmResolved, setAlarmResolved] = useState(false)

  const fromTel = telDateRange[0] ? telDateRange[0].toISOString() : undefined
  const toTel = telDateRange[1] ? telDateRange[1].toISOString() : undefined

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
    queryKey: ['telemetry', shipmentId, telPage, telLimit, fromTel, toTel],
    queryFn: () => getTelemetryLogs(shipmentId, {
      page: telPage, limit: telLimit, sort: 'asc',
      ...(fromTel ? { startDate: fromTel } : {}),
      ...(toTel ? { endDate: toTel } : {}),
    }),
    enabled: Boolean(shipmentId),
    retry: false,
  })

  const custodyQ = useQuery({
    queryKey: ['custody', shipmentId],
    queryFn: () => getOwnershipHistory(shipmentId, 'DETAILED'),
    enabled: Boolean(shipmentId),
    retry: false,
  })

  const portsMapQ = useQuery({
    queryKey: ['reference', 'ports', 'map'],
    queryFn: () => import('../api/reference').then(m => m.listPorts({ map: true })),
    retry: false,
  })

  const statusMut = useMutation({
    mutationFn: ({ status, alarmResolved }: { status: string; alarmResolved: boolean }) =>
      updateShipmentStatus(shipmentId, status, alarmResolved),
    onSuccess: () => {
      message.success('Đã cập nhật trạng thái lô hàng')
      qc.invalidateQueries({ queryKey: ['shipment', shipmentId] })
      qc.invalidateQueries({ queryKey: ['shipments'] })
      setStatusModalOpen(false)
    },
    onError: (e) => message.error(getApiErrorMessage(e)),
  })

  const shipment = detailQ.data?.shipment as Record<string, unknown> | undefined
  const status = String(shipment?.Status ?? '')
  const currentOwnerPartyId = shipment?.CurrentOwnerPartyID != null ? String(shipment.CurrentOwnerPartyID) : ''
  const canResolveAlarmAsCurrentOwner =
    status === 'ALARM' &&
    Boolean(user?.partyId) &&
    currentOwnerPartyId !== '' &&
    user?.partyId === currentOwnerPartyId
  const canUpdateStatus = user?.role === 'ADMIN' || user?.role === 'LOGISTICS' || canResolveAlarmAsCurrentOwner
  const tempMin = shipment?.TempMin != null ? Number(shipment.TempMin) : null
  const tempMax = shipment?.TempMax != null ? Number(shipment.TempMax) : null

  const custodyEvents = useMemo(() => {
    const chain = (custodyQ.data?.chain ?? []) as Record<string, unknown>[]
    return mapOwnershipChainToEvents(chain)
  }, [custodyQ.data])

  function exportCsv() {
    const logs = telQ.data?.logs ?? []
    if (logs.length === 0) { message.warning('Không có dữ liệu telemetry để export'); return }
    const header = 'timestamp,device_id,temp,humidity,lat,lng'
    const rows = logs.map((l) => {
      const location =
        l.location && typeof l.location === 'object' && 'lat' in l.location && 'lng' in l.location
          ? l.location
          : undefined
      const lat = location?.lat ?? ''
      const lng = location?.lng ?? ''
      return `${l.timestamp},${l.device_id ?? ''},${l.temp},${l.humidity ?? ''},${lat},${lng}`
    })
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `telemetry-${shipmentId}.csv`; a.click()
    URL.revokeObjectURL(url)
    message.success(`Đã export ${logs.length} dòng CSV`)
  }

  if (!shipmentId) return null

  const labelCls = isDark ? '!text-slate-400' : '!text-slate-600'
  const headingCls = isDark ? '!m-0 !text-slate-100' : '!m-0 !text-slate-900'
  const traceLoadingCls = isDark ? 'text-slate-500' : 'text-slate-600'

  if (detailQ.isError) {
    return (
      <Alert type="error" message="Không tải được chi tiết lô hàng" description={(detailQ.error as Error)?.message} />
    )
  }

  return (
    <Space orientation="vertical" size={16} className="w-full">
      <Card className="dashboard-card" styles={{ body: { padding: 16 } }} loading={detailQ.isLoading}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Typography.Text className={labelCls}>Shipment ID</Typography.Text>
            <Typography.Title level={3} className={headingCls}>
              {String(shipment?.ShipmentID ?? shipmentId)}
            </Typography.Title>
          </div>
          <Space wrap align="center">
            {canUpdateStatus && (
              <>
                <Button onClick={() => { setSelectedStatus(status === 'ALARM' ? 'NORMAL' : 'IN_TRANSIT'); setAlarmResolved(status === 'ALARM'); setStatusModalOpen(true) }}>
                  Cập nhật trạng thái
                </Button>
              </>
            )}
            {canCustodyTransfer && status !== 'ALARM' && (
              <Link to={`/custody/transfer?shipmentId=${encodeURIComponent(shipmentId)}`}>
                <Button type="primary" icon={<SwapOutlined />}>Bàn giao lô này</Button>
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

      <Modal title="Cập nhật trạng thái lô hàng" open={statusModalOpen} onCancel={() => setStatusModalOpen(false)} footer={null}>
        <Space orientation="vertical" className="w-full pt-3" size={16}>
          <div>
            <Typography.Text className={labelCls}>Trạng thái mới</Typography.Text>
            <Select
              className="w-full mt-1"
              value={selectedStatus}
              onChange={setSelectedStatus}
              options={[
                ...(status === 'ALARM'
                  ? [{ value: 'NORMAL', label: 'NORMAL (Giải quyết ALARM)' }]
                  : [
                      ...(status === 'NORMAL' ? [{ value: 'IN_TRANSIT', label: 'IN_TRANSIT (Đang vận chuyển)' }] : []),
                      ...(status !== 'COMPLETED' ? [{ value: 'COMPLETED', label: 'COMPLETED (Hoàn thành)' }] : []),
                    ]),
              ]}
            />
          </div>
          {status === 'ALARM' && (
            <div>
              <label><input type="checkbox" checked={alarmResolved} onChange={(e) => setAlarmResolved(e.target.checked)} />{' '}Đánh dấu ALARM đã xử lý (xóa AlarmReason, mở khóa bàn giao)</label>
            </div>
          )}
          {status === 'ALARM' && !canResolveAlarmAsCurrentOwner && (
            <Alert
              type="warning"
              showIcon
              message="Chỉ bên đang nắm lô hàng mới có thể xác nhận đã xử lý cảnh báo."
            />
          )}
          <Button type="primary" block loading={statusMut.isPending} icon={<CheckCircleFilled />} onClick={() => statusMut.mutate({ status: selectedStatus, alarmResolved })}>
            Cập nhật
          </Button>
        </Space>
      </Modal>

      <Tabs defaultActiveKey="trace" className="app-tabs" items={[
        {
          key: 'trace', label: 'Hành trình (Trace)',
          children: (
            <Card className="dashboard-card">
              {traceQ.isLoading && <Typography.Text className={traceLoadingCls}>Đang tải trace…</Typography.Text>}
              {traceQ.isError && (
                <Alert type="warning" showIcon className="mb-3" message="Chưa có dữ liệu hành trình để vẽ tuyến đường định vị (vẫn hiển thị bản đồ các cảng)" description={(traceQ.error as Error)?.message} />
              )}
              <TraceRouteMap trace={traceQ.data || null} shipment={shipment} ports={portsMapQ.data || []} />
            </Card>
          ),
        },
        {
          key: 'telemetry', label: 'Cảm biến (Telemetry)',
          children: (
            <Card className="dashboard-card">
              <div className="flex flex-wrap gap-3 items-center mb-4">
                <DatePicker.RangePicker
                  value={telDateRange}
                  onChange={(v) => { setTelDateRange(v || [null, null]); setTelPage(1) }}
                />
                <Button icon={<DownloadOutlined />} onClick={exportCsv}>Export CSV</Button>
              </div>
              {telQ.isError && (
                <Alert type="error" message="Không đọc được telemetry logs" description={(telQ.error as Error)?.message} className="mb-3" />
              )}
              <TelemetryIoTChart logs={telQ.data?.logs ?? []} tempMin={tempMin} tempMax={tempMax} />
              <div className="mt-4 flex justify-end">
                <Pagination current={telPage} pageSize={telLimit} total={telQ.data?.pagination.total ?? 0} onChange={(p) => setTelPage(p)} showSizeChanger={false} />
              </div>
            </Card>
          ),
        },
        {
          key: 'custody', label: 'Chuỗi sở hữu',
          children: (
            <Card className="dashboard-card">
              {custodyQ.isError && (
                <Alert type="warning" message="Không tải ownership-history" description={(custodyQ.error as Error)?.message} className="mb-3" />
              )}
              <CustodyTimeline items={custodyEvents} />
            </Card>
          ),
        },
      ]} />
    </Space>
  )
}