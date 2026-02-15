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
    } catch {
      // DB not available yet
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
