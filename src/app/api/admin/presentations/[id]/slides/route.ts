import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { checkSupabase } from '@/lib/api/supabase-check'
import { successResponse, errorResponse } from '@/lib/api/response'

// GET - Get slides for a presentation
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const err = checkSupabase()
  if (err) return err

  const { id } = await params

  const { data, error } = await supabase
    .from('presentation_slides')
    .select('*')
    .eq('presentation_id', id)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Failed to fetch slides:', error)
    return errorResponse(`Failed to fetch slides: ${error.message}`)
  }

  return successResponse(data)
}

// POST - Add a slide to a presentation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const err = checkSupabase()
  if (err) return err

  const { id } = await params
  const body = await request.json()
  const {
    image_path,
    sort_order = 0,
    caption,
    duration_ms,
    google_photos_id,
  } = body

  if (!image_path) {
    return errorResponse('image_path is required', 400)
  }

  const { data, error } = await supabase
    .from('presentation_slides')
    .insert({
      presentation_id: id,
      image_path,
      sort_order,
      caption,
      duration_ms,
      google_photos_id,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to add slide:', error)
    return errorResponse(`Failed to add slide: ${error.message}`)
  }

  return successResponse(data)
}

// PUT - Reorder slides
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const err = checkSupabase()
  if (err) return err

  const { id } = await params
  const body = await request.json()
  const { slide_ids } = body // Array of slide IDs in new order

  if (!Array.isArray(slide_ids)) {
    return errorResponse('slide_ids array is required', 400)
  }

  // Update sort_order for each slide
  const updates = slide_ids.map((slideId: string, index: number) =>
    supabase
      .from('presentation_slides')
      .update({ sort_order: index })
      .eq('id', slideId)
      .eq('presentation_id', id)
  )

  try {
    await Promise.all(updates)
    return successResponse({ reordered: true })
  } catch (error) {
    console.error('Failed to reorder slides:', error)
    return errorResponse('Failed to reorder slides')
  }
}

// DELETE - Delete a slide
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const err = checkSupabase()
  if (err) return err

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const slideId = searchParams.get('slideId')

  if (!slideId) {
    return errorResponse('slideId query parameter is required', 400)
  }

  const { error } = await supabase
    .from('presentation_slides')
    .delete()
    .eq('id', slideId)
    .eq('presentation_id', id)

  if (error) {
    console.error('Failed to delete slide:', error)
    return errorResponse(`Failed to delete slide: ${error.message}`)
  }

  return successResponse({ deleted: true })
}
