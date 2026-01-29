import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { checkSupabase } from '@/lib/api/supabase-check'
import { successResponse, errorResponse } from '@/lib/api/response'

export async function PATCH(request: NextRequest) {
  const err = checkSupabase()
  if (err) return err

  const { category_id, ids } = await request.json()

  if (!category_id) {
    return errorResponse('category_id is required', 400)
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    return errorResponse('ids array is required', 400)
  }

  // Update sort_order for each clip
  const updates = ids.map((id: string, index: number) =>
    supabase
      .from('clips')
      .update({ sort_order: index + 1, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('category_id', category_id)
  )

  const results = await Promise.all(updates)

  const errors = results.filter((r) => r.error)
  if (errors.length > 0) {
    console.error('Failed to reorder clips:', errors)
    return errorResponse('Failed to reorder some clips')
  }

  return successResponse({ reordered: ids.length })
}
