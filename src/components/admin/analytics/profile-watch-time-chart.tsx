'use client'

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts'
import type { ProfileWatchTimeDataPoint } from '@/types/analytics'

interface ProfileWatchTimeChartProps {
  data: ProfileWatchTimeDataPoint[]
}

function formatHours(minutes: number): string {
  const hours = minutes / 60
  return hours >= 1 ? `${hours.toFixed(1)} hrs` : `${minutes} min`
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ProfileWatchTimeDataPoint & { percent: number } }> }) {
  if (!active || !payload?.[0]) return null
  const d = payload[0].payload
  const pct = ((payload[0].payload as { percent?: number }).percent ?? 0) * 100
  return (
    <div className="bg-bg-secondary border border-border rounded-lg p-3 shadow-lg">
      <p className="text-text-primary text-sm font-medium">{d.profileName}</p>
      <p className="text-text-secondary text-sm">{formatHours(d.watchTimeMinutes)}</p>
      <p className="text-text-secondary text-sm">{pct.toFixed(1)}% of total</p>
    </div>
  )
}

export function ProfileWatchTimeChart({ data }: ProfileWatchTimeChartProps) {
  const total = data.reduce((sum, d) => sum + d.watchTimeMinutes, 0)

  return (
    <div className="bg-bg-card border border-border rounded-xl p-6">
      <h3 className="text-lg font-semibold mb-4">Watch Time by Profile</h3>
      <div className="relative">
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={data}
              dataKey="watchTimeMinutes"
              nameKey="profileName"
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={100}
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-2xl font-bold">{formatHours(total)}</p>
            <p className="text-text-muted text-xs">Total</p>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4">
        {data.map((entry) => (
          <div key={entry.profileName} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
            <span className="text-text-secondary text-xs">{entry.profileName}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
