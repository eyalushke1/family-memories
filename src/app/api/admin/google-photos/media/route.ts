import { NextRequest } from 'next/server'
import { createPhotosClient } from '@/lib/google/photos-client'
import { successResponse, errorResponse } from '@/lib/api/response'

/**
 * GET /api/admin/google-photos/media
 * List all media items from Google Photos (not album-specific)
 * Supports pagination via pageToken query param
 */
export async function GET(request: NextRequest) {
  // Get profile ID from cookie
  const profileId = request.cookies.get('fm-profile-id')?.value

  if (!profileId) {
    return errorResponse('Profile not selected', 401)
  }

  const pageToken = request.nextUrl.searchParams.get('pageToken') || undefined
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '100', 10)

  try {
    const client = createPhotosClient(profileId)

    // Fetch media items (paginated)
    const result = await client.listMediaItems(pageToken)

    // Transform to include display URLs
    const media = result.mediaItems.slice(0, limit).map((item) => ({
      id: item.id,
      filename: item.filename,
      mimeType: item.mimeType,
      baseUrl: item.baseUrl,
      productUrl: item.productUrl,
      description: item.description,
      width: item.mediaMetadata.width,
      height: item.mediaMetadata.height,
      creationTime: item.mediaMetadata.creationTime,
      isVideo: item.mimeType.startsWith('video/'),
      thumbnailUrl: `${item.baseUrl}=w400-h300-c`,
    }))

    return successResponse({
      items: media,
      nextPageToken: result.nextPageToken,
      hasMore: !!result.nextPageToken,
    })
  } catch (err) {
    console.error('Failed to fetch media items:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return errorResponse(`Failed to fetch media: ${message}`)
  }
}
