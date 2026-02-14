import { PING_TIMEOUT_MS } from './config'
import type { PingResult } from './types'

/**
 * Ping the app's own Supabase using environment variables (no DB dependency).
 * This runs first to solve the chicken-and-egg problem.
 */
export async function pingSelf(): Promise<PingResult> {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_KEY
  if (!url || !key) {
    return { id: 'self', name: 'Self (this app)', status: 'error', error: 'Missing SUPABASE_URL or SUPABASE_KEY env vars', responseTimeMs: 0 }
  }
  return pingProject('self', 'Self (this app)', url, key)
}

/**
 * Ping an external Supabase project using its service key.
 */
export async function pingExternalProject(
  id: string, name: string, supabaseUrl: string, serviceKey: string
): Promise<PingResult> {
  return pingProject(id, name, supabaseUrl, serviceKey)
}

/**
 * Ping a Supabase project by making a GET request to its REST API root.
 * Any authenticated request keeps the project active.
 */
async function pingProject(
  id: string, name: string, supabaseUrl: string, serviceKey: string
): Promise<PingResult> {
  const start = Date.now()
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), PING_TIMEOUT_MS)

    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
      signal: controller.signal,
    })
    clearTimeout(timeout)

    const responseTimeMs = Date.now() - start

    // Any response (even 4xx) means the project is alive
    if (response.status < 500) {
      return { id, name, status: 'success', responseTimeMs }
    }
    return { id, name, status: 'error', error: `HTTP ${response.status}`, responseTimeMs }
  } catch (err) {
    return {
      id, name, status: 'error',
      error: err instanceof Error ? err.message : 'Unknown error',
      responseTimeMs: Date.now() - start,
    }
  }
}
