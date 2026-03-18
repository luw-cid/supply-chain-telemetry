import { Timeline, Typography } from 'antd'
import type { CustodyEvent } from '../types'

interface CustodyTimelineProps {
  items: CustodyEvent[]
}

export default function CustodyTimeline({ items }: CustodyTimelineProps) {
  return (
    <Timeline
      items={items.map((item) => ({
        color: '#3b82f6',
        children: (
          <div className="mb-4">
            <Typography.Text className="block !text-slate-100 !font-semibold">{item.owner}</Typography.Text>
            <Typography.Text className="block !text-slate-400">{item.port}</Typography.Text>
            <Typography.Text className="block !text-slate-400">
              {new Date(item.time).toLocaleString()}
            </Typography.Text>
            <Typography.Text className="block !text-slate-300">{item.note}</Typography.Text>
          </div>
        ),
      }))}
    />
  )
}
