import { NextRequest } from 'next/server'
import { getValidAccessToken } from '@/lib/google/oauth'
import { checkAdmin } from '@/lib/api/admin-check'
import { successResponse, errorResponse } from '@/lib/api/response'
import { getProfileId } from '@/lib/api/admin-check'

/**
 * GET /api/admin/google-photos/debug
 * Debug endpoint to check token validity and scopes (admin only).
 * Only enabled when NODE_ENV !== 'production'.
 */
export async function GET(request: NextRequest) {
  // Only allow in non-production environments
  if (process.env.NODE_ENV === 'production') {
    return errorResponse('Debug endpoint not available in production', 404)
  }

  const adminErr = await checkAdmin(request)
  if (adminErr) return adminErr

  const profileId = getProfileId(request)!

  try {
    const accessToken = await getValidAccessToken(profileId)

    if (!accessToken) {
      return errorResponse('No valid access token')
    }

    // Call Google's tokeninfo endpoint to see what scopes the token actually has
    const tokenInfoRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}`
    )

    const tokenInfo = await tokenInfoRes.json()

    // Also try a direct call to Photos API
    const photosApiRes = await fetch(
      'https://photoslibrary.googleapis.com/v1/albums?pageSize=1',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    const photosApiStatus = photosApiRes.status
    const photosApiBody = await photosApiRes.text()

    let photosApiResult
    try {
      photosApiResult = JSON.parse(photosApiBody)
    } catch {
      photosApiResult = photosApiBody
    }

    // Return diagnostic info without token preview
    return successResponse({
      tokenValid: tokenInfoRes.ok,
      scopes: tokenInfo.scope?.split(' ') ?? [],
      expiresIn: tokenInfo.expires_in,
      photosApi: {
        status: photosApiStatus,
        accessible: photosApiStatus === 200,
      },
    })
  } catch (err) {
    console.error('Debug endpoint error:', err)
    return errorResponse('Debug check failed')
  }
}
