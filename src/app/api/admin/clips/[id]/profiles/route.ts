import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { checkSupabase } from '@/lib/api/supabase-check'
import { successResponse, errorResponse } from '@/lib/api/response'

// GET - Get profile IDs associated with a clip
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const err = checkSupabase()
  if (err) return err

  const { id } = await params

  const { data, error } = await supabase
    .from('clip_profiles')
    .select('profile_id')
    .eq('clip_id', id)

  if (error) {
    console.error('Failed to fetch clip profiles:', error)
    return errorResponse(`Failed to fetch clip profiles: ${error.message}`)
  }

  const profileIds = data.map((row) => row.profile_id)
  return successResponse(profileIds)
}

// PUT - Replace all profile associations for a clip
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const err = checkSupabase()
  if (err) return err

  const { id } = await params
  const body = await request.json()
  const profileIds: string[] = body.profile_ids ?? []

  // Delete existing associations
  const { error: deleteError } = await supabase
    .from('clip_profiles')
    .delete()
    .eq('clip_id', id)

  if (deleteError) {
    console.error('Failed to delete clip profiles:', deleteError)
    return errorResponse(`Failed to update clip profiles: ${deleteError.message}`)
  }

  // Insert new associations
  if (profileIds.length > 0) {
    const insertData = profileIds.map((profileId) => ({
      clip_id: id,
      profile_id: profileId,
    }))

    const { error: insertError } = await supabase
      .from('clip_profiles')
      .insert(insertData)

    if (insertError) {
      console.error('Failed to insert clip profiles:', insertError)
      return errorResponse(`Failed to update clip profiles: ${insertError.message}`)
    }
  }

  return successResponse({ clip_id: id, profile_ids: profileIds })
}
