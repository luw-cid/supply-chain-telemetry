import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Form, Input, Modal, Select, Space, Table, Tag, Typography, message } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { createDevice, listDevices } from '../api/devices'
import { useThemeMode } from '../contexts/ThemeContext'

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'green',
  INACTIVE: 'default',
  MAINTENANCE: 'orange',
  RETIRED: 'red',
}

export default function DevicesPage() {
  const { isDark } = useThemeMode()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form] = Form.useForm()

  const devicesQ = useQuery({
    queryKey: ['devices', page, statusFilter, search],
    queryFn: () => listDevices({ page, limit: 25, status: statusFilter, search: search || undefined }),
    retry: false,
  })

  const createMut = useMutation({
    mutationFn: (values: { DeviceID: string; DeviceName?: string; DeviceType?: string; FirmwareVer?: string }) =>
      createDevice(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      setShowCreate(false)
      form.resetFields()
      message.success('Tạo thiết bị thành công')
    },
    onError: (err: Error) => message.error(err.message),
  })

  const titleCls = isDark ? '!text-slate-100' : '!text-slate-900'
  const mutedCls = isDark ? 'text-slate-400' : 'text-slate-600'

  return (
    <Space direction="vertical" size={16} className="w-full">
      <div className="flex items-center justify-between">
        <Typography.Title level={3} className={titleCls}>
          Quản lý thiết bị IoT
        </Typography.Title>
        <Button type="primary" onClick={() => setShowCreate(true)}>
          Thêm thiết bị
        </Button>
      </div>

      <Card className="dashboard-card" bodyStyle={{ padding: 0 }}>
        <div className="p-4 flex flex-wrap gap-3 items-center">
          <Typography.Text className={mutedCls}>Lọc</Typography.Text>
          <Input.Search
            placeholder="Tìm DeviceID / tên"
            allowClear
            style={{ width: 250 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onSearch={() => setPage(1)}
          />
          <Select
            allowClear
            placeholder="Trạng thái"
            style={{ width: 150 }}
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPage(1) }}
            options={[
              { value: 'ACTIVE', label: 'Hoạt động' },
              { value: 'INACTIVE', label: 'Ngừng' },
              { value: 'MAINTENANCE', label: 'Bảo trì' },
              { value: 'RETIRED', label: 'Thanh lý' },
            ]}
          />
        </div>
        <Table
          loading={devicesQ.isLoading}
          dataSource={(devicesQ.data?.data ?? []).map((d) => ({ key: d.DeviceID, ...d }))}
          pagination={{
            current: page,
            pageSize: 25,
            total: devicesQ.data?.meta.total ?? 0,
            onChange: setPage,
          }}
          columns={[
            { title: 'DeviceID', dataIndex: 'DeviceID', key: 'id' },
            { title: 'Tên', dataIndex: 'DeviceName', key: 'name', render: (v: string | null) => v || '-' },
            { title: 'Loại', dataIndex: 'DeviceType', key: 'type', width: 130 },
            {
              title: 'Trạng thái',
              dataIndex: 'Status',
              key: 'status',
              width: 120,
              render: (v: string) => <Tag color={STATUS_COLORS[v]}>{v}</Tag>,
            },
            { title: 'Firmware', dataIndex: 'FirmwareVer', key: 'fw', width: 100, render: (v: string | null) => v || '-' },
            {
              title: 'Gán cho Shipment',
              dataIndex: 'AssignedShipmentID',
              key: 'assigned',
              render: (v: string | null) =>
                v ? <Link to={`/shipments/${v}`}>{v}</Link> : <span className={mutedCls}>-</span>,
            },
            {
              title: 'Ping cuối',
              dataIndex: 'LastPingAtUTC',
              key: 'ping',
              width: 180,
              render: (v: string | null) => (v ? new Date(v).toLocaleString() : '-'),
            },
          ]}
        />
      </Card>

      <Modal
        title="Thêm thiết bị mới"
        open={showCreate}
        onCancel={() => setShowCreate(false)}
        onOk={() => form.submit()}
        confirmLoading={createMut.isPending}
      >
        <Form form={form} layout="vertical" onFinish={(values) => createMut.mutate(values)}>
          <Form.Item name="DeviceID" label="DeviceID" rules={[{ required: true, message: 'Nhập DeviceID' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="DeviceName" label="Tên thiết bị">
            <Input />
          </Form.Item>
          <Form.Item name="DeviceType" label="Loại thiết bị" initialValue="IOT_SENSOR">
            <Select
              options={[
                { value: 'IOT_SENSOR', label: 'IoT Sensor' },
                { value: 'GPS_TRACKER', label: 'GPS Tracker' },
                { value: 'DATA_LOGGER', label: 'Data Logger' },
              ]}
            />
          </Form.Item>
          <Form.Item name="FirmwareVer" label="Phiên bản Firmware">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
