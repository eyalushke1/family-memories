import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { checkSupabase } from '@/lib/api/supabase-check'
import { successResponse, errorResponse } from '@/lib/api/response'
import type { UpdateProfile } from '@/types/database'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const err = checkSupabase()
  if (err) return err

  const { id } = await params

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, avatar_path, is_hidden, created_at, updated_at')
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
  const body: UpdateProfile = await request.json()

  const { data, error } = await supabase
    .from('profiles')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, name, avatar_path, is_hidden, created_at, updated_at')
    .single()

  if (error) {
    console.error('Failed to update profile:', error)
    return errorResponse(`Failed to update profile: ${error.message}`)
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

  // Delete related records first (foreign key constraints)
  await supabase.from('clip_profiles').delete().eq('profile_id', id)

  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Failed to delete profile:', error)
    return errorResponse(`Failed to delete profile: ${error.message}`)
  }

  return successResponse({ deleted: true })
}
