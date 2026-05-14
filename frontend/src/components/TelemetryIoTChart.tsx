import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TelemetryLogsResult } from '../api/telemetry'

interface TelemetryIoTChartProps {
  logs: TelemetryLogsResult['logs']
  tempMin?: number | null
  tempMax?: number | null
  compact?: boolean
}

export default function TelemetryIoTChart({ logs, tempMin, tempMax, compact = false }: TelemetryIoTChartProps) {
  const data = useMemo(
    () =>
      [...logs]
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .map((log) => ({
          time: new Date(log.timestamp).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
          temperature: log.temp,
          humidity: log.humidity ?? undefined,
        })),
    [logs],
  )

  const { domain } = useMemo(() => {
    const temps = data.map((d) => d.temperature).filter((t) => typeof t === 'number')
    const lo = typeof tempMin === 'number' ? tempMin : Math.min(...temps, 0)
    const hi = typeof tempMax === 'number' ? tempMax : Math.max(...temps, 100)
    const pad = Math.max(2, (hi - lo) * 0.15)
    return {
      domain: [lo - pad, hi + pad] as [number, number],
      ticks: [
        typeof tempMin === 'number' ? tempMin : undefined,
        typeof tempMax === 'number' ? tempMax : undefined,
      ].filter((v): v is number => typeof v === 'number'),
    }
  }, [data, tempMin, tempMax])

  const hasThreshold = typeof tempMin === 'number' && typeof tempMax === 'number'

  if (data.length === 0) {
    return <div className="text-slate-500 text-sm py-8 text-center">Chưa có dữ liệu telemetry.</div>
  }

  return (
    <div className={compact ? 'h-52 w-full' : 'h-80 w-full'}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 18, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 11 }} stroke="#334155" />
          <YAxis
            yAxisId="temp"
            domain={domain}
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            stroke="#334155"
            label={{ value: '°C', position: 'insideLeft', fill: '#94a3b8' }}
          />
          <YAxis
            yAxisId="hum"
            orientation="right"
            domain={['auto', 'auto']}
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            stroke="#334155"
            label={{ value: '%RH', position: 'insideRight', fill: '#94a3b8' }}
          />
          <Tooltip
            contentStyle={{
              border: '1px solid #334155',
              background: '#0f172a',
              borderRadius: 6,
              color: '#e2e8f0',
            }}
          />
          <Legend />

          {hasThreshold && (
            <Area
              yAxisId="temp"
              type="monotone"
              dataKey="temperature"
              stroke="none"
              fill="#f87171"
              fillOpacity={0.12}
            />
          )}

          {typeof tempMin === 'number' && (
            <ReferenceLine
              yAxisId="temp"
              y={tempMin}
              stroke="#34d399"
              strokeWidth={2}
              strokeDasharray="8 4"
              label={{
                value: `Ngưỡng dưới ${tempMin}°C`,
                fill: '#34d399',
                fontSize: 11,
                position: 'left',
              }}
            />
          )}
          {typeof tempMax === 'number' && (
            <ReferenceLine
              yAxisId="temp"
              y={tempMax}
              stroke="#ef4444"
              strokeWidth={2}
              strokeDasharray="8 4"
              label={{
                value: `Ngưỡng trên ${tempMax}°C`,
                fill: '#ef4444',
                fontSize: 11,
                position: 'left',
              }}
            />
          )}

          <Line
            yAxisId="temp"
            type="monotone"
            dataKey="temperature"
            name="Nhiệt độ (°C)"
            stroke="#38bdf8"
            strokeWidth={2}
            dot={(p) => {
              const val = p.payload.temperature
              if (hasThreshold && (val < tempMin! || val > tempMax!)) {
                return <circle key={p.key} cx={0} cy={0} r={4} fill="#ef4444" stroke="none" />
              }
              return <circle key={p.key} cx={0} cy={0} r={2} fill="#38bdf8" stroke="none" />
            }}
            isAnimationActive={data.length < 500}
          />
          <Line
            yAxisId="hum"
            type="monotone"
            dataKey="humidity"
            name="Độ ẩm (%)"
            stroke="#a78bfa"
            strokeWidth={2}
            dot={false}
            connectNulls
            isAnimationActive={data.length < 500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
