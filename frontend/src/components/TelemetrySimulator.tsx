import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Divider,
  InputNumber,
  Modal,
  notification,
  Select,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd'
import { useRef, useState } from 'react'
import { ingestTelemetry } from '../api/telemetry'
import { listShipments } from '../api/shipments'
import { useThemeMode } from '../contexts/ThemeContext'

interface LogEntry {
  time: string
  temp: number
  violation: boolean
  ok: boolean
  error?: string
}

export default function TelemetrySimulator({ open, onClose, onRunningChange }: { open: boolean; onClose: () => void; onRunningChange?: (running: boolean) => void }) {
  const { isDark } = useThemeMode()
  const queryClient = useQueryClient()
  const textCls = isDark ? 'text-slate-200' : 'text-slate-800'
  const mutedCls = isDark ? 'text-slate-400' : 'text-slate-500'

  const [logs, setLogs] = useState<LogEntry[]>([])
  const [running, setRunning] = useState(false)
  const [sentCount, setSentCount] = useState(0)
  const [violationCount, setViolationCount] = useState(0)

  const [shipmentId, setShipmentId] = useState('SHP-E2E-001')
  const [deviceId, setDeviceId] = useState('SIM-DEVICE-001')
  const [humidity, setHumidity] = useState(55)
  const [count, setCount] = useState(5)
  const [interval, setInterval] = useState(3)

  const [mode, setMode] = useState<'manual' | 'random' | 'sequential'>('manual')
  const [manualTemp, setManualTemp] = useState(10)
  const [randMin, setRandMin] = useState(2)
  const [randMax, setRandMax] = useState(15)
  const [seqStart, setSeqStart] = useState(2)
  const [seqEnd, setSeqEnd] = useState(15)
  const [seqStep, setSeqStep] = useState(2)

  const shipmentsQ = useQuery({
    queryKey: ['shipments', 'simulator'],
    queryFn: () => listShipments({ page: 1, limit: 100 }),
  })
  const shipments = shipmentsQ.data?.data ?? []

  const sendOne = async (index: number) => {
    const shipment = shipments.find((s) => s.ShipmentID === shipmentId)
    let temp: number
    if (mode === 'manual') temp = manualTemp
    else if (mode === 'random') {
      const mn = Math.min(randMin, randMax)
      const mx = Math.max(randMin, randMax)
      temp = Math.round((Math.random() * (mx - mn) + mn) * 10) / 10
    } else {
      const step = seqStep > 0 ? seqStep : -seqStep
      temp = Math.round((seqStart + index * (seqStart < seqEnd ? step : -step)) * 10) / 10
    }
    const loc = {
      lng: Number(shipment?.MarkerLng ?? 106.7),
      lat: Number(shipment?.MarkerLat ?? 10.8),
    }

    try {
      const res = await ingestTelemetry({
        shipment_id: shipmentId,
        device_id: deviceId,
        location: loc,
        temp: Number(temp),
        humidity: Number(humidity),
      })
      const violation = !!(res.data as any)?.violation
      setLogs((prev) => [...prev, { time: new Date().toLocaleTimeString(), temp, violation, ok: true }])
      setSentCount((c) => c + 1)
      if (violation) {
        setViolationCount((c) => c + 1)
        notification.warning({
          message: `Cảnh báo nhiệt độ`,
          description: `${temp}°C vượt ngưỡng cho phép (Shipment: ${shipmentId})`,
          placement: 'bottomRight',
          duration: 4,
        })
      }
      return violation
    } catch (err: any) {
      setLogs((prev) => [
        ...prev,
        { time: new Date().toLocaleTimeString(), temp, violation: false, ok: false, error: err?.response?.data?.error || err.message },
      ])
      notification.error({
        message: 'Lỗi gửi telemetry',
        description: `${temp}°C: ${err?.response?.data?.error || err.message}`,
        placement: 'bottomRight',
        duration: 4,
      })
      return false
    }
  }

  const stopRef = useRef(false)

  const start = async () => {
    setLogs([])
    setSentCount(0)
    setViolationCount(0)
    stopRef.current = false
    setRunning(true)
    onRunningChange?.(true)

    let s = 0, v = 0

    for (let i = 0; i < count; i++) {
      if (stopRef.current) break
      const vio = await sendOne(i)
      s++
      if (vio) v++
      if (i < count - 1 && !stopRef.current) {
        await new Promise((r) => setTimeout(r, interval * 1000))
      }
    }

    setRunning(false)
    onRunningChange?.(false)

    notification.info({
      message: 'Simulator kết thúc',
      description: `Đã gửi ${s} · ${v} vi phạm`,
      placement: 'bottomRight',
      duration: 5,
    })
    queryClient.invalidateQueries({ queryKey: ['alarms'] })
  }

  const stop = () => {
    stopRef.current = true
    setRunning(false)
    onRunningChange?.(false)
    queryClient.invalidateQueries({ queryKey: ['alarms'] })
  }

  const selectCls = 'w-full'
  const inputCls = 'w-full'

  return (
    <Modal
      title={<span className={textCls}>Telemetry Simulator</span>}
      open={open}
      onCancel={onClose}
      footer={null}
      width={640}
      styles={{ body: { background: isDark ? '#1e293b' : '#fff' } }}
    >
      <Space direction="vertical" size={10} className="w-full">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Typography.Text className={mutedCls} style={{ fontSize: 12 }}>Shipment</Typography.Text>
            <Select className={selectCls} size="small" value={shipmentId} onChange={setShipmentId} disabled={running}
              options={shipments.map((s) => ({ label: s.ShipmentID, value: s.ShipmentID }))} />
          </div>
          <div>
            <Typography.Text className={mutedCls} style={{ fontSize: 12 }}>Device ID</Typography.Text>
            <Select className={selectCls} size="small" value={deviceId} onChange={setDeviceId} disabled={running}
              options={[
                { label: 'SIM-DEVICE-001', value: 'SIM-DEVICE-001' },
                { label: 'SIM-DEVICE-002', value: 'SIM-DEVICE-002' },
                { label: 'IOT-TEST-001', value: 'IOT-TEST-001' },
              ]} />
          </div>
        </div>

        <div>
          <Typography.Text className={mutedCls} style={{ fontSize: 12 }}>Temperature mode</Typography.Text>
          <Select className={selectCls} size="small" value={mode} onChange={(v) => setMode(v as typeof mode)} disabled={running}
            options={[
              { label: 'Manual (fixed value)', value: 'manual' },
              { label: 'Random (range)', value: 'random' },
              { label: 'Sequential (ramp)', value: 'sequential' },
            ]} />
        </div>

        {mode === 'manual' && (
          <div className="grid grid-cols-1 gap-2">
            <div>
              <Typography.Text className={mutedCls} style={{ fontSize: 12 }}>Temperature (°C)</Typography.Text>
              <InputNumber className={inputCls} size="small" value={manualTemp} onChange={(v) => setManualTemp(v ?? 0)} disabled={running} step={0.5} />
            </div>
          </div>
        )}

        {mode === 'random' && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Typography.Text className={mutedCls} style={{ fontSize: 12 }}>Min (°C)</Typography.Text>
              <InputNumber className={inputCls} size="small" value={randMin} onChange={(v) => setRandMin(v ?? 0)} disabled={running} step={0.5} />
            </div>
            <div>
              <Typography.Text className={mutedCls} style={{ fontSize: 12 }}>Max (°C)</Typography.Text>
              <InputNumber className={inputCls} size="small" value={randMax} onChange={(v) => setRandMax(v ?? 0)} disabled={running} step={0.5} />
            </div>
          </div>
        )}

        {mode === 'sequential' && (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Typography.Text className={mutedCls} style={{ fontSize: 12 }}>Start (°C)</Typography.Text>
              <InputNumber className={inputCls} size="small" value={seqStart} onChange={(v) => setSeqStart(v ?? 0)} disabled={running} step={0.5} />
            </div>
            <div>
              <Typography.Text className={mutedCls} style={{ fontSize: 12 }}>End (°C)</Typography.Text>
              <InputNumber className={inputCls} size="small" value={seqEnd} onChange={(v) => setSeqEnd(v ?? 0)} disabled={running} step={0.5} />
            </div>
            <div>
              <Typography.Text className={mutedCls} style={{ fontSize: 12 }}>Step (°C)</Typography.Text>
              <InputNumber className={inputCls} size="small" value={seqStep} onChange={(v) => setSeqStep(v ?? 1)} disabled={running} min={0.1} step={0.5} />
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <div>
            <Typography.Text className={mutedCls} style={{ fontSize: 12 }}>Humidity (%)</Typography.Text>
            <InputNumber className={inputCls} size="small" value={humidity} onChange={(v) => setHumidity(v ?? 0)} disabled={running} min={0} max={100} />
          </div>
          <div>
            <Typography.Text className={mutedCls} style={{ fontSize: 12 }}>Send count</Typography.Text>
            <InputNumber className={inputCls} size="small" value={count} onChange={(v) => setCount(v ?? 1)} disabled={running} min={1} max={100} />
          </div>
          <div>
            <Typography.Text className={mutedCls} style={{ fontSize: 12 }}>Interval (s)</Typography.Text>
            <InputNumber className={inputCls} size="small" value={interval} onChange={(v) => setInterval(v ?? 1)} disabled={running} min={1} max={60} />
          </div>
        </div>

        <div className="flex gap-2">
          {!running ? (
            <Button type="primary" onClick={start} disabled={!shipmentId}>Start</Button>
          ) : (
            <Button danger onClick={stop}>Stop</Button>
          )}
        </div>

        <div className="flex gap-6">
          <Statistic title={<span className={mutedCls}>Sent</span>} value={sentCount} valueStyle={{ color: isDark ? '#e2e8f0' : '#0f172a', fontSize: 20 }} />
          <Statistic title={<span className={mutedCls}>Violations</span>} value={violationCount} valueStyle={{ color: '#ef4444', fontSize: 20 }} />
        </div>

        {logs.length > 0 && (
          <>
            <Divider style={{ margin: '4px 0' }} />
            <div className="max-h-48 overflow-y-auto" style={{ fontSize: 12 }}>
              {logs.map((l, i) => (
                <div key={i} className="flex items-center gap-2 py-0.5">
                  <Tag style={{ fontSize: 11, margin: 0 }}>{l.time}</Tag>
                  <span className={textCls}>{l.temp}°C</span>
                  {l.violation && <Tag color="red">VIOLATION</Tag>}
                  {!l.violation && l.ok && <Tag color="green">OK</Tag>}
                  {!l.ok && <Tag color="orange">{l.error}</Tag>}
                </div>
              ))}
            </div>
          </>
        )}
      </Space>
    </Modal>
  )
}
