import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { checkSupabase } from '@/lib/api/supabase-check'
import { successResponse, errorResponse } from '@/lib/api/response'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const err = checkSupabase()
  if (err) return err

  const { id } = await params
  const body = await request.json()

  // Whitelist allowed fields
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name !== undefined) updateData.name = body.name
  if (body.description !== undefined) updateData.description = body.description
  if (body.video_path !== undefined) updateData.video_path = body.video_path
  if (body.thumbnail_path !== undefined) updateData.thumbnail_path = body.thumbnail_path
  if (body.duration_seconds !== undefined) updateData.duration_seconds = body.duration_seconds
  if (body.is_active !== undefined) updateData.is_active = body.is_active

  const { data, error } = await supabase
    .from('intro_clips')
    .update(updateData)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('Failed to update intro clip:', error)
    return errorResponse('Failed to update intro clip')
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

  // Check if any clips are using this intro
  const { count } = await supabase
    .from('clips')
    .select('*', { count: 'exact', head: true })
    .eq('intro_clip_id', id)

  if (count && count > 0) {
    return errorResponse(
      `Cannot delete intro clip. It is used by ${count} clip(s). Remove the intro from those clips first.`,
      400
    )
  }

  const { error } = await supabase.from('intro_clips').delete().eq('id', id)

  if (error) {
    console.error('Failed to delete intro clip:', error)
    return errorResponse('Failed to delete intro clip')
  }

  return successResponse({ deleted: true })
}
