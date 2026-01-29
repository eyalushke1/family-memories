import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { checkSupabase } from '@/lib/api/supabase-check'
import { successResponse, errorResponse } from '@/lib/api/response'
import type { UpdateClip } from '@/types/database'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const err = checkSupabase()
  if (err) return err

  const { id } = await params
  const body: UpdateClip = await request.json()

  const updateData = {
    ...body,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('clips')
    .update(updateData)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('Failed to update clip:', error)
    return errorResponse(`Failed to update clip: ${error.message}`)
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
    return errorResponse(`Failed to delete clip: ${error.message}`)
  }

  return successResponse({ deleted: true })
}
