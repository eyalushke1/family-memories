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
  if (body.title !== undefined) updateData.title = body.title
  if (body.description !== undefined) updateData.description = body.description
  if (body.category_id !== undefined) updateData.category_id = body.category_id
  if (body.video_path !== undefined) updateData.video_path = body.video_path
  if (body.thumbnail_path !== undefined) updateData.thumbnail_path = body.thumbnail_path
  if (body.animated_thumbnail_path !== undefined) updateData.animated_thumbnail_path = body.animated_thumbnail_path
  if (body.duration_seconds !== undefined) updateData.duration_seconds = body.duration_seconds
  if (body.intro_clip_id !== undefined) updateData.intro_clip_id = body.intro_clip_id
  if (body.sort_order !== undefined) updateData.sort_order = body.sort_order
  if (body.is_active !== undefined) updateData.is_active = body.is_active

  const { data, error } = await supabase
    .from('clips')
    .update(updateData)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('Failed to update clip:', error)
    return errorResponse('Failed to update clip')
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

  const { error } = await supabase.from('clips').delete().eq('id', id)

  if (error) {
    console.error('Failed to delete clip:', error)
    return errorResponse('Failed to delete clip')
  }

  return successResponse({ deleted: true })
}
