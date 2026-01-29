import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { checkSupabase } from '@/lib/api/supabase-check'
import { successResponse, errorResponse } from '@/lib/api/response'
import type { InsertCategory } from '@/types/database'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function GET() {
  const err = checkSupabase()
  if (err) return err

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Failed to fetch categories:', error)
    return errorResponse(`Failed to fetch categories: ${error.message}`)
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

  const slug = body.slug?.trim() || slugify(name)

  // Get max sort_order
  const { data: maxOrder } = await supabase
    .from('categories')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()

  const sort_order = (maxOrder?.sort_order ?? 0) + 1

  const insertData: InsertCategory = {
    name,
    slug,
    sort_order,
    is_active: body.is_active ?? true,
  }

  const { data, error } = await supabase
    .from('categories')
    .insert(insertData)
    .select('*')
    .single()

  if (error) {
    console.error('Failed to create category:', error)
    return errorResponse(`Failed to create category: ${error.message}`)
  }

  return successResponse(data, 201)
}
