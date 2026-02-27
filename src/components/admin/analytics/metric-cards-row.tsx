'use client'

import { Eye, Clock, Users, TrendingUp } from 'lucide-react'
import { MetricCard } from './metric-card'
import type { AnalyticsMetrics } from '@/types/analytics'

interface MetricCardsRowProps {
  metrics: AnalyticsMetrics
}

function formatWatchTime(minutes: number): string {
  const hours = minutes / 60
  if (hours >= 1) {
    return `${hours.toFixed(1)} hrs`
  }
  return `${minutes} min`
}

export function MetricCardsRow({ metrics }: MetricCardsRowProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <MetricCard
        label="Total Views"
        value={metrics.totalViews.toLocaleString()}
        trend={metrics.totalViewsTrend}
        trendLabel="vs previous period"
        icon={Eye}
        iconColor="bg-blue-500/20 text-blue-400"
      />
      <MetricCard
        label="Watch Time"
        value={formatWatchTime(metrics.totalWatchTimeMinutes)}
        trend={metrics.totalWatchTimeTrend}
        trendLabel="vs previous period"
        icon={Clock}
        iconColor="bg-purple-500/20 text-purple-400"
      />
      <MetricCard
        label="Active Viewers"
        value={String(metrics.activeViewersThisMonth)}
        trend={metrics.activeViewersTrend}
        trendLabel="vs previous period"
        icon={Users}
        iconColor="bg-green-500/20 text-green-400"
      />
      <MetricCard
        label="Avg. Completion"
        value={`${metrics.averageCompletionRate}%`}
        trend={metrics.completionRateTrend}
        trendLabel="vs previous period"
        icon={TrendingUp}
        iconColor="bg-orange-500/20 text-orange-400"
      />
    </div>
  )
}
