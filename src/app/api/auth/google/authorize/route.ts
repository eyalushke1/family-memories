import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { validateGoogleConfig } from '@/lib/google/config'
import { getAuthorizationUrl } from '@/lib/google/oauth'
import { checkAdmin, getProfileId } from '@/lib/api/admin-check'

export async function GET(request: NextRequest) {
  // Verify admin access
  const adminErr = await checkAdmin(request)
  if (adminErr) return adminErr

  // Validate Google config
  const validation = validateGoogleConfig()
  if (!validation.valid) {
    return NextResponse.json(
      { success: false, error: validation.error },
      { status: 500 }
    )
  }

  // Get profile ID (already verified as admin)
  const profileId = getProfileId(request)!

  // Generate state token (profile ID + random bytes for CSRF protection)
  const randomState = randomBytes(16).toString('hex')
  const state = Buffer.from(JSON.stringify({ profileId, random: randomState })).toString('base64url')

  // Get authorization URL
  const authUrl = getAuthorizationUrl(state)

  // Redirect to Google
  return NextResponse.redirect(authUrl)
}
