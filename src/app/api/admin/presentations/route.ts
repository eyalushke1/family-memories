import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { checkSupabase } from '@/lib/api/supabase-check'
import { successResponse, errorResponse } from '@/lib/api/response'

// GET - List all presentations
export async function GET() {
  const err = checkSupabase()
  if (err) return err

  const { data, error } = await supabase
    .from('presentations')
    .select(`
      *,
      clip:clips(id, title, category_id, thumbnail_path)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch presentations:', error)
    return errorResponse(`Failed to fetch presentations: ${error.message}`)
  }

  return successResponse(data)
}

// POST - Create a new presentation
export async function POST(request: NextRequest) {
  const err = checkSupabase()
  if (err) return err

  const body = await request.json()
  const {
    clip_id,
    slide_duration_ms = 5000,
    transition_type = 'fade',
    transition_duration_ms = 500,
    background_music_path,
  } = body

  if (!clip_id) {
    return errorResponse('clip_id is required', 400)
  }

  // Check if presentation already exists for this clip
  const { data: existing } = await supabase
    .from('presentations')
    .select('id')
    .eq('clip_id', clip_id)
    .single()

  if (existing) {
    return errorResponse('A presentation already exists for this clip', 400)
  }

  const { data, error } = await supabase
    .from('presentations')
    .insert({
      clip_id,
      slide_duration_ms,
      transition_type,
      transition_duration_ms,
      background_music_path,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create presentation:', error)
    return errorResponse(`Failed to create presentation: ${error.message}`)
  }

  return successResponse(data)
}
