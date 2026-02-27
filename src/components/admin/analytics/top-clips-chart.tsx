'use client'

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import type { TopClipData } from '@/types/analytics'

interface TopClipsChartProps {
  data: TopClipData[]
}

function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen - 1) + '\u2026' : str
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: TopClipData }> }) {
  if (!active || !payload?.[0]) return null
  const clip = payload[0].payload
  return (
    <div className="bg-bg-secondary border border-border rounded-lg p-3 shadow-lg">
      <p className="text-text-primary text-sm font-medium mb-1">{clip.title}</p>
      <p className="text-text-secondary text-sm">{clip.views} views</p>
      <p className="text-text-secondary text-sm">{clip.avgCompletionRate}% avg completion</p>
    </div>
  )
}

export function TopClipsChart({ data }: TopClipsChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    shortTitle: truncate(d.title, 22),
  }))

  return (
    <div className="bg-bg-card border border-border rounded-xl p-6">
      <h3 className="text-lg font-semibold mb-4">Top Clips</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: '#737373', fontSize: 12 }}
            axisLine={{ stroke: '#2a2a2a' }}
            tickLine={{ stroke: '#2a2a2a' }}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="shortTitle"
            tick={{ fill: '#a3a3a3', fontSize: 12 }}
            axisLine={{ stroke: '#2a2a2a' }}
            tickLine={false}
            width={140}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
          <Bar
            dataKey="views"
            fill="#e50914"
            radius={[0, 4, 4, 0]}
            barSize={24}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
