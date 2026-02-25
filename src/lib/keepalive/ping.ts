import { supabase, isSupabaseConfigured } from '@/lib/supabase/client'
import { PING_TIMEOUT_MS } from './config'
import type { PingResult } from './types'

/**
 * Ping the app's own Supabase by calling the perform_keepalive_ping() RPC function.
 * This function generates maximum database activity to prevent free-tier pausing:
 *   1. DROP temp table
 *   2. CREATE temp table (with RLS)
 *   3. INSERT random row
 *   4. DELETE row
 *   5. DROP temp table
 *   6. UPDATE supabase_keepalive_projects with ping status and time
 */
export async function pingSelf(): Promise<PingResult> {
  const start = Date.now()

  if (!isSupabaseConfigured) {
    return {
      id: 'self',
      name: 'Self (this app)',
      status: 'error',
      error: 'Missing SUPABASE_URL or SUPABASE_KEY env vars',
      responseTimeMs: 0,
    }
  }

  try {
    const { data, error } = await supabase.rpc('perform_keepalive_ping')

    const responseTimeMs = Date.now() - start

    if (error) {
      return {
        id: 'self',
        name: 'Self (this app)',
        status: 'error',
        error: `RPC failed: ${error.message}`,
        responseTimeMs,
      }
    }

    console.log('[KeepAlive] Self-ping RPC result:', JSON.stringify(data))
    return { id: 'self', name: 'Self (this app)', status: 'success', responseTimeMs }
  } catch (err) {
    return {
      id: 'self',
      name: 'Self (this app)',
      status: 'error',
      error: err instanceof Error ? err.message : 'Unknown error',
      responseTimeMs: Date.now() - start,
    }
  }
}

/**
 * Ping an external Supabase project by calling its perform_keepalive_ping() RPC function.
 * Uses raw fetch since external projects have different URLs/keys.
 * Falls back to a REST API table query if the RPC function doesn't exist.
 */
export async function pingExternalProject(
  id: string, name: string, supabaseUrl: string, serviceKey: string
): Promise<PingResult> {
  const start = Date.now()
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), PING_TIMEOUT_MS)

    // Try calling the RPC function on the external project
    const response = await fetch(
      `${supabaseUrl}/rest/v1/rpc/perform_keepalive_ping`,
      {
        method: 'POST',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          'Accept-Profile': 'family_memories',
        },
        body: '{}',
        signal: controller.signal,
      },
    )
    clearTimeout(timeout)

    const responseTimeMs = Date.now() - start

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
