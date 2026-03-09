import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { checkSupabase } from '@/lib/api/supabase-check'
import { successResponse, errorResponse } from '@/lib/api/response'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const err = checkSupabase()
  if (err) return err

  const { id } = await params

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, avatar_path, is_admin, created_at, updated_at')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Failed to fetch profile:', error)
    return errorResponse('Profile not found', 404)
  }

  return successResponse(data)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const err = checkSupabase()
  if (err) return err

  const { id } = await params
  const body = await request.json()

  // Whitelist allowed fields - never allow is_admin via public API
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name !== undefined) updateData.name = body.name
  if (body.avatar_path !== undefined) updateData.avatar_path = body.avatar_path

  const { data, error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', id)
    .select('id, name, avatar_path, is_admin, created_at, updated_at')
    .single()

  if (error) {
    console.error('Failed to update profile:', error)
    return errorResponse('Failed to update profile')
  }

  return successResponse(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const err = checkSupabase()
  if (err) return err

  const { id } = await params

  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Failed to delete profile:', error)
    return errorResponse('Failed to delete profile')
  }

  return successResponse({ deleted: true })
}
