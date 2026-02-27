import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { checkSupabase } from '@/lib/api/supabase-check'
import { successResponse, errorResponse } from '@/lib/api/response'
import type { DateRange, AnalyticsData } from '@/types/analytics'

const PROFILE_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#3b82f6', '#84cc16',
]

function getRangeDays(range: DateRange): number | null {
  switch (range) {
    case '7d': return 7
    case '30d': return 30
    case '90d': return 90
    case 'all': return null
  }
}

function getStartDate(days: number | null): string | null {
  if (days === null) return null
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

export async function GET(request: NextRequest) {
  const err = checkSupabase()
  if (err) return err

  const range = (request.nextUrl.searchParams.get('range') || '30d') as DateRange
  const days = getRangeDays(range)
  const startDate = getStartDate(days)
  const prevStartDate = days ? getStartDate(days * 2) : null

  try {
    // ── Current period views ──
    let currentQuery = supabase
      .from('view_events')
      .select('*')

    if (startDate) {
      currentQuery = currentQuery.gte('started_at', startDate)
    }

    const { data: currentViews, error: currentError } = await currentQuery

    if (currentError) {
      console.error('[Analytics] Failed to fetch current views:', currentError)
      return errorResponse(`Failed to fetch analytics: ${currentError.message}`)
    }

    // ── Previous period views (for trends) ──
    let prevViews: typeof currentViews = []
    if (startDate && prevStartDate) {
      const { data } = await supabase
        .from('view_events')
        .select('*')
        .gte('started_at', prevStartDate)
        .lt('started_at', startDate)

      prevViews = data || []
    }

    // ── Fetch clips and profiles for joins ──
    const { data: clips } = await supabase
      .from('clips')
      .select('id, title')

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, avatar_path')

    const clipMap = new Map((clips || []).map(c => [c.id, c]))
    const profileMap = new Map((profiles || []).map(p => [p.id, p]))

    // ── Metrics ──
    const totalViews = currentViews.length
    const prevTotalViews = prevViews.length

    const totalWatchSeconds = currentViews.reduce((sum, v) => sum + (v.duration_watched_seconds || 0), 0)
    const prevWatchSeconds = prevViews.reduce((sum, v) => sum + (v.duration_watched_seconds || 0), 0)
    const totalWatchTimeMinutes = Math.round(totalWatchSeconds / 60)

    const activeViewerIds = new Set(currentViews.filter(v => v.profile_id).map(v => v.profile_id))
    const prevActiveViewerIds = new Set(prevViews.filter(v => v.profile_id).map(v => v.profile_id))

    const completionValues = currentViews.filter(v => v.completion_percent > 0).map(v => v.completion_percent)
    const avgCompletion = completionValues.length > 0
      ? Math.round(completionValues.reduce((s, v) => s + v, 0) / completionValues.length)
      : 0

    const prevCompletionValues = prevViews.filter(v => v.completion_percent > 0).map(v => v.completion_percent)
    const prevAvgCompletion = prevCompletionValues.length > 0
      ? Math.round(prevCompletionValues.reduce((s, v) => s + v, 0) / prevCompletionValues.length)
      : 0

    function calcTrend(current: number, previous: number): number {
      if (previous === 0) return current > 0 ? 100 : 0
      return Math.round(((current - previous) / previous) * 100)
    }

    const metrics = {
      totalViews,
      totalViewsTrend: calcTrend(totalViews, prevTotalViews),
      totalWatchTimeMinutes,
      totalWatchTimeTrend: calcTrend(totalWatchSeconds, prevWatchSeconds),
      activeViewersThisMonth: activeViewerIds.size,
      activeViewersTrend: calcTrend(activeViewerIds.size, prevActiveViewerIds.size),
      averageCompletionRate: avgCompletion,
      completionRateTrend: calcTrend(avgCompletion, prevAvgCompletion),
    }

    // ── Daily views ──
    const dailyMap = new Map<string, { views: number; viewers: Set<string> }>()
    for (const v of currentViews) {
      const day = v.started_at.slice(0, 10) // YYYY-MM-DD
      if (!dailyMap.has(day)) dailyMap.set(day, { views: 0, viewers: new Set() })
      const entry = dailyMap.get(day)!
      entry.views++
      if (v.profile_id) entry.viewers.add(v.profile_id)
    }

    const dailyViews = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { views, viewers }]) => ({
        date,
        views,
        uniqueViewers: viewers.size,
      }))

    // ── Top clips ──
    const clipAgg = new Map<string, { views: number; completionSum: number; completionCount: number; watchSeconds: number }>()
    for (const v of currentViews) {
      if (!clipAgg.has(v.clip_id)) {
        clipAgg.set(v.clip_id, { views: 0, completionSum: 0, completionCount: 0, watchSeconds: 0 })
      }
      const agg = clipAgg.get(v.clip_id)!
      agg.views++
      if (v.completion_percent > 0) {
        agg.completionSum += v.completion_percent
        agg.completionCount++
      }
      agg.watchSeconds += v.duration_watched_seconds || 0
    }

    const topClips = Array.from(clipAgg.entries())
      .sort(([, a], [, b]) => b.views - a.views)
      .slice(0, 8)
      .map(([clipId, agg]) => ({
        clipId,
        title: clipMap.get(clipId)?.title || 'Unknown Clip',
        views: agg.views,
        avgCompletionRate: agg.completionCount > 0 ? Math.round(agg.completionSum / agg.completionCount) : 0,
        totalWatchTimeMinutes: Math.round(agg.watchSeconds / 60),
      }))

    // ── Profile stats ──
    const profileAgg = new Map<string, {
      views: number; watchSeconds: number; completionSum: number; completionCount: number;
      clipCounts: Map<string, number>; lastAt: string
    }>()

    for (const v of currentViews) {
      const pid = v.profile_id || '__anonymous__'
      if (!profileAgg.has(pid)) {
        profileAgg.set(pid, {
          views: 0, watchSeconds: 0, completionSum: 0, completionCount: 0,
          clipCounts: new Map(), lastAt: v.started_at,
        })
      }
      const agg = profileAgg.get(pid)!
      agg.views++
      agg.watchSeconds += v.duration_watched_seconds || 0
      if (v.completion_percent > 0) {
        agg.completionSum += v.completion_percent
        agg.completionCount++
      }
      agg.clipCounts.set(v.clip_id, (agg.clipCounts.get(v.clip_id) || 0) + 1)
      if (v.started_at > agg.lastAt) agg.lastAt = v.started_at
    }

    const profileStats = Array.from(profileAgg.entries())
      .filter(([pid]) => pid !== '__anonymous__')
      .sort(([, a], [, b]) => b.views - a.views)
      .map(([pid, agg]) => {
        const profile = profileMap.get(pid)
        // Find most-watched clip for this profile
        let favoriteClipId = ''
        let maxCount = 0
        for (const [cid, count] of agg.clipCounts) {
          if (count > maxCount) { maxCount = count; favoriteClipId = cid }
        }
        return {
          profileId: pid,
          name: profile?.name || 'Unknown',
          avatar: profile?.avatar_path || null,
          totalViews: agg.views,
          totalWatchTimeMinutes: Math.round(agg.watchSeconds / 60),
          avgCompletionRate: agg.completionCount > 0 ? Math.round(agg.completionSum / agg.completionCount) : 0,
          favoriteClipTitle: clipMap.get(favoriteClipId)?.title || 'N/A',
          lastActiveAt: agg.lastAt,
        }
      })

    // ── Profile watch time distribution ──
    const profileWatchTimeDistribution = profileStats.map((ps, i) => ({
      profileName: ps.name,
      watchTimeMinutes: ps.totalWatchTimeMinutes,
      color: PROFILE_COLORS[i % PROFILE_COLORS.length],
    }))

    // ── Recent views ──
    const recentViews = [...currentViews]
      .sort((a, b) => b.started_at.localeCompare(a.started_at))
      .slice(0, 15)
      .map(v => {
        const clip = clipMap.get(v.clip_id)
        const profile = v.profile_id ? profileMap.get(v.profile_id) : null
        return {
          id: v.id,
          clipTitle: clip?.title || 'Unknown Clip',
          viewerName: profile?.name || 'Anonymous',
          viewerAvatar: profile?.avatar_path || null,
          watchedAt: v.started_at,
          durationWatched: v.duration_watched_seconds || 0,
          clipDuration: v.clip_duration_seconds || 0,
          completionPercent: v.completion_percent || 0,
        }
      })

    const analyticsData: AnalyticsData = {
      metrics,
      dailyViews,
      topClips,
      recentViews,
      profileStats,
      profileWatchTimeDistribution,
    }

    return successResponse(analyticsData)
  } catch (error) {
    console.error('[Analytics] Unexpected error:', error)
    return errorResponse('An unexpected error occurred while fetching analytics')
  }
}
