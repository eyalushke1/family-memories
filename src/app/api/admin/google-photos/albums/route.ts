import { NextRequest } from 'next/server'
import { createPhotosClient } from '@/lib/google/photos-client'
import { checkAdmin, getProfileId } from '@/lib/api/admin-check'
import { successResponse, errorResponse } from '@/lib/api/response'

export async function GET(request: NextRequest) {
  const adminErr = await checkAdmin(request)
  if (adminErr) return adminErr

  const profileId = getProfileId(request)!

  try {
    const client = createPhotosClient(profileId)
    const albums = await client.getAllAlbums()
    return successResponse(albums)
  } catch (err) {
    console.error('Failed to fetch albums:', err)
    return errorResponse('Failed to fetch albums')
  }
}
