import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { checkSupabase } from '@/lib/api/supabase-check'
import { successResponse, errorResponse } from '@/lib/api/response'
import type { InsertClip } from '@/types/database'

export async function GET(request: NextRequest) {
  const err = checkSupabase()
  if (err) return err

  const categoryId = request.nextUrl.searchParams.get('category_id')

  let query = supabase
    .from('clips')
    .select(`
      *,
      presentation:presentations(id)
    `)
    .order('sort_order', { ascending: true })

  if (categoryId) {
    query = query.eq('category_id', categoryId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch clips:', error)
    return errorResponse(`Failed to fetch clips: ${error.message}`)
  }

  // Transform presentation array to single object (Supabase returns one-to-many as array)
  const transformedData = data?.map((clip) => ({
    ...clip,
    presentation: Array.isArray(clip.presentation) && clip.presentation.length > 0
      ? clip.presentation[0]
      : null
  }))

  return successResponse(transformedData)
}

export async function POST(request: NextRequest) {
  const err = checkSupabase()
  if (err) return err

  const body = await request.json()
  const title = body.title?.trim()
  const categoryId = body.category_id

  if (!title) {
    return errorResponse('Title is required', 400)
  }

  if (!categoryId) {
    return errorResponse('Category is required', 400)
  }

  if (!body.video_path) {
    return errorResponse('Video path is required', 400)
  }

  // Get max sort_order for this category
  const { data: maxOrder } = await supabase
    .from('clips')
    .select('sort_order')
    .eq('category_id', categoryId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()

  const sort_order = (maxOrder?.sort_order ?? 0) + 1

  const insertData: InsertClip = {
    title,
    category_id: categoryId,
    video_path: body.video_path,
    description: body.description || null,
    thumbnail_path: body.thumbnail_path || null,
    animated_thumbnail_path: body.animated_thumbnail_path || null,
    duration_seconds: body.duration_seconds || null,
    intro_clip_id: body.intro_clip_id || null,
    sort_order,
    is_active: body.is_active ?? true,
  }

  const { data, error } = await supabase
    .from('clips')
    .insert(insertData)
    .select('*')
    .single()

  if (error) {
    console.error('Failed to create clip:', error)
    return errorResponse(`Failed to create clip: ${error.message}`)
  }

  return successResponse(data, 201)
}
