import { NextRequest } from 'next/server'
import { createPhotosClient } from '@/lib/google/photos-client'
import { checkAdmin, getProfileId } from '@/lib/api/admin-check'
import { successResponse, errorResponse } from '@/lib/api/response'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ albumId: string }> }
) {
  const adminErr = await checkAdmin(request)
  if (adminErr) return adminErr

  const profileId = getProfileId(request)!
  const { albumId } = await params

  try {
    const client = createPhotosClient(profileId)
    const mediaItems = await client.getAllAlbumMedia(albumId)

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
    return errorResponse('Failed to fetch media')
  }
}
