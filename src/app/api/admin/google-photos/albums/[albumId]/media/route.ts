import { NextRequest } from 'next/server'
import { createPhotosClient } from '@/lib/google/photos-client'
import { successResponse, errorResponse } from '@/lib/api/response'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ albumId: string }> }
) {
  // Get profile ID from cookie
  const profileId = request.cookies.get('fm-profile-id')?.value

  if (!profileId) {
    return errorResponse('Profile not selected', 401)
  }

  const { albumId } = await params

  try {
    // Use factory pattern per standards - client handles token management internally
    const client = createPhotosClient(profileId)
    const mediaItems = await client.getAllAlbumMedia(albumId)

    // Transform to include download URLs
    // Per standards: baseUrl expires after ~60 minutes, but thumbnails are fine for display
    const media = mediaItems.map((item) => ({
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

    return successResponse(media)
  } catch (err) {
    console.error('Failed to fetch album media:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return errorResponse(`Failed to fetch media: ${message}`)
  }
}
