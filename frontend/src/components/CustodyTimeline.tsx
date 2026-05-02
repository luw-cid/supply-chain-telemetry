import { Timeline, Typography } from 'antd'
import { useThemeMode } from '../contexts/ThemeContext'
import type { CustodyEvent } from '../types'

interface CustodyTimelineProps {
  items: CustodyEvent[]
}

export default function CustodyTimeline({ items }: CustodyTimelineProps) {
  const { isDark } = useThemeMode()
  const emptyCls = isDark ? 'text-slate-500' : 'text-slate-400'
  const ownerCls = isDark ? 'block !text-slate-100 !font-semibold' : 'block !text-slate-900 !font-semibold'
  const metaCls = isDark ? 'block !text-slate-400' : 'block !text-slate-600'
  const noteCls = isDark ? 'block !text-slate-300' : 'block !text-slate-700'

  if (items.length === 0) {
    return <Typography.Text className={emptyCls}>Chưa có dữ liệu bàn giao quyền sở hữu cho lô hàng này.</Typography.Text>
  }

  return (
    <Timeline
      items={items.map((item) => ({
        color: '#3b82f6',
        children: (
          <div className="mb-4">
            <Typography.Text className={ownerCls}>{item.owner}</Typography.Text>
            <Typography.Text className={metaCls}>{item.port}</Typography.Text>
            <Typography.Text className={metaCls}>{new Date(item.time).toLocaleString()}</Typography.Text>
            <Typography.Text className={noteCls}>{item.note}</Typography.Text>
          </div>
        ),
      }))}
    />
  )
}
