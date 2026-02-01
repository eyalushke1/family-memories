import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { checkSupabase } from '@/lib/api/supabase-check'
import { successResponse, errorResponse } from '@/lib/api/response'

// GET - Get a presentation by ID
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const err = checkSupabase()
  if (err) return err

  const { id } = await params

  const { data, error } = await supabase
    .from('presentations')
    .select(`
      *,
      clip:clips(id, title, category_id, thumbnail_path),
      slides:presentation_slides(*)
    `)
    .eq('id', id)
    .single()

  if (error) {
    console.error('Failed to fetch presentation:', error)
    return errorResponse(`Failed to fetch presentation: ${error.message}`)
  }

  return successResponse(data)
}

// PUT - Update a presentation
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const err = checkSupabase()
  if (err) return err

  const { id } = await params
  const body = await request.json()

  const updateData: Record<string, unknown> = {}

  if (body.slide_duration_ms !== undefined) {
    updateData.slide_duration_ms = body.slide_duration_ms
  }
  if (body.transition_type !== undefined) {
    updateData.transition_type = body.transition_type
  }
  if (body.transition_duration_ms !== undefined) {
    updateData.transition_duration_ms = body.transition_duration_ms
  }
  if (body.background_music_path !== undefined) {
    updateData.background_music_path = body.background_music_path
  }

  const { data, error } = await supabase
    .from('presentations')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Failed to update presentation:', error)
    return errorResponse(`Failed to update presentation: ${error.message}`)
  }

  return successResponse(data)
}

// DELETE - Delete a presentation
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const err = checkSupabase()
  if (err) return err

  const { id } = await params

  // Slides will be deleted automatically due to CASCADE
  const { error } = await supabase
    .from('presentations')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Failed to delete presentation:', error)
    return errorResponse(`Failed to delete presentation: ${error.message}`)
  }

  return successResponse({ deleted: true })
}
