import { NextRequest } from 'next/server'
import { getValidAccessToken } from '@/lib/google/oauth'
import { resolveProfileId } from '@/lib/api/admin-check'
import { successResponse, errorResponse } from '@/lib/api/response'

export async function GET(request: NextRequest) {
  const profileId = await resolveProfileId(request)
  if (!profileId) return successResponse({ connected: false })

  try {
    // Actually validate the token (refreshes if expired, auto-deletes if revoked)
    const token = await getValidAccessToken(profileId)
    return successResponse({ connected: !!token })
  } catch (err) {
    console.error('Failed to check Google Photos status:', err)
    return errorResponse('Failed to check connection status')
  }
}
