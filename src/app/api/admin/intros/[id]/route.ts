import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { checkSupabase } from '@/lib/api/supabase-check'
import { successResponse, errorResponse } from '@/lib/api/response'
import type { UpdateIntroClip } from '@/types/database'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const err = checkSupabase()
  if (err) return err

  const { id } = await params
  const body: UpdateIntroClip = await request.json()

  const updateData = {
    ...body,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('intro_clips')
    .update(updateData)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('Failed to update intro clip:', error)
    return errorResponse(`Failed to update intro clip: ${error.message}`)
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
    return errorResponse(`Failed to delete intro clip: ${error.message}`)
  }

  return successResponse({ deleted: true })
}
