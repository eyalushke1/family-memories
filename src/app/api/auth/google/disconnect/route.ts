import { NextRequest } from 'next/server'
import { deleteTokens } from '@/lib/google/oauth'
import { checkAdmin, getProfileId } from '@/lib/api/admin-check'
import { successResponse, errorResponse } from '@/lib/api/response'

export async function POST(request: NextRequest) {
  // Verify admin access
  const adminErr = await checkAdmin(request)
  if (adminErr) return adminErr

  // Get profile ID (already verified as admin)
  const profileId = getProfileId(request)!

  try {
    await deleteTokens(profileId)
    return successResponse({ disconnected: true })
  } catch (err) {
    console.error('Failed to disconnect Google Photos:', err)
    return errorResponse('Failed to disconnect Google Photos')
  }
}
