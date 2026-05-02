import { useQuery } from '@tanstack/react-query'
import { Button, Card, DatePicker, Select, Space, Table, Tabs, Typography, message } from 'antd'
import type { Dayjs } from 'dayjs'
import { useState } from 'react'
import { getAggregatedTelemetry, getTelemetryLogs } from '../api/telemetry'
import { exportTelemetryCsv } from '../api/telemetry'
import { listShipments } from '../api/shipments'
import TelemetryIoTChart from '../components/TelemetryIoTChart'
import { useThemeMode } from '../contexts/ThemeContext'

export default function TelemetryManagementPage() {
  const { isDark } = useThemeMode()
  const [selectedShipment, setSelectedShipment] = useState<string | undefined>()
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null])
  const [aggInterval, setAggInterval] = useState<string>('hour')
  const [telPage, setTelPage] = useState(1)

  const startDate = dateRange[0] ? dateRange[0].toISOString() : undefined
  const endDate = dateRange[1] ? dateRange[1].toISOString() : undefined

  const shipmentsQ = useQuery({
    queryKey: ['shipments', 'list'],
    queryFn: () => listShipments({ limit: 200 }),
    retry: false,
  })

  const telQ = useQuery({
    queryKey: ['telemetry', 'management', selectedShipment, telPage, startDate, endDate],
    queryFn: () =>
      getTelemetryLogs(selectedShipment!, {
        page: telPage,
        limit: 50,
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
      }),
    enabled: Boolean(selectedShipment),
    retry: false,
  })

  const aggQ = useQuery({
    queryKey: ['telemetry', 'aggregate', selectedShipment, aggInterval, startDate, endDate],
    queryFn: () =>
      getAggregatedTelemetry(selectedShipment!, {
        interval: aggInterval,
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
      }),
    enabled: Boolean(selectedShipment),
    retry: false,
  })

  const handleExport = async () => {
    if (!selectedShipment) return
    try {
      const blob = await exportTelemetryCsv(selectedShipment, {
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `telemetry_${selectedShipment}.csv`
      a.click()
      URL.revokeObjectURL(url)
      message.success('Export CSV thành công')
    } catch {
      message.error('Lỗi export CSV')
    }
  }

  const shipmentOptions = (shipmentsQ.data?.data ?? []).map((s) => ({
    value: s.ShipmentID,
    label: `${s.ShipmentID} (${s.OriginPortName} → ${s.DestinationPortName})`,
  }))

  const titleCls = isDark ? '!text-slate-100' : '!text-slate-900'
  const mutedCls = isDark ? 'text-slate-400' : 'text-slate-600'

  return (
    <Space direction="vertical" size={16} className="w-full">
      <Typography.Title level={3} className={titleCls}>
        Quản trị Telemetry
      </Typography.Title>

      <Card className="dashboard-card">
        <Space wrap className="w-full">
          <Select
            showSearch
            allowClear
            placeholder="Chọn Shipment"
            style={{ minWidth: 320 }}
            value={selectedShipment}
            onChange={(v) => { setSelectedShipment(v); setTelPage(1) }}
            options={shipmentOptions}
            filterOption={(input, option) =>
              (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
            }
          />
          <DatePicker.RangePicker
            value={dateRange}
            onChange={(v) => setDateRange(v || [null, null])}
          />
          <Button type="primary" onClick={handleExport} disabled={!selectedShipment}>
            Export CSV
          </Button>
        </Space>
      </Card>

      {selectedShipment && (
        <Tabs
          className="app-tabs"
          items={[
            {
              key: 'chart',
              label: 'Biểu đồ',
              children: (
                <Card className="dashboard-card">
                  <TelemetryIoTChart logs={telQ.data?.logs ?? []} />
                </Card>
              ),
            },
            {
              key: 'aggregate',
              label: 'Tổng hợp',
              children: (
                <Card className="dashboard-card">
                  <div className="mb-4">
                    <Space>
                      <Typography.Text className={mutedCls}>Khoảng</Typography.Text>
                      <Select
                        value={aggInterval}
                        onChange={setAggInterval}
                        options={[
                          { value: 'minute', label: 'Phút' },
                          { value: 'hour', label: 'Giờ' },
                          { value: 'day', label: 'Ngày' },
                          { value: 'week', label: 'Tuần' },
                          { value: 'month', label: 'Tháng' },
                        ]}
                      />
                    </Space>
                  </div>
                  <Table
                    loading={aggQ.isLoading}
                    dataSource={(aggQ.data ?? []).map((r, i) => ({ key: i, ...r }))}
                    columns={[
                      { title: 'Khoảng', dataIndex: 'interval', key: 'interval' },
                      { title: 'Số điểm', dataIndex: 'count', key: 'count' },
                      { title: 'Temp TB', dataIndex: 'avgTemp', key: 'avgTemp', render: (v: number) => `${v}°C` },
                      { title: 'Temp Min', dataIndex: 'minTemp', key: 'minTemp', render: (v: number) => `${v}°C` },
                      { title: 'Temp Max', dataIndex: 'maxTemp', key: 'maxTemp', render: (v: number) => `${v}°C` },
                      { title: 'Độ ẩm TB', dataIndex: 'avgHumidity', key: 'avgHumidity', render: (v: number | null) => v != null ? `${v}%` : '-' },
                    ]}
                    pagination={false}
                    size="small"
                  />
                </Card>
              ),
            },
            {
              key: 'raw',
              label: 'Dữ liệu thô',
              children: (
                <Card className="dashboard-card">
                  <Table
                    loading={telQ.isLoading}
                    dataSource={(telQ.data?.logs ?? []).map((l, i) => ({ key: i, ...l }))}
                    pagination={{
                      current: telPage,
                      pageSize: 50,
                      total: telQ.data?.pagination.total ?? 0,
                      onChange: setTelPage,
                    }}
                    columns={[
                      { title: 'Thời gian', dataIndex: 'timestamp', key: 't', width: 180, render: (v: string) => new Date(v).toLocaleString() },
                      { title: 'Device', dataIndex: 'device_id', key: 'device' },
                      { title: 'Nhiệt độ', dataIndex: 'temp', key: 'temp', render: (v: number) => `${v}°C` },
                      { title: 'Độ ẩm', dataIndex: 'humidity', key: 'humidity', render: (v: number | null) => v != null ? `${v}%` : '-' },
                      {
                        title: 'Vị trí',
                        key: 'location',
                        render: (_, row) => {
                          const loc = row.location as { lat?: number; lng?: number } | null
                          return loc ? `${loc.lat?.toFixed(4)}, ${loc.lng?.toFixed(4)}` : '-'
                        },
                      },
                    ]}
                    size="small"
                  />
                </Card>
              ),
            },
          ]}
        />
      )}
    </Space>
  )
}
