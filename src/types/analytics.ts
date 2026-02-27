export type DateRange = '7d' | '30d' | '90d' | 'all'

export interface AnalyticsMetrics {
  totalViews: number
  totalViewsTrend: number
  totalWatchTimeMinutes: number
  totalWatchTimeTrend: number
  activeViewersThisMonth: number
  activeViewersTrend: number
  averageCompletionRate: number
  completionRateTrend: number
}

export interface DailyViewsDataPoint {
  date: string
  views: number
  uniqueViewers: number
}

export interface TopClipData {
  clipId: string
  title: string
  views: number
  avgCompletionRate: number
  totalWatchTimeMinutes: number
}

export interface RecentViewEntry {
  id: string
  clipTitle: string
  viewerName: string
  viewerAvatar: string | null
  watchedAt: string
  durationWatched: number
  clipDuration: number
  completionPercent: number
}

export interface ProfileStats {
  profileId: string
  name: string
  avatar: string | null
  totalViews: number
  totalWatchTimeMinutes: number
  avgCompletionRate: number
  favoriteClipTitle: string
  lastActiveAt: string
}

export interface ProfileWatchTimeDataPoint {
  profileName: string
  watchTimeMinutes: number
  color: string
}

export interface DeviceBreakdownDataPoint {
  deviceType: string
  label: string
  views: number
  watchTimeMinutes: number
  color: string
}

export interface AnalyticsData {
  metrics: AnalyticsMetrics
  dailyViews: DailyViewsDataPoint[]
  topClips: TopClipData[]
  recentViews: RecentViewEntry[]
  profileStats: ProfileStats[]
  profileWatchTimeDistribution: ProfileWatchTimeDataPoint[]
  deviceBreakdown: DeviceBreakdownDataPoint[]
}
