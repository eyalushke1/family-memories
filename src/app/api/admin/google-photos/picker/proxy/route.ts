import { NextRequest } from 'next/server'
import { getValidAccessToken } from '@/lib/google/oauth'
import { checkAdmin, getProfileId } from '@/lib/api/admin-check'
import { errorResponse } from '@/lib/api/response'

/**
 * GET /api/admin/google-photos/picker/proxy?url=xxx
 * Proxy for Google Photos Picker API images.
 * The Picker API requires OAuth token in Authorization header for all media requests.
 */
export async function GET(request: NextRequest) {
  const adminErr = await checkAdmin(request)
  if (adminErr) return adminErr

  const profileId = getProfileId(request)!
  const imageUrl = request.nextUrl.searchParams.get('url')

  if (!imageUrl) {
    return errorResponse('url parameter is required', 400)
  }

  // Validate it's a Google Photos URL
  if (!imageUrl.startsWith('https://lh3.googleusercontent.com/')) {
    return errorResponse('Invalid image URL', 400)
  }

  try {
    const accessToken = await getValidAccessToken(profileId)

    if (!accessToken) {
      return errorResponse('Not authenticated with Google Photos', 401)
    }

    // Fetch the image with OAuth token
    const response = await fetch(imageUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      console.error(`Image proxy error: ${response.status}`)
      return errorResponse(`Failed to fetch image: ${response.status}`, response.status)
    }

    // Get the image data
    const imageBuffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'image/jpeg'

    // Return the image with proper headers
    return new Response(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600', // Cache for 1 hour (URLs expire in 60 min)
      },
    })
  } catch (err) {
    console.error('Image proxy error:', err)
    return errorResponse('Failed to proxy image', 500)
  }
}
