import { pingSelf, pingExternalProject } from './ping'
import { listActiveProjectsFull, updatePingResult, getProjectCount, getLastPingTime } from './db'
import { PING_INTERVAL_MS } from './config'
import { isSupabaseConfigured } from '@/lib/supabase/client'
import type { PingResult } from './types'

let intervalId: ReturnType<typeof setInterval> | null = null
let lastRunAt: Date | null = null
let bootedAt: Date | null = null

export function startScheduler(): void {
  if (bootedAt) {
    console.log('[KeepAlive] Scheduler already started, skipping')
    return
  }

  const intervalHours = PING_INTERVAL_MS / 3600000
  console.log(`[KeepAlive] Starting scheduler (interval: ${intervalHours}h)`)
  bootedAt = new Date()

  // Run first ping cycle after a short delay to let the server fully start
  setTimeout(() => {
    runPingCycle()
    intervalId = setInterval(runPingCycle, PING_INTERVAL_MS)
  }, 30_000) // 30 seconds after boot
}

/** Lazy-start fallback: call from API routes in case instrumentation.ts didn't run */
export function ensureSchedulerStarted(): void {
  if (!bootedAt) {
    console.log('[KeepAlive] Lazy-starting scheduler from API request')
    startScheduler()
  }
}

export function stopScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
    bootedAt = null
    console.log('[KeepAlive] Scheduler stopped')
  }
}

export async function getSchedulerStatus() {
  let projectCount = 0
  let lastPingFromDb: string | null = null

  if (isSupabaseConfigured) {
    try {
      projectCount = await getProjectCount()
      lastPingFromDb = await getLastPingTime()
    } catch {
      // DB not available yet
    }
  }

  // Use in-memory lastRunAt if available, otherwise fall back to DB
  const effectiveLastRun = lastRunAt?.toISOString() ?? lastPingFromDb

  return {
    schedulerRunning: true, // Always active: auto-starts via instrumentation.ts or lazy-start
    intervalMs: PING_INTERVAL_MS,
    lastRunAt: effectiveLastRun,
    nextRunAt: effectiveLastRun
      ? new Date(new Date(effectiveLastRun).getTime() + PING_INTERVAL_MS).toISOString()
      : null,
    projectCount,
  }
}

export async function runPingCycle(): Promise<PingResult[]> {
  console.log('[KeepAlive] Starting ping cycle...')
  lastRunAt = new Date()
  const results: PingResult[] = []

  // Step 1: Always ping self first (env vars, no DB dependency)
  const selfResult = await pingSelf()
  results.push(selfResult)
  console.log(`[KeepAlive] Self: ${selfResult.status}${selfResult.error ? ` (${selfResult.error})` : ''} [${selfResult.responseTimeMs}ms]`)

  if (selfResult.status === 'error') {
    console.error('[KeepAlive] Self-ping failed, skipping DB projects')
    return results
  }

  // Step 2: Ping all active projects from DB
  if (!isSupabaseConfigured) {
    console.log('[KeepAlive] Supabase not configured, skipping DB projects')
    return results
  }

  try {
    const projects = await listActiveProjectsFull()
    console.log(`[KeepAlive] Pinging ${projects.length} project(s)...`)

    for (const project of projects) {
      const result = await pingExternalProject(
        project.id, project.name, project.supabase_url, project.service_key
      )
      results.push(result)
      console.log(`[KeepAlive] ${project.name}: ${result.status}${result.error ? ` (${result.error})` : ''} [${result.responseTimeMs}ms]`)

      await updatePingResult(project.id, result.status, result.error)
    }
  } catch (err) {
    console.error('[KeepAlive] Error during ping cycle:', err)
  }

  console.log('[KeepAlive] Ping cycle complete')
  return results
}
