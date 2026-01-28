import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { checkSupabase } from '@/lib/api/supabase-check'
import { successResponse, errorResponse } from '@/lib/api/response'
import type { InsertProfile } from '@/types/database'

export async function GET() {
  const err = checkSupabase()
  if (err) return err

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, avatar_path, is_admin, created_at, updated_at')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed to fetch profiles:', error)
    return errorResponse(`Failed to fetch profiles: ${error.message}`)
  }

  return successResponse(data)
}

export async function POST(request: NextRequest) {
  const err = checkSupabase()
  if (err) return err

  const body: InsertProfile = await request.json()

  if (!body.name?.trim()) {
    return errorResponse('Name is required', 400)
  }

  const { data, error } = await supabase
    .from('profiles')
    .insert({ name: body.name.trim(), avatar_path: body.avatar_path, is_admin: body.is_admin })
    .select('id, name, avatar_path, is_admin, created_at, updated_at')
    .single()

  if (error) {
    console.error('Failed to create profile:', error)
    return errorResponse(`Failed to create profile: ${error.message}`)
  }

  return successResponse(data, 201)
}
