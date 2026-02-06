import { NextRequest } from 'next/server'
import { deleteTokens } from '@/lib/google/oauth'
import { resolveProfileId } from '@/lib/api/admin-check'
import { successResponse, errorResponse } from '@/lib/api/response'

export async function POST(request: NextRequest) {
  const profileId = await resolveProfileId(request)
  if (!profileId) return errorResponse('No profiles found', 400)

  try {
    await deleteTokens(profileId)
    return successResponse({ disconnected: true })
  } catch (err) {
    console.error('Failed to disconnect Google Photos:', err)
    return errorResponse('Failed to disconnect Google Photos')
  }
}
