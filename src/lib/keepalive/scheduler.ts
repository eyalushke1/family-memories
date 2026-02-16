import { pingSelf, pingExternalProject } from './ping'
import { listActiveProjectsFull, updatePingResult, getProjectCount, getLastPingTime } from './db'
import { PING_INTERVAL_MS } from './config'
import { isSupabaseConfigured } from '@/lib/supabase/client'
import type { PingResult } from './types'

export async function getSchedulerStatus() {
  let projectCount = 0
  let lastPingFromDb: string | null = null

  if (isSupabaseConfigured) {
    try {
      projectCount = await getProjectCount()
      lastPingFromDb = await getLastPingTime()
    } catch (err) {
      console.error('[KeepAlive] Failed to get status from DB:', err)
    }
  }

  return {
    schedulerRunning: true,
    intervalMs: PING_INTERVAL_MS,
    lastRunAt: lastPingFromDb,
    nextRunAt: lastPingFromDb
      ? new Date(new Date(lastPingFromDb).getTime() + PING_INTERVAL_MS).toISOString()
      : null,
    projectCount,
  }
}

export async function runPingCycle(): Promise<PingResult[]> {
  console.log('[KeepAlive] Starting ping cycle...')
  const results: PingResult[] = []

  // Step 1: Ping self (env vars, no DB dependency)
  // This keeps the app's own Supabase alive even if DB operations fail
  try {
    const selfResult = await pingSelf()
    results.push(selfResult)
    console.log(`[KeepAlive] Self: ${selfResult.status}${selfResult.error ? ` — ${selfResult.error}` : ''} [${selfResult.responseTimeMs}ms]`)
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    console.error('[KeepAlive] Self-ping threw:', error)
    results.push({ id: 'self', name: 'Self (this app)', status: 'error', error, responseTimeMs: 0 })
  }

  // Step 2: Ping all active projects from DB (independent of self-ping result)
  if (!isSupabaseConfigured) {
    console.log('[KeepAlive] Supabase not configured, skipping DB projects')
    return results
  }

  try {
    const projects = await listActiveProjectsFull()
    console.log(`[KeepAlive] Found ${projects.length} active project(s) to ping`)

    for (const project of projects) {
      try {
        const result = await pingExternalProject(
          project.id, project.name, project.supabase_url, project.service_key
        )
        results.push(result)
        console.log(`[KeepAlive] ${project.name}: ${result.status}${result.error ? ` — ${result.error}` : ''} [${result.responseTimeMs}ms]`)

        // Update DB with result
        const updateError = await updatePingResult(project.id, result.status, result.error)
        if (updateError) {
          console.error(`[KeepAlive] Failed to update DB for ${project.name}:`, updateError)
        }
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Unknown error'
        console.error(`[KeepAlive] Error pinging ${project.name}:`, error)
        results.push({ id: project.id, name: project.name, status: 'error', error, responseTimeMs: 0 })
      }
    }
  } catch (err) {
    console.error('[KeepAlive] Failed to fetch projects from DB:', err)
  }

  console.log(`[KeepAlive] Ping cycle complete — ${results.length} result(s)`)
  return results
}
