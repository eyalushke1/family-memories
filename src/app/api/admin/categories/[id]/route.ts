import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { checkSupabase } from '@/lib/api/supabase-check'
import { successResponse, errorResponse } from '@/lib/api/response'
import type { UpdateCategory } from '@/types/database'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const err = checkSupabase()
  if (err) return err

  const { id } = await params
  const body: UpdateCategory = await request.json()

  const { data, error } = await supabase
    .from('categories')
    .update(body)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('Failed to update category:', error)
    return errorResponse(`Failed to update category: ${error.message}`)
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

  // Check if category has clips
  const { count } = await supabase
    .from('clips')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', id)

  if (count && count > 0) {
    return errorResponse(
      `Cannot delete category with ${count} clip(s). Move or delete clips first.`,
      400
    )
  }

  const { error } = await supabase.from('categories').delete().eq('id', id)

  if (error) {
    console.error('Failed to delete category:', error)
    return errorResponse(`Failed to delete category: ${error.message}`)
  }

  return successResponse({ deleted: true })
}
