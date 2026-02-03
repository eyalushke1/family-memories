import { NextRequest } from 'next/server'
import { createPickerClient } from '@/lib/google/picker-client'
import { checkAdmin, getProfileId } from '@/lib/api/admin-check'
import { successResponse, errorResponse } from '@/lib/api/response'

/**
 * GET /api/admin/google-photos/picker/media?sessionId=xxx
 * List media items selected by user in a session.
 * Only call after session.mediaItemsSet is true.
 */
export async function GET(request: NextRequest) {
  const adminErr = checkAdmin(request)
  if (adminErr) return adminErr

  const profileId = getProfileId(request)!
  const sessionId = request.nextUrl.searchParams.get('sessionId')
  const pageToken = request.nextUrl.searchParams.get('pageToken') || undefined

  if (!sessionId) {
    return errorResponse('sessionId parameter is required', 400)
  }

  try {
    const client = createPickerClient(profileId)
    const response = await client.listMediaItems(sessionId, pageToken)

    // Helper to create proxy URL (Picker API requires auth for media access)
    const proxyUrl = (url: string) =>
      `/api/admin/google-photos/picker/proxy?url=${encodeURIComponent(url)}`

    // Transform items - extract from nested mediaFile structure
    const items = response.mediaItems.map((item) => {
      const baseUrl = item.mediaFile.baseUrl
      const mimeType = item.mediaFile.mimeType
      const isVideo = item.type === 'VIDEO' || mimeType.startsWith('video/')

      // Build URLs with Google's parameters, then wrap in proxy
      const thumbnailGoogleUrl = client.getThumbnailUrl(baseUrl)
      const displayGoogleUrl = client.getDisplayUrl(baseUrl)
      const downloadGoogleUrl = client.getDownloadUrl(baseUrl, mimeType)

      return {
        id: item.id,
        baseUrl,
        mimeType,
        filename: item.mediaFile.filename,
        type: item.type,
        createTime: item.createTime,
        width: item.mediaFile.mediaFileMetadata?.width,
        height: item.mediaFile.mediaFileMetadata?.height,
        thumbnailUrl: proxyUrl(thumbnailGoogleUrl),
        displayUrl: proxyUrl(displayGoogleUrl),
        downloadUrl: proxyUrl(downloadGoogleUrl),
        isVideo,
      }
    })

    return successResponse({
      items,
      nextPageToken: response.nextPageToken,
    })
  } catch (err) {
    console.error('Failed to list picker media:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return errorResponse(`Failed to list media: ${message}`)
  }
}
