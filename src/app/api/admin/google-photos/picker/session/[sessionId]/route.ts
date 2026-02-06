import { NextRequest } from 'next/server'
import { createPickerClient } from '@/lib/google/picker-client'
import { resolveProfileId } from '@/lib/api/admin-check'
import { successResponse, errorResponse } from '@/lib/api/response'

interface RouteParams {
  params: Promise<{ sessionId: string }>
}

/**
 * GET /api/admin/google-photos/picker/session/[sessionId]
 * Get session status. Poll until mediaItemsSet is true.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const profileId = await resolveProfileId(request)
  if (!profileId) return errorResponse('No profiles found', 400)
  const { sessionId } = await params

  try {
    const client = createPickerClient(profileId)
    const session = await client.getSession(sessionId)

    return successResponse({
      sessionId: session.id,
      mediaItemsSet: session.mediaItemsSet,
      expireTime: session.expireTime,
      pollingConfig: session.pollingConfig,
    })
  } catch (err) {
    console.error('Failed to get session:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return errorResponse(`Failed to get session: ${message}`)
  }
}

/**
 * DELETE /api/admin/google-photos/picker/session/[sessionId]
 * Delete/cleanup a session after use.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const profileId = await resolveProfileId(request)
  if (!profileId) return errorResponse('No profiles found', 400)
  const { sessionId } = await params

  try {
    const client = createPickerClient(profileId)
    await client.deleteSession(sessionId)

    return successResponse({ deleted: true })
  } catch (err) {
    console.error('Failed to delete session:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return errorResponse(`Failed to delete session: ${message}`)
  }
}
