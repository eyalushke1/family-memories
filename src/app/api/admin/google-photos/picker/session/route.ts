import { NextRequest } from 'next/server'
import { createPickerClient } from '@/lib/google/picker-client'
import { checkAdmin, getProfileId } from '@/lib/api/admin-check'
import { successResponse, errorResponse } from '@/lib/api/response'

/**
 * POST /api/admin/google-photos/picker/session
 * Create a new picker session. Returns pickerUri for user to select photos.
 */
export async function POST(request: NextRequest) {
  const adminErr = checkAdmin(request)
  if (adminErr) return adminErr

  const profileId = getProfileId(request)!

  try {
    const client = createPickerClient(profileId)
    const session = await client.createSession()

    return successResponse({
      sessionId: session.id,
      // Append /autoclose so window closes after selection
      pickerUri: session.pickerUri + '/autoclose',
      expireTime: session.expireTime,
      pollingConfig: session.pollingConfig,
    })
  } catch (err) {
    console.error('Failed to create picker session:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return errorResponse(`Failed to create session: ${message}`)
  }
}
