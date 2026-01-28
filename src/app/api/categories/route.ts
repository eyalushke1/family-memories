import { supabase } from '@/lib/supabase/client'
import { checkSupabase } from '@/lib/api/supabase-check'
import { successResponse, errorResponse } from '@/lib/api/response'

export async function GET() {
  const err = checkSupabase()
  if (err) return err

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Failed to fetch categories:', error)
    return errorResponse(`Failed to fetch categories: ${error.message}`)
  }

  return successResponse(data)
}
