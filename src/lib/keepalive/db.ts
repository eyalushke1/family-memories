import { supabase } from '@/lib/supabase/client'
import type { KeepAliveProjectSafe } from './types'
import type { KeepAliveProjectRow } from '@/types/database'

function toSafe(row: KeepAliveProjectRow): KeepAliveProjectSafe {
  const { service_key: _, ...safe } = row
  return safe
}

export async function listProjects(): Promise<KeepAliveProjectSafe[]> {
  const { data, error } = await supabase
    .from('supabase_keepalive_projects')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Failed to list keepalive projects: ${error.message}`)
  return (data as KeepAliveProjectRow[]).map(toSafe)
}

export async function listActiveProjectsFull(): Promise<KeepAliveProjectRow[]> {
  const { data, error } = await supabase
    .from('supabase_keepalive_projects')
    .select('*')
    .eq('is_active', true)

  if (error) {
    console.error('[KeepAlive DB] listActiveProjectsFull error:', error.message, error.details, error.hint)
    throw new Error(`Failed to list active projects: ${error.message}`)
  }

  if (!data || data.length === 0) {
    console.warn('[KeepAlive DB] No active projects found — if projects exist, RLS may be blocking reads. Ensure SUPABASE_KEY is the service_role key.')
  }

  return data as KeepAliveProjectRow[]
}

export async function addProject(
  name: string, supabaseUrl: string, serviceKey: string
): Promise<KeepAliveProjectSafe> {
  const { data, error } = await supabase
    .from('supabase_keepalive_projects')
    .insert({ name, supabase_url: supabaseUrl, service_key: serviceKey })
    .select('*')
    .single()

  if (error) throw new Error(`Failed to add project: ${error.message}`)
  return toSafe(data as KeepAliveProjectRow)
}

export async function updateProject(
  id: string, updates: { name?: string; supabase_url?: string; service_key?: string; is_active?: boolean }
): Promise<KeepAliveProjectSafe> {
  const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (updates.name !== undefined) dbUpdates.name = updates.name
  if (updates.supabase_url !== undefined) dbUpdates.supabase_url = updates.supabase_url
  if (updates.is_active !== undefined) dbUpdates.is_active = updates.is_active
  if (updates.service_key) dbUpdates.service_key = updates.service_key

  const { data, error } = await supabase
    .from('supabase_keepalive_projects')
    .update(dbUpdates)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw new Error(`Failed to update project: ${error.message}`)
  return toSafe(data as KeepAliveProjectRow)
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase
    .from('supabase_keepalive_projects')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`Failed to delete project: ${error.message}`)
}

export async function updatePingResult(
  id: string, status: 'success' | 'error', errorMsg?: string
): Promise<string | null> {
  const updatePayload = {
    last_ping_at: new Date().toISOString(),
    last_ping_status: status,
    last_ping_error: errorMsg || null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('supabase_keepalive_projects')
    .update(updatePayload)
    .eq('id', id)
    .select('id, last_ping_at, last_ping_status')

  if (error) {
    console.error(`[KeepAlive DB] updatePingResult error for ${id}:`, error.message, error.details, error.hint)
    return error.message
  }

  if (!data || data.length === 0) {
    const msg = `Update returned 0 rows for id=${id} — RLS may be blocking writes. Ensure SUPABASE_KEY is the service_role key.`
    console.error(`[KeepAlive DB] ${msg}`)
    return msg
  }

  console.log(`[KeepAlive DB] Updated ${id}: status=${data[0].last_ping_status}, at=${data[0].last_ping_at}`)
  return null
}

export async function getProjectCount(): Promise<number> {
  const { count, error } = await supabase
    .from('supabase_keepalive_projects')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)

  if (error) return 0
  return count ?? 0
}

export async function getLastPingTime(): Promise<string | null> {
  const { data, error } = await supabase
    .from('supabase_keepalive_projects')
    .select('last_ping_at')
    .not('last_ping_at', 'is', null)
    .order('last_ping_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return null
  return data.last_ping_at as string
}
