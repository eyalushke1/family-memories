import { NextRequest } from 'next/server'
import { deleteTokens } from '@/lib/google/oauth'
import { getProfileId } from '@/lib/api/admin-check'
import { supabase } from '@/lib/supabase/client'
import { successResponse, errorResponse } from '@/lib/api/response'

export async function POST(request: NextRequest) {
  let profileId = getProfileId(request)

  // If no profile cookie, auto-select the first profile
  if (!profileId) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)

    if (profiles && profiles.length > 0) {
      profileId = profiles[0].id
    } else {
      return errorResponse('No profiles found', 400)
    }
  }

  try {
    await deleteTokens(profileId!)
    return successResponse({ disconnected: true })
  } catch (err) {
    console.error('Failed to disconnect Google Photos:', err)
    return errorResponse('Failed to disconnect Google Photos')
  }
}
