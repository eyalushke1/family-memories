'use client'

import { useState, useEffect } from 'react'
import type { DateRange, AnalyticsData } from '@/types/analytics'
import { DateRangeFilter } from '@/components/admin/analytics/date-range-filter'
import { MetricCardsRow } from '@/components/admin/analytics/metric-cards-row'
import { ViewsOverTimeChart } from '@/components/admin/analytics/views-over-time-chart'
import { TopClipsChart } from '@/components/admin/analytics/top-clips-chart'
import { ActivityTable } from '@/components/admin/analytics/activity-table'
import { ProfileWatchTimeChart } from '@/components/admin/analytics/profile-watch-time-chart'
import { ProfileStatsTable } from '@/components/admin/analytics/profile-stats-table'
import { DeviceBreakdownChart } from '@/components/admin/analytics/device-breakdown-chart'

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>('30d')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`/api/admin/analytics?range=${dateRange}`)
      .then(res => res.json())
      .then(json => {
        if (cancelled) return
        if (json.success) {
          setData(json.data)
        } else {
          setError(json.error || 'Failed to load analytics')
        }
      })
      .catch(err => {
        if (cancelled) return
        setError(err.message || 'Failed to fetch analytics')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [dateRange])

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Analytics</h1>
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="text-text-secondary text-lg">Loading analytics...</div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Analytics</h1>
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="text-red-400 text-lg">{error || 'No data available'}</div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Analytics</h1>
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
      </div>

      <MetricCardsRow metrics={data.metrics} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <ViewsOverTimeChart data={data.dailyViews} />
        <TopClipsChart data={data.topClips} />
      </div>

      <div className="mt-10 pt-10 border-t border-border">
        <h2 className="text-2xl font-bold mb-6">Insights</h2>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <ProfileWatchTimeChart data={data.profileWatchTimeDistribution} />
          <DeviceBreakdownChart data={data.deviceBreakdown} />
          <div className="lg:col-span-2">
            <ProfileStatsTable data={data.profileStats} />
          </div>
        </div>
      </div>

      <div className="mt-6">
        <ActivityTable data={data.recentViews} />
      </div>
    </div>
  )
}
