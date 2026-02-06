import { NextRequest } from 'next/server'
import { isGooglePhotosConnected } from '@/lib/google/oauth'
import { getProfileId } from '@/lib/api/admin-check'
import { supabase } from '@/lib/supabase/client'
import { successResponse, errorResponse } from '@/lib/api/response'

export async function GET(request: NextRequest) {
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
      return successResponse({ connected: false })
    }
  }

  try {
    const connected = await isGooglePhotosConnected(profileId!)
    return successResponse({ connected })
  } catch (err) {
    console.error('Failed to check Google Photos status:', err)
    return errorResponse('Failed to check connection status')
  }
}
