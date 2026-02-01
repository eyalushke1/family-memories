import { NextRequest } from 'next/server'
import { getValidAccessToken } from '@/lib/google/oauth'
import { successResponse, errorResponse } from '@/lib/api/response'

/**
 * GET /api/admin/google-photos/debug
 * Debug endpoint to check token validity and actual scopes from Google
 */
export async function GET(request: NextRequest) {
  const profileId = request.cookies.get('fm-profile-id')?.value

  if (!profileId) {
    return errorResponse('Profile not selected', 401)
  }

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

    console.log('[Debug] Token info from Google:', JSON.stringify(tokenInfo, null, 2))

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

    console.log('[Debug] Photos API response status:', photosApiStatus)
    console.log('[Debug] Photos API response body:', photosApiBody)

    let photosApiResult
    try {
      photosApiResult = JSON.parse(photosApiBody)
    } catch {
      photosApiResult = photosApiBody
    }

    return successResponse({
      tokenValid: tokenInfoRes.ok,
      tokenInfo,
      tokenPreview: `${accessToken.substring(0, 20)}...`,
      photosApi: {
        status: photosApiStatus,
        response: photosApiResult,
      },
    })
  } catch (err) {
    console.error('Debug endpoint error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return errorResponse(`Debug failed: ${message}`)
  }
}
