'use client'

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import type { DailyViewsDataPoint } from '@/types/analytics'

interface ViewsOverTimeChartProps {
  data: DailyViewsDataPoint[]
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload || !label) return null
  return (
    <div className="bg-bg-secondary border border-border rounded-lg p-3 shadow-lg">
      <p className="text-text-secondary text-sm mb-1">{formatDateLabel(label)}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  )
}

export function ViewsOverTimeChart({ data }: ViewsOverTimeChartProps) {
  const tickInterval = data.length <= 7 ? 0 : data.length <= 30 ? 4 : 13

  return (
    <div className="bg-bg-card border border-border rounded-xl p-6">
      <h3 className="text-lg font-semibold mb-4">Views Over Time</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDateLabel}
            tick={{ fill: '#737373', fontSize: 12 }}
            interval={tickInterval}
            axisLine={{ stroke: '#2a2a2a' }}
            tickLine={{ stroke: '#2a2a2a' }}
          />
          <YAxis
            tick={{ fill: '#737373', fontSize: 12 }}
            axisLine={{ stroke: '#2a2a2a' }}
            tickLine={{ stroke: '#2a2a2a' }}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="views"
            name="Views"
            stroke="#e50914"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#e50914' }}
          />
          <Line
            type="monotone"
            dataKey="uniqueViewers"
            name="Unique Viewers"
            stroke="#6366f1"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#6366f1' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
