import { EditOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card, Form, Input, Modal, Select, Space, Table, Typography, message } from 'antd'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import { getApiErrorMessage } from '../api/client'
import { createParty, listParties, updateParty, type CreatePartyPayload, type PartyListItem } from '../api/reference'
import { useAuth } from '../contexts/AuthContext'
import { useThemeMode } from '../contexts/ThemeContext'

const TYPE_OPTS = [
  { value: 'OWNER', label: 'OWNER (chủ hàng)' },
  { value: 'LOGISTICS', label: 'LOGISTICS' },
  { value: 'AUDITOR', label: 'AUDITOR' },
]

const STATUS_OPTS = [
  { value: 'ACTIVE', label: 'ACTIVE' },
  { value: 'INACTIVE', label: 'INACTIVE' },
  { value: 'SUSPENDED', label: 'SUSPENDED' },
]

function canSeeFullPartyList(role: string | undefined) {
  return role === 'ADMIN' || role === 'LOGISTICS' || role === 'AUDITOR'
}

function canMutateParty(role: string | undefined) {
  return role === 'ADMIN' || role === 'LOGISTICS'
}

export default function PartiesPage() {
  const { user } = useAuth()
  const { isDark } = useThemeMode()
  const qc = useQueryClient()
  const role = user?.role
  const seeFull = canSeeFullPartyList(role)
  const mutate = canMutateParty(role)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<PartyListItem | null>(null)
  const [form] = Form.useForm<CreatePartyPayload & { partyId?: string }>()

  const partiesQ = useQuery({
    queryKey: ['reference', 'parties', { manage: seeFull }],
    queryFn: () => listParties({ all: seeFull }),
  })

  const titleCls = isDark ? '!m-0 !text-slate-100' : '!m-0 !text-slate-900'
  const subCls = isDark ? '!text-slate-400' : '!text-slate-600'

  const createMut = useMutation({
    mutationFn: createParty,
    onSuccess: () => {
      message.success('Đã tạo đối tác')
      qc.invalidateQueries({ queryKey: ['reference', 'parties'] })
      setModalOpen(false)
      form.resetFields()
    },
    onError: (e) => message.error(getApiErrorMessage(e)),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreatePartyPayload> }) => updateParty(id, payload),
    onSuccess: () => {
      message.success('Đã cập nhật đối tác')
      qc.invalidateQueries({ queryKey: ['reference', 'parties'] })
      setModalOpen(false)
      setEditing(null)
      form.resetFields()
    },
    onError: (e) => message.error(getApiErrorMessage(e)),
  })

  function openCreate() {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ status: 'ACTIVE', partyType: 'OWNER' })
    setModalOpen(true)
  }

  function openEdit(row: PartyListItem) {
    setEditing(row)
    form.setFieldsValue({
      partyId: row.PartyID,
      partyType: row.PartyType,
      name: row.Name,
      email: row.Email ?? undefined,
      phone: row.Phone ?? undefined,
      address: row.Address ?? undefined,
      status: row.Status ?? 'ACTIVE',
    })
    setModalOpen(true)
  }

  function submit() {
    form.validateFields().then((values) => {
      if (editing) {
        updateMut.mutate({
          id: editing.PartyID,
          payload: {
            partyType: values.partyType,
            name: values.name,
            email: values.email,
            phone: values.phone,
            address: values.address,
            status: values.status,
          },
        })
      } else {
        createMut.mutate({
          partyId: values.partyId!,
          partyType: values.partyType!,
          name: values.name!,
          email: values.email,
          phone: values.phone,
          address: values.address,
          status: values.status || 'ACTIVE',
        })
      }
    })
  }

  return (
    <Space direction="vertical" size={16} className="w-full">
      {!seeFull && (
        <Alert
          type="info"
          showIcon
          message="Chế độ xem hạn chế"
          description="Bạn đang xem các đối tác trạng thái ACTIVE (để chọn khi tạo lô). Chỉ ADMIN / LOGISTICS / AUDITOR xem đủ cột và lịch sử; chỉ ADMIN / LOGISTICS được thêm hoặc sửa."
        />
      )}
      <Card className="dashboard-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Typography.Title level={4} className={titleCls}>
              Đối tác (Parties)
            </Typography.Title>
            <Typography.Paragraph className={`!mb-0 !mt-2 ${subCls}`}>
              {seeFull ? (
                <>
                  Chuẩn hóa mã PartyID, loại và liên hệ. Thao tác tạo/sửa ghi vào{' '}
                  <Link to="/audit-alerts">AuditLog</Link> (bảng Parties, UserID trong ChangedBy).
                </>
              ) : (
                <>Tra cứu PartyID để dùng trên form lô hàng. Cần thêm đối tác mới — nhờ ADMIN hoặc LOGISTICS.</>
              )}
            </Typography.Paragraph>
          </div>
          {mutate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Thêm đối tác
            </Button>
          )}
        </div>
      </Card>

      <Card className="dashboard-card" bodyStyle={{ padding: 0 }}>
        <Table<PartyListItem>
          rowKey="PartyID"
          loading={partiesQ.isLoading}
          dataSource={partiesQ.data ?? []}
          pagination={{ pageSize: 15, showSizeChanger: true }}
          scroll={seeFull ? { x: 900 } : undefined}
          columns={
            seeFull
              ? [
                  { title: 'PartyID', dataIndex: 'PartyID', width: 160, fixed: 'left' as const },
                  { title: 'Tên', dataIndex: 'Name', ellipsis: true },
                  { title: 'Loại', dataIndex: 'PartyType', width: 120 },
                  { title: 'Email', dataIndex: 'Email', width: 200, ellipsis: true, render: (v) => v || '—' },
                  { title: 'Điện thoại', dataIndex: 'Phone', width: 130, render: (v) => v || '—' },
                  { title: 'Trạng thái', dataIndex: 'Status', width: 110 },
                  {
                    title: 'Tạo lúc',
                    dataIndex: 'CreatedAtUTC',
                    width: 180,
                    render: (v: string | undefined) => (v ? new Date(v).toLocaleString() : '—'),
                  },
                  ...(mutate
                    ? [
                        {
                          title: '',
                          key: 'act',
                          width: 90,
                          fixed: 'right' as const,
                          render: (_: unknown, row: PartyListItem) => (
                            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>
                              Sửa
                            </Button>
                          ),
                        },
                      ]
                    : []),
                ]
              : [
                  { title: 'PartyID', dataIndex: 'PartyID', width: 180 },
                  { title: 'Tên', dataIndex: 'Name', ellipsis: true },
                  { title: 'Loại', dataIndex: 'PartyType', width: 130 },
                ]
          }
        />
      </Card>

      <Modal
        title={editing ? `Sửa ${editing.PartyID}` : 'Thêm đối tác mới'}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false)
          setEditing(null)
          form.resetFields()
        }}
        onOk={submit}
        confirmLoading={createMut.isPending || updateMut.isPending}
        destroyOnClose
        width={520}
      >
        <Form form={form} layout="vertical" className="mt-2">
          {!editing && (
            <Form.Item
              name="partyId"
              label="PartyID (mã cố định)"
              rules={[{ required: true, message: 'Nhập PartyID' }, { max: 32, message: 'Tối đa 32 ký tự' }]}
              extra="VD: PARTY-ACME-001 — dùng chung cho toàn hệ thống."
            >
              <Input placeholder="PARTY-..." />
            </Form.Item>
          )}
          {editing && (
            <Form.Item label="PartyID">
              <Input disabled value={editing.PartyID} />
            </Form.Item>
          )}
          <Form.Item name="partyType" label="Loại" rules={[{ required: true }]}>
            <Select options={TYPE_OPTS} />
          </Form.Item>
          <Form.Item name="name" label="Tên tổ chức" rules={[{ required: true, message: 'Nhập tên' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input type="email" allowClear />
          </Form.Item>
          <Form.Item name="phone" label="Điện thoại">
            <Input allowClear />
          </Form.Item>
          <Form.Item name="address" label="Địa chỉ">
            <Input.TextArea rows={2} allowClear />
          </Form.Item>
          <Form.Item name="status" label="Trạng thái" rules={[{ required: true }]}>
            <Select options={STATUS_OPTS} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
