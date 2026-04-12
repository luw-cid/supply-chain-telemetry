import { useQuery } from '@tanstack/react-query'
import { Card, Collapse, Space, Typography, Spin } from 'antd'
import { Link } from 'react-router-dom'
import { getOwnershipHistory } from '../api/custody'
import { listShipments } from '../api/shipments'
import CustodyTimeline from '../components/CustodyTimeline'
import { useThemeMode } from '../contexts/ThemeContext'
import { mapOwnershipChainToEvents } from '../utils/ownershipTimeline'

function CustodyPanel({ shipmentId }: { shipmentId: string }) {
  const q = useQuery({
    queryKey: ['custody', shipmentId, 'chain-page'],
    queryFn: () => getOwnershipHistory(shipmentId, 'DETAILED'),
    retry: false,
  })
  if (q.isLoading) return <Spin />
  if (q.isError) {
    return (
      <Typography.Text type="danger">
        Không tải được (JWT / shipment).{' '}
        <Link to={`/shipments/${shipmentId}`}>Mở chi tiết</Link>
      </Typography.Text>
    )
  }
  const events = mapOwnershipChainToEvents((q.data?.chain ?? []) as Record<string, unknown>[])
  return <CustodyTimeline items={events} />
}

export default function ChainCustodyPage() {
  const { isDark } = useThemeMode()
  const listQ = useQuery({
    queryKey: ['shipments', 'chain-overview'],
    queryFn: () => listShipments({ limit: 100, page: 1 }),
  })

  const shipments = listQ.data?.data ?? []
  const titleCls = isDark ? '!m-0 !text-slate-100' : '!m-0 !text-slate-900'
  const descCls = isDark ? '!mb-0 !mt-2 !text-slate-400' : '!mb-0 !mt-2 !text-slate-600'
  const idCls = isDark ? '!text-slate-100 !font-semibold' : '!text-slate-900 !font-semibold'
  const linkWrapCls = isDark ? '!text-slate-500' : '!text-slate-600'
  const subCls = isDark ? '!text-slate-400 !text-sm' : '!text-slate-600 !text-sm'
  const linkCls = isDark ? 'text-sky-400 hover:text-sky-300' : 'text-sky-600 hover:text-sky-700'

  return (
    <Space direction="vertical" size={16} className="w-full">
      <Card className="dashboard-card">
        <Typography.Title level={4} className={titleCls}>
          Chuỗi sở hữu (tổng quan)
        </Typography.Title>
        <Typography.Paragraph className={descCls}>
          Mở từng lô để tải timeline từ API ownership-history.
        </Typography.Paragraph>
      </Card>

      <Card className="dashboard-card">
        {listQ.isLoading ? (
          <Spin />
        ) : (
          <Collapse
            bordered={false}
            className="!bg-transparent"
            items={shipments.map((s) => ({
              key: s.ShipmentID,
              label: (
                <div className="flex flex-col gap-1 pr-2 w-full">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Typography.Text className={idCls}>{s.ShipmentID}</Typography.Text>
                    <Typography.Text className={linkWrapCls}>
                      <Link to={`/shipments/${s.ShipmentID}`} className={linkCls}>
                        Chi tiết lô
                      </Link>
                    </Typography.Text>
                  </div>
                  <Typography.Text className={subCls}>
                    {s.ShipperName} → {s.ConsigneeName} · {s.Status}
                  </Typography.Text>
                </div>
              ),
              children: <CustodyPanel shipmentId={s.ShipmentID} />,
            }))}
          />
        )}
      </Card>
    </Space>
  )
}
