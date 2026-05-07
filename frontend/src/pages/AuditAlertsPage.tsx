import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge, Button, Card, DatePicker, message, Modal, Space, Table, Tabs, Tag, Typography } from 'antd'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { useState } from 'react'
import TextArea from 'antd/es/input/TextArea'
import { createAlarm, listAlarms, updateAlarm } from '../api/alarms'
import { listAuditLogs } from '../api/audit'
import TelemetrySimulator from '../components/TelemetrySimulator'
import { Link } from 'react-router-dom'
import { useThemeMode } from '../contexts/ThemeContext'

export default function AuditAlertsPage() {
  const { isDark } = useThemeMode()
  const [alarmRange, setAlarmRange] = useState<[Dayjs | null, Dayjs | null]>([null, null])
  const [auditRange, setAuditRange] = useState<[Dayjs | null, Dayjs | null]>([null, null])
  const [alarmPage, setAlarmPage] = useState(1)
  const [auditPage, setAuditPage] = useState(1)
  const [simOpen, setSimOpen] = useState(false)
  const [simRunning, setSimRunning] = useState(false)
  const [resolveModal, setResolveModal] = useState<{ alarmId: string; status: 'RESOLVED' | 'FALSE_ALARM'; note: string } | null>(null)

  const fromA = alarmRange[0] ? dayjs(alarmRange[0]).startOf('day').toISOString() : undefined
  const toA = alarmRange[1] ? dayjs(alarmRange[1]).endOf('day').toISOString() : undefined
  const fromAu = auditRange[0] ? dayjs(auditRange[0]).startOf('day').toISOString() : undefined
  const toAu = auditRange[1] ? dayjs(auditRange[1]).endOf('day').toISOString() : undefined

  const alarmsQ = useQuery({
    queryKey: ['alarms', 'full', alarmPage, fromA, toA],
    queryFn: () =>
      listAlarms({
        page: alarmPage,
        limit: 25,
        ...(fromA ? { fromDate: fromA } : {}),
        ...(toA ? { toDate: toA } : {}),
      }),
    retry: false,
  })

  const auditQ = useQuery({
    queryKey: ['audit', auditPage, fromAu, toAu],
    queryFn: () =>
      listAuditLogs({
        page: auditPage,
        limit: 25,
        ...(fromAu ? { fromDate: fromAu } : {}),
        ...(toAu ? { toDate: toAu } : {}),
      }),
    retry: false,
  })

  const queryClient = useQueryClient()

  const updateAlarmMut = useMutation({
    mutationFn: ({ id, status, resolutionNote }: { id: string; status: 'ACKNOWLEDGED' | 'RESOLVED' | 'FALSE_ALARM'; resolutionNote?: string | null }) =>
      updateAlarm(id, status, resolutionNote),
    onSuccess: () => {
      message.success('Đã cập nhật trạng thái alarm!')
      queryClient.invalidateQueries({ queryKey: ['alarms'] })
    },
    onError: () => {
      message.error('Cập nhật thất bại.')
    },
  })

  const createAlarmMut = useMutation({
    mutationFn: () =>
      createAlarm({
        shipmentId: 'SHP-E2E-001',
        alarmType: 'MANUAL',
        severity: 'HIGH',
        alarmReason: 'Test alert từ nút Test Alert',
      }),
    onSuccess: () => {
      message.success('Đã tạo alert test thành công!')
      queryClient.invalidateQueries({ queryKey: ['alarms'] })
    },
    onError: () => {
      message.error('Tạo alert thất bại, kiểm tra lại kết nối DB.')
    },
  })

  const titleCls = isDark ? '!text-slate-100' : '!text-slate-900'
  const mutedCls = isDark ? 'text-slate-400' : 'text-slate-600'
  const monoCls = isDark ? 'text-slate-400 text-xs font-mono' : 'text-slate-600 text-xs font-mono'

  return (
    <Space orientation="vertical" size={16} className="w-full">
      <div className="flex items-center justify-between">
        <Typography.Title level={3} className={titleCls}>
          Cảnh báo & Kiểm toán
        </Typography.Title>
        <Space>
          <Button type="primary" loading={createAlarmMut.isPending} onClick={() => createAlarmMut.mutate()}>
            Test Alert
          </Button>
          <Badge dot={simRunning}>
            <Button onClick={() => setSimOpen(true)}>
              Simulator
            </Button>
          </Badge>
        </Space>
      </div>

      <Tabs
        className="app-tabs"
        items={[
          {
            key: 'alarms',
            label: 'Cảnh báo',
            children: (
              <Card className="dashboard-card" styles={{ body: { padding: 0 } }}>
                <div className="p-4 flex flex-wrap gap-3 items-center">
                  <Typography.Text className={mutedCls}>Lọc thời gian</Typography.Text>
                  <DatePicker.RangePicker
                    value={alarmRange}
                    onChange={(v) => {
                      setAlarmRange(v || [null, null])
                      setAlarmPage(1)
                    }}
                  />
                </div>
                <Table
                  loading={alarmsQ.isLoading}
                  dataSource={(alarmsQ.data?.data ?? []).map((a) => ({ key: a.AlarmEventID, ...a }))}
                  pagination={{
                    current: alarmPage,
                    pageSize: 25,
                    total: alarmsQ.data?.meta.total ?? 0,
                    onChange: setAlarmPage,
                  }}
                  locale={{
                    emptyText: alarmsQ.isError ? 'Lỗi tải (kiểm tra DB AlarmEvents / JWT).' : 'Không có dữ liệu',
                  }}
                  columns={[
                    { title: 'Thời gian', dataIndex: 'AlarmAtUTC', key: 't', width: 160, render: (v: string) => new Date(v).toLocaleString() },
                    { title: 'Shipment', dataIndex: 'ShipmentID', key: 's', width: 140, render: (id: string) => <Link to={`/shipments/${id}`}>{id}</Link> },
                    { title: 'Loại', dataIndex: 'AlarmType', key: 'ty', width: 120 },
                    { title: 'Trạng thái', dataIndex: 'Status', key: 'st', width: 110, render: (v: string) => <Tag color={v === 'RESOLVED' || v === 'FALSE_ALARM' ? 'green' : v === 'ACKNOWLEDGED' ? 'blue' : 'volcano'}>{v}</Tag> },
                    { title: 'Lý do', dataIndex: 'AlarmReason', key: 'r', ellipsis: true },
                    {
                      title: 'Ghi chú',
                      dataIndex: 'ResolutionNote',
                      key: 'note',
                      width: 180,
                      ellipsis: true,
                      render: (v: string, row: any) =>
                        row.Status === 'RESOLVED' || row.Status === 'FALSE_ALARM'
                          ? <Typography.Text type="secondary">{v || '—'}</Typography.Text>
                          : null,
                    },
                    {
                      title: 'Xử lý',
                      key: 'action',
                      width: 280,
                      render: (_, row) =>
                        row.Status === 'OPEN' || row.Status === 'ACKNOWLEDGED' ? (
                          <Space size={4}>
                            {row.Status === 'OPEN' && (
                              <Button
                                size="small"
                                type="primary"
                                loading={updateAlarmMut.isPending}
                                onClick={() => updateAlarmMut.mutate({ id: row.AlarmEventID, status: 'ACKNOWLEDGED' })}
                              >
                                Acknowledge
                              </Button>
                            )}
                            <Button
                              size="small"
                              loading={updateAlarmMut.isPending}
                              onClick={() => setResolveModal({ alarmId: row.AlarmEventID, status: 'RESOLVED', note: '' })}
                            >
                              Resolve
                            </Button>
                            <Button
                              size="small"
                              danger
                              loading={updateAlarmMut.isPending}
                              onClick={() => setResolveModal({ alarmId: row.AlarmEventID, status: 'FALSE_ALARM', note: '' })}
                            >
                              False Alarm
                            </Button>
                          </Space>
                        ) : null,
                    },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: 'audit',
            label: 'Kiểm toán',
            children: (
              <Card className="dashboard-card" styles={{ body: { padding: 0 } }}>
                <div className="p-4 flex flex-wrap gap-3 items-center">
                  <Typography.Text className={mutedCls}>Lọc thời gian</Typography.Text>
                  <DatePicker.RangePicker
                    value={auditRange}
                    onChange={(v) => {
                      setAuditRange(v || [null, null])
                      setAuditPage(1)
                    }}
                  />
                </div>
                <Table
                  loading={auditQ.isLoading}
                  dataSource={(auditQ.data?.data ?? []).map((a) => ({ key: String(a.AuditID), ...a }))}
                  pagination={{
                    current: auditPage,
                    pageSize: 25,
                    total: auditQ.data?.meta.total ?? 0,
                    onChange: setAuditPage,
                  }}
                  locale={{
                    emptyText: auditQ.isError ? 'Lỗi tải (kiểm tra AuditLog / partition DB).' : 'Không có dữ liệu',
                  }}
                  columns={[
                    { title: 'Thời gian', dataIndex: 'ChangedAtUTC', key: 't', width: 200, render: (v: string) => new Date(v).toLocaleString() },
                    { title: 'Người thực hiện', dataIndex: 'ChangedBy', key: 'u' },
                    { title: 'Bảng', dataIndex: 'TableName', key: 'tb' },
                    { title: 'Hành động', dataIndex: 'Operation', key: 'op' },
                    {
                      title: 'Old → New',
                      key: 'diff',
                      ellipsis: true,
                      render: (_, row) => (
                        <Typography.Text className={monoCls}>
                          {JSON.stringify(row.OldValue)} → {JSON.stringify(row.NewValue)}
                        </Typography.Text>
                      ),
                    },
                  ]}
                />
              </Card>
            ),
          },
        ]}
      />
      <Modal
        title={resolveModal?.status === 'RESOLVED' ? 'Xác nhận Resolve' : 'Xác nhận False Alarm'}
        open={!!resolveModal}
        onCancel={() => setResolveModal(null)}
        okText="Xác nhận"
        okButtonProps={{ loading: updateAlarmMut.isPending }}
        onOk={() => {
          if (!resolveModal) return
          updateAlarmMut.mutate({ id: resolveModal.alarmId, status: resolveModal.status, resolutionNote: resolveModal.note || null })
          setResolveModal(null)
        }}
      >
        <Space direction="vertical" className="w-full">
          <Typography.Text>
            Bạn có chắc muốn đánh dấu alarm này là <strong>{resolveModal?.status === 'RESOLVED' ? 'đã xử lý' : 'false alarm'}</strong>?
          </Typography.Text>
          {resolveModal?.status === 'RESOLVED' && (
            <div>
              <Typography.Text type="secondary">Ghi chú xử lý:</Typography.Text>
              <TextArea
                rows={3}
                value={resolveModal?.note ?? ''}
                onChange={(e) => setResolveModal((prev) => prev ? { ...prev, note: e.target.value } : null)}
                placeholder="Nhập ghi chú xử lý (tùy chọn)..."
              />
            </div>
          )}
        </Space>
      </Modal>
      <TelemetrySimulator open={simOpen} onClose={() => setSimOpen(false)} onRunningChange={setSimRunning} />
    </Space>
  )
}
