import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Form, Input, InputNumber, Modal, Select, Space, Table, Typography, message } from 'antd'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { createShipment, listShipments, type CreateShipmentPayload } from '../api/shipments'
import { listCargoProfiles, listParties, listPorts } from '../api/reference'
import { getApiErrorMessage } from '../api/client'
import ShipmentStatusBadge from '../components/ShipmentStatusBadge'
import { useAuth } from '../contexts/AuthContext'
import { useThemeMode } from '../contexts/ThemeContext'

export default function ShipmentsPage() {
  const { user } = useAuth()
  const { isDark } = useThemeMode()
  const isAdmin = user?.role === 'ADMIN'
  const isOwner = user?.role === 'OWNER'
  const canCustodyTransfer = user?.role === 'ADMIN' || user?.role === 'LOGISTICS'
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [search, setSearch] = useState('')
  const [searchDraft, setSearchDraft] = useState('')
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm<CreateShipmentPayload>()

  const listQuery = useQuery({
    queryKey: ['shipments', 'list', page, limit, statusFilter, search],
    queryFn: () => listShipments({ page, limit, status: statusFilter, search: search || undefined }),
  })

  const portsQ = useQuery({ queryKey: ['reference', 'ports'], queryFn: () => listPorts(), enabled: open && isAdmin })
  const partiesQ = useQuery({ queryKey: ['reference', 'parties'], queryFn: () => listParties(), enabled: open && isAdmin })
  const cargoQ = useQuery({ queryKey: ['reference', 'cargo'], queryFn: listCargoProfiles, enabled: open && isAdmin })

  const createMut = useMutation({
    mutationFn: createShipment,
    onSuccess: () => {
      message.success('Đã tạo lô hàng')
      qc.invalidateQueries({ queryKey: ['shipments'] })
      form.resetFields()
      setOpen(false)
    },
    onError: (e) => message.error(getApiErrorMessage(e)),
  })

  const rows = useMemo(
    () =>
      (listQuery.data?.data ?? []).map((s) => ({
        key: s.ShipmentID,
        ...s,
      })),
    [listQuery.data],
  )

  const partyOptions = (partiesQ.data ?? []).map((p) => ({
    value: p.PartyID,
    label: `${p.Name} (${p.PartyID})`,
  }))

  const routeTextCls = isDark ? 'text-slate-300' : 'text-slate-700'
  const pageTitleCls = isDark ? '!m-0 !text-slate-100' : '!m-0 !text-slate-900'

  return (
    <Card className="dashboard-card" bodyStyle={{ padding: 0 }}>
      {isOwner && !user?.partyId && (
        <div className="px-4 pt-4">
          <Typography.Paragraph type="warning" className="!mb-0">
            Tài khoản chưa gán PartyID — liên hệ quản trị để xem lô hàng liên quan đến công ty bạn.
          </Typography.Paragraph>
        </div>
      )}
      <div className="px-4 pt-4 pb-2 flex flex-wrap items-center justify-between gap-3">
        <Typography.Title level={4} className={pageTitleCls}>
          {isOwner ? 'Lô hàng của tôi' : 'Quản lý lô hàng'}
        </Typography.Title>
        {isAdmin && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
            Khởi tạo lô mới
          </Button>
        )}
      </div>

      <div className="px-4 pb-3 flex flex-wrap gap-2 items-center">
        <Select
          allowClear
          placeholder="Lọc trạng thái"
          style={{ width: 180 }}
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v)
            setPage(1)
          }}
          options={[
            { value: 'NORMAL', label: 'NORMAL' },
            { value: 'IN_TRANSIT', label: 'IN_TRANSIT' },
            { value: 'ALARM', label: 'ALARM' },
            { value: 'COMPLETED', label: 'COMPLETED' },
          ]}
        />
        <Input
          placeholder="Tìm Shipment ID"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          onPressEnter={() => {
            setSearch(searchDraft.trim())
            setPage(1)
          }}
          style={{ width: 220 }}
        />
        <Button
          icon={<SearchOutlined />}
          onClick={() => {
            setSearch(searchDraft.trim())
            setPage(1)
          }}
        >
          Tìm
        </Button>
      </div>

      <Table
        loading={listQuery.isLoading}
        dataSource={rows}
        pagination={{
          current: page,
          pageSize: limit,
          total: listQuery.data?.meta.total ?? 0,
          onChange: (p) => setPage(p),
          showSizeChanger: false,
        }}
        columns={[
          { title: 'ID', dataIndex: 'ShipmentID', key: 'id' },
          {
            title: 'Điểm đi',
            key: 'o',
            render: (_, r) => (
              <span className={routeTextCls}>
                {r.OriginPortName} ({r.OriginPortCode})
              </span>
            ),
          },
          {
            title: 'Điểm đến',
            key: 'd',
            render: (_, r) => (
              <span className={routeTextCls}>
                {r.DestinationPortName} ({r.DestinationPortCode})
              </span>
            ),
          },
          { title: 'Người gửi', dataIndex: 'ShipperName', key: 'shipper' },
          { title: 'Người nhận', dataIndex: 'ConsigneeName', key: 'consignee' },
          {
            title: 'Trạng thái',
            dataIndex: 'Status',
            key: 'status',
            render: (s: string) => <ShipmentStatusBadge status={s} />,
          },
          {
            title: 'Thao tác',
            key: 'act',
            render: (_, r) => (
              <Space wrap>
                <Link to={`/shipments/${r.ShipmentID}`}>
                  <Button size="small" type="link">
                    Chi tiết
                  </Button>
                </Link>
                {canCustodyTransfer && r.Status !== 'ALARM' && (
                  <Link to={`/custody/transfer?shipmentId=${encodeURIComponent(r.ShipmentID)}`}>
                    <Button size="small" type="link">
                      Bàn giao
                    </Button>
                  </Link>
                )}
              </Space>
            ),
          },
        ]}
      />

      {isAdmin && (
      <Modal
        title="Khởi tạo lô hàng mới"
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        destroyOnHidden
        width={560}
      >
        <Form
          form={form}
          layout="vertical"
          className="pt-2"
          onFinish={(v) => createMut.mutate(v)}
        >
          <Form.Item name="ShipmentID" label="Shipment ID (tuỳ chọn)">
            <Input placeholder="Để trống để hệ thống sinh" />
          </Form.Item>
          <Form.Item name="CargoProfileID" label="Loại hàng (CargoProfileID)" rules={[{ required: true }]}>
            <Select
              loading={cargoQ.isLoading}
              showSearch
              optionFilterProp="label"
              options={(cargoQ.data ?? []).map((c) => ({
                value: c.CargoProfileID,
                label: `${c.CargoName} (${c.CargoProfileID})`,
              }))}
            />
          </Form.Item>
          <Form.Item name="WeightKg" label="Trọng lượng (kg)" rules={[{ required: true }]}>
            <InputNumber min={0.01} step={0.1} className="w-full" />
          </Form.Item>
          <Form.Item
            name="ShipperPartyID"
            label="Người gửi"
            rules={[{ required: true, message: 'Chọn người gửi' }]}
            extra={
              <Typography.Text type="secondary" className="text-xs">
                Bấm ô bên dưới để mở danh sách — gõ để lọc. Thiếu đối tác?{' '}
                <Link to="/parties">Mở trang Đối tác</Link>.
              </Typography.Text>
            }
          >
            <Select
              showSearch
              allowClear
              loading={partiesQ.isLoading}
              placeholder="Chọn người gửi…"
              optionFilterProp="label"
              options={partyOptions}
              listHeight={320}
              popupMatchSelectWidth={false}
              className="w-full"
              styles={{ popup: { root: { minWidth: 360 } } }}
            />
          </Form.Item>
          <Form.Item
            name="ConsigneePartyID"
            label="Người nhận"
            rules={[{ required: true, message: 'Chọn người nhận' }]}
            extra={
              <Typography.Text type="secondary" className="text-xs">
                Bấm để chọn từ danh sách đối tác ACTIVE.
              </Typography.Text>
            }
          >
            <Select
              showSearch
              allowClear
              loading={partiesQ.isLoading}
              placeholder="Chọn người nhận…"
              optionFilterProp="label"
              options={partyOptions}
              listHeight={320}
              popupMatchSelectWidth={false}
              className="w-full"
              styles={{ popup: { root: { minWidth: 360 } } }}
            />
          </Form.Item>
          <Form.Item name="OriginPortCode" label="Cảng đi" rules={[{ required: true }]}>
            <Select
              loading={portsQ.isLoading}
              showSearch
              optionFilterProp="label"
              options={(portsQ.data ?? []).map((p) => ({
                value: p.PortCode,
                label: `${p.Name} (${p.PortCode})`,
              }))}
            />
          </Form.Item>
          <Form.Item name="DestinationPortCode" label="Cảng đến" rules={[{ required: true }]}>
            <Select
              loading={portsQ.isLoading}
              showSearch
              optionFilterProp="label"
              options={(portsQ.data ?? []).map((p) => ({
                value: p.PortCode,
                label: `${p.Name} (${p.PortCode})`,
              }))}
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={createMut.isPending}>
            Gửi (POST /api/shipments)
          </Button>
        </Form>
      </Modal>
      )}
    </Card>
  )
}
