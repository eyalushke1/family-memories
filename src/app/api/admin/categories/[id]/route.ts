import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { checkSupabase } from '@/lib/api/supabase-check'
import { successResponse, errorResponse } from '@/lib/api/response'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const err = checkSupabase()
  if (err) return err

  const { id } = await params
  const body = await request.json()

  // Whitelist allowed fields
  const updateData: Record<string, unknown> = {}
  if (body.name !== undefined) updateData.name = body.name
  if (body.slug !== undefined) updateData.slug = body.slug
  if (body.is_active !== undefined) updateData.is_active = body.is_active
  if (body.sort_order !== undefined) updateData.sort_order = body.sort_order

  if (Object.keys(updateData).length === 0) {
    return errorResponse('No valid fields to update', 400)
  }

  const { data, error } = await supabase
    .from('categories')
    .update(updateData)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('Failed to update category:', error)
    return errorResponse('Failed to update category')
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
    return errorResponse('Failed to delete category')
  }

  return successResponse({ deleted: true })
}
