import { useQuery } from '@tanstack/react-query'
import { Card, DatePicker, Space, Table, Tabs, Typography } from 'antd'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { useState } from 'react'
import { listAlarms } from '../api/alarms'
import { listAuditLogs } from '../api/audit'
import { Link } from 'react-router-dom'
import { useThemeMode } from '../contexts/ThemeContext'

export default function AuditAlertsPage() {
  const { isDark } = useThemeMode()
  const [alarmRange, setAlarmRange] = useState<[Dayjs | null, Dayjs | null]>([null, null])
  const [auditRange, setAuditRange] = useState<[Dayjs | null, Dayjs | null]>([null, null])
  const [alarmPage, setAlarmPage] = useState(1)
  const [auditPage, setAuditPage] = useState(1)

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

  const titleCls = isDark ? '!text-slate-100' : '!text-slate-900'
  const mutedCls = isDark ? 'text-slate-400' : 'text-slate-600'
  const monoCls = isDark ? 'text-slate-400 text-xs font-mono' : 'text-slate-600 text-xs font-mono'

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
                    { title: 'Thời gian', dataIndex: 'AlarmAtUTC', key: 't', width: 200, render: (v: string) => new Date(v).toLocaleString() },
                    { title: 'Shipment', dataIndex: 'ShipmentID', key: 's', render: (id: string) => <Link to={`/shipments/${id}`}>{id}</Link> },
                    { title: 'Loại', dataIndex: 'AlarmType', key: 'ty' },
                    { title: 'Trạng thái', dataIndex: 'Status', key: 'st' },
                    { title: 'Lý do', dataIndex: 'AlarmReason', key: 'r', ellipsis: true },
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
