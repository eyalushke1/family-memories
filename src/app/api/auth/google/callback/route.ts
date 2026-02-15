import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForTokens, storeTokens } from '@/lib/google/oauth'
import { GOOGLE_OAUTH_CONFIG } from '@/lib/google/config'
import { supabase } from '@/lib/supabase/client'

/**
 * Get the public base URL. On Cloud Run, request.url resolves to the
 * internal container address (0.0.0.0:3000). We derive the public URL
 * from NEXT_PUBLIC_APP_URL or the GOOGLE_REDIRECT_URI instead.
 */
function getBaseUrl(request: NextRequest): string {
  // Prefer NEXT_PUBLIC_APP_URL
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  }
  // Fall back to deriving from GOOGLE_REDIRECT_URI
  if (GOOGLE_OAUTH_CONFIG.redirectUri) {
    const url = new URL(GOOGLE_OAUTH_CONFIG.redirectUri)
    return url.origin
  }
  // Use forwarded host header (Cloud Run sets this)
  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https'
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`
  }
  // Last resort: use request URL (works on localhost)
  return request.nextUrl.origin
}

export async function GET(request: NextRequest) {
  const baseUrl = getBaseUrl(request)

  console.log('[Google OAuth Callback] Received callback')
  console.log('[Google OAuth Callback] Request URL:', request.url)
  console.log('[Google OAuth Callback] Base URL for redirects:', baseUrl)
  console.log('[Google OAuth Callback] Configured redirect URI:', GOOGLE_OAUTH_CONFIG.redirectUri)

  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // Handle errors from Google
  if (error) {
    console.error('[Google OAuth Callback] Error from Google:', error)
    console.error('[Google OAuth Callback] Error description:', errorDescription)
    return NextResponse.redirect(`${baseUrl}/admin/google-photos?error=access_denied`)
  }

  // Validate code and state
  if (!code || !state) {
    return NextResponse.redirect(`${baseUrl}/admin/google-photos?error=invalid_request`)
  }

  // Parse state to get profile ID
  let profileId: string
  try {
    const stateData = JSON.parse(Buffer.from(state, 'base64url').toString())
    profileId = stateData.profileId
    if (!profileId) {
      throw new Error('Missing profile ID in state')
    }
  } catch {
    console.error('Failed to parse OAuth state')
    return NextResponse.redirect(`${baseUrl}/admin/google-photos?error=invalid_state`)
  }

  // Verify the profile exists
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', profileId)
    .single()

  if (profileError || !profile) {
    console.error('Profile does not exist')
    return NextResponse.redirect(`${baseUrl}/admin/google-photos?error=invalid_profile`)
  }

  // Exchange code for tokens
  try {
    console.log('[Google OAuth Callback] Exchanging code for tokens...')
    const tokens = await exchangeCodeForTokens(code)
    console.log('[Google OAuth Callback] Token exchange successful, storing tokens...')
    await storeTokens(profileId, tokens)
    console.log('[Google OAuth Callback] Tokens stored successfully')
  } catch (err) {
    console.error('[Google OAuth Callback] Failed to exchange code for tokens:', err)
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Google OAuth Callback] Error details:', errorMessage)
    if (errorMessage.includes('redirect_uri_mismatch')) {
      console.error('[Google OAuth Callback] REDIRECT URI MISMATCH - Check GOOGLE_REDIRECT_URI env var')
      console.error('[Google OAuth Callback] Configured URI:', GOOGLE_OAUTH_CONFIG.redirectUri)
    }
    return NextResponse.redirect(`${baseUrl}/admin/google-photos?error=token_exchange_failed`)
  }

  // Redirect back to Google Photos page
  return NextResponse.redirect(`${baseUrl}/admin/google-photos?connected=true`)
}
