import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Select,
  Space,
  Typography,
  Upload,
  message,
} from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getOwnershipHistory, transferCustody, type TransferPayload } from '../api/custody'
import { getShipment, listShipments } from '../api/shipments'
import { listParties, listPorts } from '../api/reference'
import { getApiErrorMessage } from '../api/client'
import { useThemeMode } from '../contexts/ThemeContext'
import { activeCustodianPartyId } from '../utils/custodyPrefill'

export default function CustodyTransferPage() {
  const { isDark } = useThemeMode()
  const qc = useQueryClient()
  const [searchParams] = useSearchParams()
  const [shipmentId, setShipmentId] = useState<string | undefined>(undefined)
  const [form] = Form.useForm<TransferPayload>()
  const portPrefilledForRef = useRef<string | null>(null)

  const listQ = useQuery({
    queryKey: ['shipments', 'list', 'transfer'],
    queryFn: () => listShipments({ limit: 200, page: 1 }),
  })

  const detailQ = useQuery({
    queryKey: ['shipment', shipmentId],
    queryFn: () => getShipment(shipmentId!),
    enabled: Boolean(shipmentId),
  })

  const shipment = detailQ.data?.shipment as Record<string, unknown> | undefined
  const status = String(shipment?.Status ?? '')
  const isAlarm = status === 'ALARM'

  const historyQ = useQuery({
    queryKey: ['custody', shipmentId, 'transfer-prefill'],
    queryFn: () => getOwnershipHistory(shipmentId!, 'DETAILED'),
    enabled: Boolean(shipmentId) && !isAlarm,
    retry: false,
  })

  const partiesQ = useQuery({ queryKey: ['reference', 'parties'], queryFn: () => listParties() })
  const portsQ = useQuery({ queryKey: ['reference', 'ports'], queryFn: () => listPorts() })

  useEffect(() => {
    const q = searchParams.get('shipmentId')?.trim()
    if (q) setShipmentId(q)
  }, [searchParams])

  useEffect(() => {
    portPrefilledForRef.current = null
  }, [shipmentId])

  useEffect(() => {
    if (!shipmentId || isAlarm || !historyQ.isSuccess || !historyQ.data) return
    const chain = (historyQ.data.chain ?? []) as Record<string, unknown>[]
    const fromId = activeCustodianPartyId(chain)
    if (fromId) form.setFieldValue('fromPartyId', fromId)
    form.setFieldValue('handoverCondition', 'GOOD')
  }, [shipmentId, isAlarm, historyQ.isSuccess, historyQ.data, form])

  useEffect(() => {
    if (!shipmentId || isAlarm || !detailQ.isSuccess) return
    if (portPrefilledForRef.current === shipmentId) return
    const port =
      shipment?.CurrentPortCode != null && String(shipment.CurrentPortCode).trim() !== ''
        ? String(shipment.CurrentPortCode)
        : undefined
    if (port) {
      form.setFieldValue('handoverPortCode', port)
      portPrefilledForRef.current = shipmentId
    }
  }, [shipmentId, isAlarm, detailQ.isSuccess, shipment?.CurrentPortCode, form])

  const transferMut = useMutation({
    mutationFn: (body: TransferPayload) => transferCustody(shipmentId!, body),
    onSuccess: (res) => {
      message.success(res.message || 'Bàn giao thành công')
      qc.invalidateQueries({ queryKey: ['custody'] })
      qc.invalidateQueries({ queryKey: ['shipment', shipmentId] })
      portPrefilledForRef.current = null
      form.resetFields()
    },
    onError: (e) => message.error(getApiErrorMessage(e)),
  })

  const shipmentOptions = useMemo(() => {
    const base = (listQ.data?.data ?? []).map((s) => ({
      value: s.ShipmentID,
      label: `${s.ShipmentID} — ${s.Status}`,
    }))
    if (shipmentId && !base.some((o) => o.value === shipmentId)) {
      return [{ value: shipmentId, label: `${shipmentId} — (mở từ liên kết)` }, ...base]
    }
    return base
  }, [listQ.data, shipmentId])

  const titleCls = isDark ? '!text-slate-100' : '!text-slate-900'
  const mutedCls = isDark ? 'text-slate-400' : 'text-slate-600'

  return (
    <Space direction="vertical" size={16} className="w-full max-w-3xl">
      <Typography.Title level={3} className={titleCls}>
        Bàn giao pháp lý (Custody transfer)
      </Typography.Title>

      <Card className="dashboard-card">
        <Space direction="vertical" className="w-full" size={12}>
          <Typography.Text className={mutedCls}>Chọn lô hàng</Typography.Text>
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Shipment ID"
            className="w-full"
            value={shipmentId}
            onChange={(v) => {
              portPrefilledForRef.current = null
              setShipmentId(v)
              form.resetFields()
            }}
            options={shipmentOptions}
          />
        </Space>
      </Card>

      {isAlarm && (
        <Alert
          type="error"
          showIcon
          message="Không thể bàn giao lô hàng đang trong trạng thái ALARM"
          description="Backend sẽ từ chối (409). Hãy xử lý alarm trước."
        />
      )}

      {shipmentId && !isAlarm && historyQ.isError && (
        <Alert
          type="warning"
          showIcon
          className="max-w-3xl"
          message="Không tải được chuỗi sở hữu để gợi ý bên giao"
          description="Chọn thủ công fromPartyId (phải trùng chủ sở hữu hiện tại) hoặc kiểm tra dữ liệu Ownership / đã cập nhật SP trên DB chưa."
        />
      )}

      {shipmentId && !isAlarm && (
        <Card className="dashboard-card" title="Form chuyển giao">
          <Form
            form={form}
            layout="vertical"
            onFinish={(v) => transferMut.mutate(v)}
            initialValues={{ handoverCondition: 'GOOD' }}
          >
            <Form.Item
              name="fromPartyId"
              label="Bên giao (fromPartyId)"
              rules={[{ required: true, message: 'Chọn bên giao' }]}
              extra="Điền đúng party đang nắm quyền sở hữu hiện tại — hệ thống gợi ý từ ownership-history (bước ACTIVE) khi API có partyId."
            >
              <Select
                showSearch
                optionFilterProp="label"
                options={(partiesQ.data ?? []).map((p) => ({
                  value: p.PartyID,
                  label: `${p.Name} (${p.PartyID})`,
                }))}
              />
            </Form.Item>
            <Form.Item name="toPartyId" label="Bên nhận (toPartyId)" rules={[{ required: true }]}>
              <Select
                showSearch
                optionFilterProp="label"
                options={(partiesQ.data ?? []).map((p) => ({
                  value: p.PartyID,
                  label: `${p.Name} (${p.PartyID})`,
                }))}
              />
            </Form.Item>
            <Form.Item name="handoverPortCode" label="Cảng bàn giao" rules={[{ required: true }]}>
              <Select
                showSearch
                optionFilterProp="label"
                options={(portsQ.data ?? []).map((p) => ({
                  value: p.PortCode,
                  label: `${p.Name} (${p.PortCode})`,
                }))}
              />
            </Form.Item>
            <Form.Item name="handoverCondition" label="Tình trạng ghi nhận" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'GOOD', label: 'GOOD' },
                  { value: 'DAMAGED', label: 'DAMAGED' },
                  { value: 'PARTIAL', label: 'PARTIAL' },
                ]}
              />
            </Form.Item>
            <Form.Item name="handoverNotes" label="Ghi chú">
              <Input.TextArea rows={3} />
            </Form.Item>
            <Form.Item label="Chữ ký số (file → base64)" name="handoverSignature">
              <Upload
                maxCount={1}
                beforeUpload={(file) => {
                  const reader = new FileReader()
                  reader.onload = () => {
                    const r = String(reader.result || '')
                    const b64 = r.includes(',') ? r.split(',')[1] : r
                    form.setFieldValue('handoverSignature', b64)
                    message.success('Đã nhúng chữ ký (base64)')
                  }
                  reader.readAsDataURL(file)
                  return false
                }}
              >
                <Button>Chọn file</Button>
              </Upload>
            </Form.Item>
            <Form.Item name="witnessPartyId" label="Witness (tuỳ chọn)">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                options={(partiesQ.data ?? []).map((p) => ({
                  value: p.PartyID,
                  label: `${p.Name} (${p.PartyID})`,
                }))}
              />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={transferMut.isPending} block disabled={isAlarm}>
              POST /api/v1/shipments/:id/transfer
            </Button>
          </Form>
        </Card>
      )}
    </Space>
  )
}
