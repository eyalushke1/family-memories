import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForTokens, storeTokens } from '@/lib/google/oauth'
import { GOOGLE_OAUTH_CONFIG } from '@/lib/google/config'
import { supabase } from '@/lib/supabase/client'

export async function GET(request: NextRequest) {
  console.log('[Google OAuth Callback] Received callback')
  console.log('[Google OAuth Callback] Request URL:', request.url)
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
    return NextResponse.redirect(
      new URL('/admin/google-photos?error=access_denied', request.url)
    )
  }

  // Validate code and state
  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/admin/google-photos?error=invalid_request', request.url)
    )
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
    return NextResponse.redirect(
      new URL('/admin/google-photos?error=invalid_state', request.url)
    )
  }

  // Verify the profile exists
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', profileId)
    .single()

  if (profileError || !profile) {
    console.error('Profile does not exist')
    return NextResponse.redirect(
      new URL('/admin/google-photos?error=invalid_profile', request.url)
    )
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
    // Check if it's a redirect_uri_mismatch error
    if (errorMessage.includes('redirect_uri_mismatch')) {
      console.error('[Google OAuth Callback] REDIRECT URI MISMATCH - Check that GOOGLE_REDIRECT_URI env var matches the authorized redirect URI in Google Cloud Console')
      console.error('[Google OAuth Callback] Configured URI:', GOOGLE_OAUTH_CONFIG.redirectUri)
      console.error('[Google OAuth Callback] Callback URL:', request.url)
    }
    return NextResponse.redirect(
      new URL('/admin/google-photos?error=token_exchange_failed', request.url)
    )
  }

  // Redirect back to Google Photos page
  return NextResponse.redirect(
    new URL('/admin/google-photos?connected=true', request.url)
  )
}
