import { NextRequest } from 'next/server'
import { createPhotosClient } from '@/lib/google/photos-client'
import { successResponse, errorResponse } from '@/lib/api/response'

export async function GET(request: NextRequest) {
  // Get profile ID from cookie
  const profileId = request.cookies.get('fm-profile-id')?.value

  if (!profileId) {
    return errorResponse('Profile not selected', 401)
  }

  try {
    // Use factory pattern per standards - client handles token management internally
    const client = createPhotosClient(profileId)
    const albums = await client.getAllAlbums()

    console.log('Albums fetched successfully, count:', albums.length)
    if (albums.length > 0) {
      console.log('First album:', albums[0].title)
    }

    return successResponse(albums)
  } catch (err) {
    console.error('Failed to fetch albums:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return errorResponse(`Failed to fetch albums: ${message}`)
  }
}
