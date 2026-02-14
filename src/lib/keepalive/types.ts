export interface KeepAliveProjectSafe {
  id: string
  name: string
  supabase_url: string
  is_active: boolean
  last_ping_at: string | null
  last_ping_status: string
  last_ping_error: string | null
  created_at: string
  updated_at: string
}

export interface PingResult {
  id: string
  name: string
  status: 'success' | 'error'
  error?: string
  responseTimeMs: number
}

export interface SchedulerStatus {
  schedulerRunning: boolean
  intervalMs: number
  lastRunAt: string | null
  nextRunAt: string | null
  projectCount: number
}
