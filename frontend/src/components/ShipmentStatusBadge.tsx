import { Tag } from 'antd'

/** Maps DB shipment status to badge display. */
export default function ShipmentStatusBadge({ status }: { status: string }) {
  const s = String(status || '').toUpperCase()
  const map: Record<string, { color: string; label: string }> = {
    NORMAL: { color: '#22c55e', label: 'NORMAL' },
    IN_TRANSIT: { color: '#38bdf8', label: 'IN_TRANSIT' },
    ALARM: { color: '#ef4444', label: 'ALARM' },
    COMPLETED: { color: '#94a3b8', label: 'COMPLETED' },
    VIOLATION: { color: '#facc15', label: 'VIOLATION' },
  }
  const c = map[s] || { color: '#64748b', label: s || 'UNKNOWN' }
  return (
    <Tag bordered={false} style={{ color: '#111827', backgroundColor: c.color, fontWeight: 700 }}>
      {c.label}
    </Tag>
  )
}
