import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message } from 'antd'
import { useState } from 'react'
import { getApiErrorMessage } from '../api/client'
import { createPort, deletePort, listPorts, updatePort, type CreatePortPayload, type PortRow } from '../api/reference'
import { useAuth } from '../contexts/AuthContext'
import { useThemeMode } from '../contexts/ThemeContext'

const STATUS_OPTIONS = [
  { value: 'OPERATIONAL', label: 'OPERATIONAL' },
  { value: 'CLOSED', label: 'CLOSED' },
  { value: 'RESTRICTED', label: 'RESTRICTED' },
]

export default function PortsPage() {
  const { user } = useAuth()
  const { isDark } = useThemeMode()
  const qc = useQueryClient()
  const isAdmin = user?.role === 'ADMIN'
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<PortRow | null>(null)
  const [form] = Form.useForm<CreatePortPayload & { portCode?: string }>()

  const portsQ = useQuery({
    queryKey: ['reference', 'ports', { manage: true, all: isAdmin }],
    queryFn: () => listPorts({ all: isAdmin }),
  })

  const titleCls = isDark ? '!m-0 !text-slate-100' : '!m-0 !text-slate-900'
  const subCls = isDark ? '!text-slate-400' : '!text-slate-600'

  const createMut = useMutation({
    mutationFn: createPort,
    onSuccess: () => {
      message.success('Đã thêm cảng')
      qc.invalidateQueries({ queryKey: ['reference', 'ports'] })
      setModalOpen(false)
      form.resetFields()
    },
    onError: (e) => message.error(getApiErrorMessage(e)),
  })

  const updateMut = useMutation({
    mutationFn: ({ code, payload }: { code: string; payload: Partial<CreatePortPayload> }) => updatePort(code, payload),
    onSuccess: () => {
      message.success('Đã cập nhật cảng')
      qc.invalidateQueries({ queryKey: ['reference', 'ports'] })
      setModalOpen(false)
      setEditing(null)
      form.resetFields()
    },
    onError: (e) => message.error(getApiErrorMessage(e)),
  })

  const deleteMut = useMutation({
    mutationFn: deletePort,
    onSuccess: () => {
      message.success('Đã xóa cảng')
      qc.invalidateQueries({ queryKey: ['reference', 'ports'] })
    },
    onError: (e) => message.error(getApiErrorMessage(e)),
  })

  function openCreate() {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ status: 'OPERATIONAL' })
    setModalOpen(true)
  }

  function openEdit(row: PortRow) {
    setEditing(row)
    form.setFieldsValue({
      portCode: row.PortCode,
      name: row.Name,
      country: row.Country,
      latitude: row.Latitude ?? undefined,
      longitude: row.Longitude ?? undefined,
      timezone: row.Timezone ?? undefined,
      status: row.Status,
    })
    setModalOpen(true)
  }

  function submit() {
    form.validateFields().then((values) => {
      if (editing) {
        updateMut.mutate({
          code: editing.PortCode,
          payload: {
            name: values.name,
            country: values.country,
            latitude: values.latitude ?? null,
            longitude: values.longitude ?? null,
            timezone: values.timezone || null,
            status: values.status,
          },
        })
      } else {
        createMut.mutate({
          portCode: values.portCode!,
          name: values.name!,
          country: values.country!,
          latitude: values.latitude ?? null,
          longitude: values.longitude ?? null,
          timezone: values.timezone || null,
          status: values.status || 'OPERATIONAL',
        })
      }
    })
  }

  return (
    <Space direction="vertical" size={16} className="w-full">
      <Card className="dashboard-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Typography.Title level={4} className={titleCls}>
              <span>Quản lý cảng (đi / đến)</span>
              {!isAdmin && (
                <Tag color="default" className="ml-2 align-middle font-normal">
                  Chỉ xem
                </Tag>
              )}
            </Typography.Title>
            <Typography.Paragraph className={`!mb-0 !mt-2 ${subCls}`}>
              Master data cảng dùng cho lô hàng và bàn giao. Chỉ ADMIN được thêm, sửa, xóa.
            </Typography.Paragraph>
          </div>
          {isAdmin && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Thêm cảng
            </Button>
          )}
        </div>
      </Card>

      <Card className="dashboard-card" bodyStyle={{ padding: 0 }}>
        <Table<PortRow>
          rowKey="PortCode"
          loading={portsQ.isLoading}
          dataSource={portsQ.data ?? []}
          pagination={{ pageSize: 15, showSizeChanger: true }}
          columns={[
            { title: 'Mã', dataIndex: 'PortCode', width: 110 },
            { title: 'Tên', dataIndex: 'Name', ellipsis: true },
            { title: 'Quốc gia', dataIndex: 'Country', width: 140 },
            {
              title: 'Tọa độ',
              key: 'loc',
              width: 160,
              render: (_, r) =>
                r.Latitude != null && r.Longitude != null ? `${r.Latitude}, ${r.Longitude}` : '—',
            },
            { title: 'Timezone', dataIndex: 'Timezone', width: 160, ellipsis: true, render: (t) => t || '—' },
            { title: 'Trạng thái', dataIndex: 'Status', width: 130 },
            ...(isAdmin
              ? [
                  {
                    title: '',
                    key: 'actions',
                    width: 120,
                    render: (_: unknown, row: PortRow) => (
                      <Space>
                        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>
                          Sửa
                        </Button>
                        <Popconfirm
                          title="Xóa cảng?"
                          description="Chỉ xóa được khi không còn lô hoặc bản ghi bàn giao tham chiếu."
                          okText="Xóa"
                          cancelText="Hủy"
                          onConfirm={() => deleteMut.mutate(row.PortCode)}
                        >
                          <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                            Xóa
                          </Button>
                        </Popconfirm>
                      </Space>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </Card>

      <Modal
        title={editing ? `Sửa cảng ${editing.PortCode}` : 'Thêm cảng mới'}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false)
          setEditing(null)
          form.resetFields()
        }}
        onOk={submit}
        confirmLoading={createMut.isPending || updateMut.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="mt-2">
          {!editing && (
            <Form.Item
              name="portCode"
              label="Mã cảng (UN/LOCODE)"
              rules={[{ required: true, message: 'Nhập mã cảng' }, { max: 16, message: 'Tối đa 16 ký tự' }]}
            >
              <Input placeholder="VD: VNDAD" />
            </Form.Item>
          )}
          <Form.Item name="name" label="Tên cảng" rules={[{ required: true, message: 'Nhập tên' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="country" label="Quốc gia" rules={[{ required: true, message: 'Nhập quốc gia' }]}>
            <Input />
          </Form.Item>
          <Space wrap className="w-full">
            <Form.Item name="latitude" label="Vĩ độ">
              <InputNumber className="!w-[140px]" step={0.0001} />
            </Form.Item>
            <Form.Item name="longitude" label="Kinh độ">
              <InputNumber className="!w-[140px]" step={0.0001} />
            </Form.Item>
          </Space>
          <Form.Item name="timezone" label="Timezone (IANA)">
            <Input placeholder="Asia/Ho_Chi_Minh" />
          </Form.Item>
          <Form.Item name="status" label="Trạng thái" rules={[{ required: true }]}>
            <Select options={STATUS_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
