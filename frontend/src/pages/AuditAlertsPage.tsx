import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, DatePicker, Select, Space, Table, Tag, Tabs, Tooltip, Typography } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { acknowledgeAlarm, assignAlarm, listAlarms, resolveAlarm } from '../api/alarms'
import { listAuditLogs } from '../api/audit'
import { useAuth } from '../contexts/AuthContext'
import { useThemeMode } from '../contexts/ThemeContext'

const ALARM_TYPE_MAP: Record<string, string> = {
  TEMP_VIOLATION: 'Nhiệt độ',
  CHECKIN_TIMEOUT: 'Check-in',
  MANUAL: 'Thủ công',
  HUMIDITY_VIOLATION: 'Độ ẩm',
  ROUTE_DEVIATION: 'Lộ trình',
  UNAUTHORIZED_ACCESS: 'Truy cập',
  DEVICE_MALFUNCTION: 'Thiết bị',
}

const SEVERITY_COLORS: Record<string, string> = {
  LOW: 'blue',
  MEDIUM: 'orange',
  HIGH: 'red',
  CRITICAL: 'purple',
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'red',
  ACKNOWLEDGED: 'orange',
  RESOLVED: 'green',
  FALSE_ALARM: 'default',
}

export default function AuditAlertsPage() {
  const { isDark } = useThemeMode()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [alarmRange, setAlarmRange] = useState<[Dayjs | null, Dayjs | null]>([null, null])
  const [auditRange, setAuditRange] = useState<[Dayjs | null, Dayjs | null]>([null, null])
  const [alarmPage, setAlarmPage] = useState(1)
  const [auditPage, setAuditPage] = useState(1)
  const [severityFilter, setSeverityFilter] = useState<string | undefined>()
  const [alarmTypeFilter, setAlarmTypeFilter] = useState<string | undefined>()
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const fromA = alarmRange[0] ? dayjs(alarmRange[0]).startOf('day').toISOString() : undefined
  const toA = alarmRange[1] ? dayjs(alarmRange[1]).endOf('day').toISOString() : undefined
  const fromAu = auditRange[0] ? dayjs(auditRange[0]).startOf('day').toISOString() : undefined
  const toAu = auditRange[1] ? dayjs(auditRange[1]).endOf('day').toISOString() : undefined

  const alarmsQ = useQuery({
    queryKey: ['alarms', 'full', alarmPage, fromA, toA, severityFilter, alarmTypeFilter, statusFilter],
    queryFn: () =>
      listAlarms({
        page: alarmPage,
        limit: 25,
        ...(fromA ? { fromDate: fromA } : {}),
        ...(toA ? { toDate: toA } : {}),
        ...(severityFilter ? { severity: severityFilter } : {}),
        ...(alarmTypeFilter ? { alarmType: alarmTypeFilter } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
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

  const ackMut = useMutation({
    mutationFn: (id: string) => acknowledgeAlarm(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alarms'] }),
  })

  const assignMut = useMutation({
    mutationFn: ({ id, to }: { id: string; to: string }) => assignAlarm(id, to),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alarms'] }),
  })

  const resolveMut = useMutation({
    mutationFn: ({ id, resolution, newStatus: ns }: { id: string; resolution: string; newStatus?: string }) => resolveAlarm(id, resolution, ns),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alarms'] }),
  })

  const canAct = user?.role === 'ADMIN' || user?.role === 'LOGISTICS'

  const titleCls = isDark ? '!text-slate-100' : '!text-slate-900'
  const mutedCls = isDark ? 'text-slate-400' : 'text-slate-600'
  const monoCls = isDark ? 'text-slate-400 text-xs font-mono' : 'text-slate-600 text-xs font-mono'

  const alarmTypes = [...new Set((alarmsQ.data?.data ?? []).map((a) => a.AlarmType))]

  function formatAlarmAge(hours: number | undefined | null): string {
    if (hours == null) return '-'
    if (hours < 1) return `${Math.round(hours * 60)}m`
    if (hours < 24) return `${Math.round(hours)}h`
    return `${Math.round(hours / 24)}d ${Math.round(hours % 24)}h`
  }

  return (
    <Space direction="vertical" size={16} className="w-full">
      <Typography.Title level={3} className={titleCls}>
        Cảnh báo & Kiểm toán
      </Typography.Title>

      <Tabs
        className="app-tabs"
        items={[
          {
            key: 'alarms',
            label: 'Cảnh báo',
            children: (
              <Card className="dashboard-card" bodyStyle={{ padding: 0 }}>
                <div className="p-4 flex flex-wrap gap-3 items-center">
                  <Typography.Text className={mutedCls}>Lọc</Typography.Text>
                  <DatePicker.RangePicker
                    value={alarmRange}
                    onChange={(v) => {
                      setAlarmRange(v || [null, null])
                      setAlarmPage(1)
                    }}
                  />
                  <Select
                    allowClear
                    placeholder="Mức độ"
                    style={{ width: 130 }}
                    value={severityFilter}
                    onChange={(v) => { setSeverityFilter(v); setAlarmPage(1) }}
                    options={[
                      { value: 'LOW', label: 'Thấp' },
                      { value: 'MEDIUM', label: 'Trung bình' },
                      { value: 'HIGH', label: 'Cao' },
                      { value: 'CRITICAL', label: 'Nghiêm trọng' },
                    ]}
                  />
                  <Select
                    allowClear
                    placeholder="Loại"
                    style={{ width: 160 }}
                    value={alarmTypeFilter}
                    onChange={(v) => { setAlarmTypeFilter(v); setAlarmPage(1) }}
                    options={alarmTypes.map((t) => ({ value: t, label: ALARM_TYPE_MAP[t] || t }))}
                  />
                  <Select
                    allowClear
                    placeholder="Trạng thái"
                    style={{ width: 150 }}
                    value={statusFilter}
                    onChange={(v) => { setStatusFilter(v); setAlarmPage(1) }}
                    options={[
                      { value: 'OPEN', label: 'Mở' },
                      { value: 'ACKNOWLEDGED', label: 'Đã xác nhận' },
                      { value: 'RESOLVED', label: 'Đã giải quyết' },
                      { value: 'FALSE_ALARM', label: 'False Alarm' },
                    ]}
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
                    {
                      title: 'Tuổi',
                      dataIndex: 'AlarmAgeHours',
                      key: 'age',
                      width: 70,
                      sorter: (a, b) => (a.AlarmAgeHours ?? 0) - (b.AlarmAgeHours ?? 0),
                      render: (hours: number | undefined | null, row) => (
                        <Tooltip title={row.AlarmAtUTC ? new Date(row.AlarmAtUTC).toLocaleString() : ''}>
                          <Tag color={hours != null && hours > 48 ? 'red' : hours != null && hours > 24 ? 'orange' : 'default'}>
                            {formatAlarmAge(hours)}
                          </Tag>
                        </Tooltip>
                      ),
                    },
                    { title: 'Thời gian', dataIndex: 'AlarmAtUTC', key: 't', width: 180, render: (v: string) => new Date(v).toLocaleString() },
                    { title: 'Shipment', dataIndex: 'ShipmentID', key: 's', render: (id: string) => <Link to={`/shipments/${id}`}>{id}</Link> },
                    {
                      title: 'Loại',
                      dataIndex: 'AlarmType',
                      key: 'ty',
                      width: 120,
                      render: (v: string) => ALARM_TYPE_MAP[v] || v,
                    },
                    {
                      title: 'Mức độ',
                      dataIndex: 'Severity',
                      key: 'sev',
                      width: 100,
                      render: (v: string) => <Tag color={SEVERITY_COLORS[v]}>{v}</Tag>,
                    },
                    {
                      title: 'Trạng thái',
                      dataIndex: 'Status',
                      key: 'st',
                      width: 120,
                      render: (v: string) => <Tag color={STATUS_COLORS[v]}>{v}</Tag>,
                    },
                    {
                      title: 'Xử lý bởi',
                      key: 'handler',
                      width: 150,
                      render: (_, row) => {
                        if (row.Status === 'RESOLVED' || row.Status === 'FALSE_ALARM') {
                          return <span className={monoCls}>{row.ResolvedBy || '-'}</span>
                        }
                        if (row.Status === 'ACKNOWLEDGED') {
                          return <span className={monoCls}>{row.AcknowledgedBy || '-'}</span>
                        }
                        if (row.AssignedTo) {
                          return <span className={monoCls}>{row.AssignedTo}</span>
                        }
                        return '-'
                      },
                    },
                    { title: 'Lý do', dataIndex: 'AlarmReason', key: 'r', ellipsis: true },
                    ...(canAct
                      ? [
                          {
                            title: 'Hành động',
                            key: 'action',
                            width: 280,
                            render: (_: unknown, row: { AlarmEventID: string; Status: string }) => {
                              const openOrAck = row.Status === 'OPEN' || row.Status === 'ACKNOWLEDGED'
                              return (
                                <Space size="small" wrap>
                                  {row.Status === 'OPEN' && (
                                    <Button size="small" loading={ackMut.isPending} onClick={() => ackMut.mutate(row.AlarmEventID)}>
                                      Xác nhận
                                    </Button>
                                  )}
                                  {openOrAck && (
                                    <Button
                                      size="small"
                                      onClick={() => {
                                        const to = prompt('Gán cho UserID:')
                                        if (to) assignMut.mutate({ id: row.AlarmEventID, to })
                                      }}
                                    >
                                      Gán
                                    </Button>
                                  )}
                                  {openOrAck && (
                                    <Button
                                      size="small"
                                      type="primary"
                                      onClick={() => {
                                        const resolution = prompt('Ghi chú giải quyết:')
                                        if (resolution) resolveMut.mutate({ id: row.AlarmEventID, resolution })
                                      }}
                                    >
                                      Giải quyết
                                    </Button>
                                  )}
                                  {openOrAck && (
                                    <Button
                                      size="small"
                                      danger
                                      onClick={() => {
                                        const note = prompt('Lý do false alarm:')
                                        if (note) resolveMut.mutate({ id: row.AlarmEventID, resolution: note, newStatus: 'FALSE_ALARM' as const })
                                      }}
                                    >
                                      False Alarm
                                    </Button>
                                  )}
                                </Space>
                              )
                            },
                          },
                        ]
                      : []),
                  ]}
                />
              </Card>
            ),
          },
          {
            key: 'audit',
            label: 'Kiểm toán',
            children: (
              <Card className="dashboard-card" bodyStyle={{ padding: 0 }}>
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
    </Space>
  )
}
