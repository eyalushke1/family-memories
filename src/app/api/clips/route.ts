import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { checkSupabase } from '@/lib/api/supabase-check'
import { successResponse, errorResponse } from '@/lib/api/response'

export async function GET(request: NextRequest) {
  const err = checkSupabase()
  if (err) return err

  const categoryId = request.nextUrl.searchParams.get('category_id')

  let query = supabase
    .from('clips')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (categoryId) {
    query = query.eq('category_id', categoryId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch clips:', error)
    return errorResponse(`Failed to fetch clips: ${error.message}`)
  }

  return successResponse(data)
}
