import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { checkSupabase } from '@/lib/api/supabase-check'
import { successResponse, errorResponse } from '@/lib/api/response'
import type { InsertIntroClip } from '@/types/database'

export async function GET() {
  const err = checkSupabase()
  if (err) return err

  const { data, error } = await supabase
    .from('intro_clips')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch intro clips:', error)
    return errorResponse(`Failed to fetch intro clips: ${error.message}`)
  }

  return successResponse(data)
}

export async function POST(request: NextRequest) {
  const err = checkSupabase()
  if (err) return err

  const body = await request.json()
  const name = body.name?.trim()

  if (!name) {
    return errorResponse('Name is required', 400)
  }

  if (!body.video_path) {
    return errorResponse('Video path is required', 400)
  }

  const insertData: InsertIntroClip = {
    name,
    video_path: body.video_path,
    description: body.description || null,
    thumbnail_path: body.thumbnail_path || null,
    duration_seconds: body.duration_seconds || null,
    is_active: body.is_active ?? true,
  }

  const { data, error } = await supabase
    .from('intro_clips')
    .insert(insertData)
    .select('*')
    .single()

  if (error) {
    console.error('Failed to create intro clip:', error)
    return errorResponse(`Failed to create intro clip: ${error.message}`)
  }

  return successResponse(data, 201)
}
