import { NextRequest } from 'next/server'
import { checkSupabase } from '@/lib/api/supabase-check'
import { successResponse, errorResponse } from '@/lib/api/response'
import { updateProject, deleteProject } from '@/lib/keepalive/db'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const err = checkSupabase()
  if (err) return err

  try {
    const { id } = await params
    const body = await request.json()

    const updates: { name?: string; supabase_url?: string; service_key?: string; is_active?: boolean } = {}
    if (body.name !== undefined) updates.name = body.name.trim()
    if (body.supabase_url !== undefined) {
      const url = body.supabase_url.trim()
      if (!url.startsWith('https://') || !url.includes('.supabase.co')) {
        return errorResponse('Invalid Supabase URL. Must be https://<project>.supabase.co', 400)
      }
      updates.supabase_url = url
    }
    if (body.service_key !== undefined) updates.service_key = body.service_key.trim()
    if (body.is_active !== undefined) updates.is_active = body.is_active

    const project = await updateProject(id, updates)
    return successResponse(project)
  } catch (e) {
    console.error('Failed to update keepalive project:', e)
    return errorResponse(e instanceof Error ? e.message : 'Failed to update project')
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const err = checkSupabase()
  if (err) return err

  try {
    const { id } = await params
    await deleteProject(id)
    return successResponse({ deleted: true })
  } catch (e) {
    console.error('Failed to delete keepalive project:', e)
    return errorResponse(e instanceof Error ? e.message : 'Failed to delete project')
  }
}
