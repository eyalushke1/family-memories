import { createClient } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client'
import { PING_TIMEOUT_MS } from './config'
import type { PingResult } from './types'

/**
 * Ping the app's own Supabase by calling the perform_keepalive_ping() RPC function.
 * This function generates maximum database activity to prevent free-tier pausing.
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
 * Keep an external Supabase project alive by calling its perform_keepalive_ping()
 * RPC function on the public schema. The RPC runs DDL + DML operations that
 * Supabase recognizes as real activity, preventing free-tier pausing:
 *   1. DROP TABLE public._keepalive_temp
 *   2. CREATE TABLE public._keepalive_temp
 *   3. INSERT a row into public._keepalive_temp
 */
export async function pingExternalProject(
  id: string, name: string, supabaseUrl: string, serviceKey: string
): Promise<PingResult> {
  const start = Date.now()
  try {
    // Create a Supabase client for the external project using the public schema
    const externalClient = createClient(supabaseUrl, serviceKey, {
      db: { schema: 'public' },
    })

    // Call the RPC function that runs DROP TABLE, CREATE TABLE, INSERT
    const { data, error } = await externalClient.rpc('perform_keepalive_ping')

    const responseTimeMs = Date.now() - start

    if (error) {
      return {
        id, name, status: 'error',
        error: `RPC failed: ${error.message}`,
        responseTimeMs,
      }
    }

    console.log(`[KeepAlive] ${name} RPC result:`, JSON.stringify(data))
    return { id, name, status: 'success', responseTimeMs }
  } catch (err) {
    return {
      id, name, status: 'error',
      error: err instanceof Error ? err.message : 'Unknown error',
      responseTimeMs: Date.now() - start,
    }
  }
}
