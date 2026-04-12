import { useMemo } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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

  const yDomain = useMemo(() => {
    const temps = data.map((d) => d.temperature).filter((t) => typeof t === 'number')
    const mins = [...temps, tempMin].filter((v): v is number => typeof v === 'number')
    const maxs = [...temps, tempMax].filter((v): v is number => typeof v === 'number')
    if (!mins.length) return ['auto', 'auto'] as const
    const lo = Math.min(...mins) - 1
    const hi = Math.max(...maxs) + 1
    return [lo, hi] as [number, number]
  }, [data, tempMin, tempMax])

  if (data.length === 0) {
    return <div className="text-slate-500 text-sm py-8 text-center">Chưa có dữ liệu telemetry.</div>
  }

  return (
    <div className={compact ? 'h-52 w-full' : 'h-80 w-full'}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 18, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 11 }} stroke="#334155" />
          <YAxis
            yAxisId="temp"
            domain={yDomain}
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
          {typeof tempMin === 'number' && (
            <ReferenceLine
              yAxisId="temp"
              y={tempMin}
              stroke="#f87171"
              strokeDasharray="6 4"
              label={{ value: 'Min', fill: '#f87171', fontSize: 10 }}
            />
          )}
          {typeof tempMax === 'number' && (
            <ReferenceLine
              yAxisId="temp"
              y={tempMax}
              stroke="#f87171"
              strokeDasharray="6 4"
              label={{ value: 'Max', fill: '#f87171', fontSize: 10 }}
            />
          )}
          <Line
            yAxisId="temp"
            type="monotone"
            dataKey="temperature"
            name="Nhiệt độ (°C)"
            stroke="#38bdf8"
            strokeWidth={2}
            dot={false}
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
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
