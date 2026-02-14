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

  if (error) throw new Error(`Failed to list active projects: ${error.message}`)
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
): Promise<void> {
  await supabase
    .from('supabase_keepalive_projects')
    .update({
      last_ping_at: new Date().toISOString(),
      last_ping_status: status,
      last_ping_error: errorMsg || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
}

export async function getProjectCount(): Promise<number> {
  const { count, error } = await supabase
    .from('supabase_keepalive_projects')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)

  if (error) return 0
  return count ?? 0
}
