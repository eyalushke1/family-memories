import { NextRequest } from 'next/server'
import { isGooglePhotosConnected } from '@/lib/google/oauth'
import { checkAdmin, getProfileId } from '@/lib/api/admin-check'
import { successResponse, errorResponse } from '@/lib/api/response'

export async function GET(request: NextRequest) {
  // Verify admin access
  const adminErr = checkAdmin(request)
  if (adminErr) return adminErr

  // Get profile ID (already verified as admin)
  const profileId = getProfileId(request)!

  try {
    const connected = await isGooglePhotosConnected(profileId)
    return successResponse({ connected })
  } catch (err) {
    console.error('Failed to check Google Photos status:', err)
    return errorResponse('Failed to check connection status')
  }
}
