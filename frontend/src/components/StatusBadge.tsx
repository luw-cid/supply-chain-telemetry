import { Tag } from 'antd'
import type { ShipmentStatus } from '../types'

interface StatusBadgeProps {
  status: ShipmentStatus
}

const statusConfig: Record<ShipmentStatus, { color: string; label: string }> = {
  NORMAL: { color: '#22c55e', label: 'NORMAL' },
  VIOLATION: { color: '#facc15', label: 'VIOLATION' },
  ALARM: { color: '#ef4444', label: 'ALARM' },
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <Tag
      bordered={false}
      style={{
        color: '#111827',
        backgroundColor: config.color,
        fontWeight: 700,
        letterSpacing: 0.3,
      }}
    >
      {config.label}
    </Tag>
  )
}
