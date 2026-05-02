import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Card, DatePicker, Select, Space, Table, Tabs, Tag, Typography, message } from 'antd'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { useMemo, useState } from 'react'
import { listAlarms, updateAlarm, type AlarmRow } from '../api/alarms'
import { listAuditLogs } from '../api/audit'
import { getApiErrorMessage } from '../api/client'
import { Link } from 'react-router-dom'
import { useThemeMode } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'

const SEVERITY_COLORS: Record<string, string> = { LOW: 'blue', MEDIUM: 'orange', HIGH: 'red', CRITICAL: 'darkred' }
const STATUS_COLORS: Record<string, string> = { OPEN: 'red', ACKNOWLEDGED: 'orange', RESOLVED: 'green', FALSE_ALARM: 'grey' }

export default function AuditAlertsPage() {
  const { isDark } = useThemeMode()
  const { user } = useAuth()
  const qc = useQueryClient()
  const [alarmRange, setAlarmRange] = useState<[Dayjs | null, Dayjs | null]>([null, null])
  const [auditRange, setAuditRange] = useState<[Dayjs | null, Dayjs | null]>([null, null])
  const [alarmPage, setAlarmPage] = useState(1)
  const [auditPage, setAuditPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [severityFilter, setSeverityFilter] = useState<string | undefined>(undefined)
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined)

  const fromA = alarmRange[0] ? dayjs(alarmRange[0]).startOf('day').toISOString() : undefined
  const toA = alarmRange[1] ? dayjs(alarmRange[1]).endOf('day').toISOString() : undefined
  const fromAu = auditRange[0] ? dayjs(auditRange[0]).startOf('day').toISOString() : undefined
  const toAu = auditRange[1] ? dayjs(auditRange[1]).endOf('day').toISOString() : undefined

  const alarmsQ = useQuery({
    queryKey: ['alarms', 'full', alarmPage, statusFilter, severityFilter, typeFilter, fromA, toA],
    queryFn: () =>
      listAlarms({
        page: alarmPage, limit: 25,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(severityFilter ? { severity: severityFilter } : {}),
        ...(typeFilter ? { alarmType: typeFilter } : {}),
        ...(fromA ? { fromDate: fromA } : {}),
        ...(toA ? { toDate: toA } : {}),
      }),
    retry: false,
  })

  const auditQ = useQuery({
    queryKey: ['audit', auditPage, fromAu, toAu],
    queryFn: () =>
      listAuditLogs({ page: auditPage, limit: 25, ...(fromAu ? { fromDate: fromAu } : {}), ...(toAu ? { toDate: toAu } : {}) }),
    retry: false,
  })

  const updateMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACKNOWLEDGED' | 'RESOLVED' | 'FALSE_ALARM' }) => updateAlarm(id, status),
    onSuccess: () => { message.success('Đã cập nhật cảnh báo'); qc.invalidateQueries({ queryKey: ['alarms'] }) },
    onError: (e) => message.error(getApiErrorMessage(e)),
  })

  const titleCls = isDark ? '!text-slate-100' : '!text-slate-900'
  const mutedCls = isDark ? 'text-slate-400' : 'text-slate-600'

  const alarmTypes = useMemo(() => {
    const types = new Set<string>()
    ;(alarmsQ.data?.data ?? []).forEach((a) => types.add(a.AlarmType))
    return Array.from(types).sort()
  }, [alarmsQ.data])

  return (
    <Space direction="vertical" size={16} className="w-full">
      <Typography.Title level={3} className={titleCls}>Cảnh báo & Kiểm toán</Typography.Title>
      <Tabs className="app-tabs" items={[
        {
          key: 'alarms', label: 'Cảnh báo',
          children: (
            <Card className="dashboard-card" bodyStyle={{ padding: 0 }}>
              <div className="p-4 flex flex-wrap gap-3 items-center">
                <Typography.Text className={mutedCls}>Lọc</Typography.Text>
                <DatePicker.RangePicker value={alarmRange} onChange={(v) => { setAlarmRange(v || [null, null]); setAlarmPage(1) }} />
                <Select allowClear placeholder="Trạng thái" style={{ width: 150 }} value={statusFilter} onChange={(v) => { setStatusFilter(v); setAlarmPage(1) }} options={[
                  { value: 'OPEN', label: 'OPEN' }, { value: 'ACKNOWLEDGED', label: 'ACKNOWLEDGED' },
                  { value: 'RESOLVED', label: 'RESOLVED' }, { value: 'FALSE_ALARM', label: 'FALSE_ALARM' },
                ]} />
                <Select allowClear placeholder="Mức độ" style={{ width: 130 }} value={severityFilter} onChange={(v) => { setSeverityFilter(v); setAlarmPage(1) }} options={[
                  { value: 'LOW', label: 'LOW' }, { value: 'MEDIUM', label: 'MEDIUM' },
                  { value: 'HIGH', label: 'HIGH' }, { value: 'CRITICAL', label: 'CRITICAL' },
                ]} />
                <Select allowClear placeholder="Loại" style={{ width: 180 }} value={typeFilter} onChange={(v) => { setTypeFilter(v); setAlarmPage(1) }} options={alarmTypes.map((t) => ({ value: t, label: t }))} />
              </div>
              <Table
                loading={alarmsQ.isLoading}
                dataSource={(alarmsQ.data?.data ?? []).map((a) => ({ key: a.AlarmEventID, ...a }))}
                pagination={{ current: alarmPage, pageSize: 25, total: alarmsQ.data?.meta.total ?? 0, onChange: setAlarmPage }}
                locale={{ emptyText: alarmsQ.isError ? 'Lỗi tải (kiểm tra DB AlarmEvents / JWT).' : 'Không có dữ liệu' }}
                columns={[
                  { title: 'Thời gian', dataIndex: 'AlarmAtUTC', key: 't', width: 170, render: (v: string) => new Date(v).toLocaleString() },
                  { title: 'Shipment', dataIndex: 'ShipmentID', key: 's', render: (id: string) => <Link to={`/shipments/${id}`}>{id}</Link> },
                  { title: 'Loại', dataIndex: 'AlarmType', key: 'ty', render: (v: string) => <Tag>{v}</Tag> },
                  { title: 'Mức độ', dataIndex: 'Severity', key: 'sev', render: (v: string) => <Tag color={SEVERITY_COLORS[v] || 'default'}>{v}</Tag> },
                  { title: 'Trạng thái', dataIndex: 'Status', key: 'st', render: (v: string) => <Tag color={STATUS_COLORS[v] || 'default'}>{v}</Tag> },
                  { title: 'Lý do', dataIndex: 'AlarmReason', key: 'r', ellipsis: true },
                  {
                    title: 'Thao tác', key: 'act', width: 220,
                    render: (_, r: AlarmRow) => (
                      <Space>
                        {r.Status === 'OPEN' && (
                          <>
                            <Button size="small" loading={updateMut.isPending} onClick={() => updateMut.mutate({ id: r.AlarmEventID, status: 'ACKNOWLEDGED' })}>
                              Xác nhận
                            </Button>
                            <Button size="small" loading={updateMut.isPending} onClick={() => updateMut.mutate({ id: r.AlarmEventID, status: 'RESOLVED' })}>
                              Đóng
                            </Button>
                            <Button size="small" danger loading={updateMut.isPending} onClick={() => updateMut.mutate({ id: r.AlarmEventID, status: 'FALSE_ALARM' })}>
                              Bỏ qua
                            </Button>
                          </>
                        )}
                        {r.Status === 'ACKNOWLEDGED' && user?.role === 'ADMIN' && (
                          <Button size="small" loading={updateMut.isPending} onClick={() => updateMut.mutate({ id: r.AlarmEventID, status: 'RESOLVED' })}>
                            Đóng
                          </Button>
                        )}
                      </Space>
                    ),
                  },
                ]}
              />
            </Card>
          ),
        },
        {
          key: 'audit', label: 'Kiểm toán',
          children: (
            <Card className="dashboard-card" bodyStyle={{ padding: 0 }}>
              <div className="p-4 flex flex-wrap gap-3 items-center">
                <Typography.Text className={mutedCls}>Lọc thời gian</Typography.Text>
                <DatePicker.RangePicker value={auditRange} onChange={(v) => { setAuditRange(v || [null, null]); setAuditPage(1) }} />
              </div>
              <Table
                loading={auditQ.isLoading}
                dataSource={(auditQ.data?.data ?? []).map((a) => ({ key: String(a.AuditID), ...a }))}
                pagination={{ current: auditPage, pageSize: 25, total: auditQ.data?.meta.total ?? 0, onChange: setAuditPage }}
                locale={{ emptyText: auditQ.isError ? 'Lỗi tải (kiểm tra AuditLog / partition DB).' : 'Không có dữ liệu' }}
                columns={[
                  { title: 'Thời gian', dataIndex: 'ChangedAtUTC', key: 't', width: 200, render: (v: string) => new Date(v).toLocaleString() },
                  { title: 'Người thực hiện', dataIndex: 'ChangedBy', key: 'u' },
                  { title: 'Bảng', dataIndex: 'TableName', key: 'tb' },
                  { title: 'Hành động', dataIndex: 'Operation', key: 'op' },
                  { title: 'Old → New', key: 'diff', ellipsis: true, render: (_, row) => (
                    <Typography.Text className={isDark ? 'text-slate-400 text-xs font-mono' : 'text-slate-600 text-xs font-mono'}>
                      {JSON.stringify(row.OldValue)} → {JSON.stringify(row.NewValue)}
                    </Typography.Text>
                  )},
                ]}
              />
            </Card>
          ),
        },
      ]} />
    </Space>
  )
}
