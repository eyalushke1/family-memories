import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { checkSupabase } from '@/lib/api/supabase-check'
import { successResponse, errorResponse } from '@/lib/api/response'

export async function PATCH(request: NextRequest) {
  const err = checkSupabase()
  if (err) return err

  const { ids } = await request.json()

  if (!Array.isArray(ids) || ids.length === 0) {
    return errorResponse('ids array is required', 400)
  }

  // Update sort_order for each category
  const updates = ids.map((id: string, index: number) =>
    supabase
      .from('categories')
      .update({ sort_order: index + 1 })
      .eq('id', id)
  )

  const results = await Promise.all(updates)

  const errors = results.filter((r) => r.error)
  if (errors.length > 0) {
    console.error('Failed to reorder categories:', errors)
    return errorResponse('Failed to reorder some categories')
  }

  return successResponse({ reordered: ids.length })
}
