import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TelemetryPoint } from '../types'

interface TemperatureChartProps {
  points: TelemetryPoint[]
  compact?: boolean
}

export default function TemperatureChart({ points, compact = false }: TemperatureChartProps) {
  const data = points.map((point) => ({
    time: new Date(point.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    temperature: point.temperature,
  }))

  return (
    <div className={compact ? 'h-44 w-full' : 'h-72 w-full'}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 18, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 12 }} stroke="#334155" />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} stroke="#334155" domain={['dataMin - 1', 'dataMax + 1']} />
          <Tooltip
            cursor={{ stroke: '#475569' }}
            contentStyle={{
              border: '1px solid #334155',
              background: '#0f172a',
              borderRadius: 6,
              color: '#e2e8f0',
            }}
          />
          <Line type="monotone" dataKey="temperature" stroke="#38bdf8" strokeWidth={2.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
