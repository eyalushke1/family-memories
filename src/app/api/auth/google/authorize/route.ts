import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { supabase } from '@/lib/supabase/client'
import { validateGoogleConfig, GOOGLE_OAUTH_CONFIG } from '@/lib/google/config'
import { getAuthorizationUrl } from '@/lib/google/oauth'
import { getProfileId } from '@/lib/api/admin-check'

export async function GET(request: NextRequest) {
  let profileId = getProfileId(request)

  // If no profile cookie, auto-select the first profile
  if (!profileId) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)

    if (profiles && profiles.length > 0) {
      profileId = profiles[0].id
    } else {
      // No profiles exist at all — redirect back with error
      const baseUrl = request.nextUrl.origin
      return NextResponse.redirect(`${baseUrl}/admin/google-photos?error=no_profiles`)
    }
  }

  // Validate Google config with detailed logging
  const validation = validateGoogleConfig()
  if (!validation.valid) {
    console.error('[Google OAuth] Configuration validation failed:', validation.error)
    console.error('[Google OAuth] Config check - CLIENT_ID set:', !!GOOGLE_OAUTH_CONFIG.clientId)
    console.error('[Google OAuth] Config check - CLIENT_SECRET set:', !!GOOGLE_OAUTH_CONFIG.clientSecret)
    console.error('[Google OAuth] Config check - REDIRECT_URI:', GOOGLE_OAUTH_CONFIG.redirectUri || '(not set)')
    const baseUrl = request.nextUrl.origin
    return NextResponse.redirect(`${baseUrl}/admin/google-photos?error=invalid_request`)
  }

  // Log redirect URI for debugging (without exposing secrets)
  console.log('[Google OAuth] Starting authorization flow')
  console.log('[Google OAuth] Redirect URI:', GOOGLE_OAUTH_CONFIG.redirectUri)

  // Generate state token (profile ID + random bytes for CSRF protection)
  const randomState = randomBytes(16).toString('hex')
  const state = Buffer.from(JSON.stringify({ profileId, random: randomState })).toString('base64url')

  // Get authorization URL
  const authUrl = getAuthorizationUrl(state)

  // Redirect to Google
  return NextResponse.redirect(authUrl)
}
