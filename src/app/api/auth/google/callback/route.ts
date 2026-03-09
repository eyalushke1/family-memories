import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForTokens, storeTokens } from '@/lib/google/oauth'
import { supabase } from '@/lib/supabase/client'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // Handle errors from Google
  if (error) {
    console.error('Google OAuth error:', error)
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

  // Parse state to get profile ID and CSRF nonce
  let profileId: string
  let stateRandom: string
  try {
    const stateData = JSON.parse(Buffer.from(state, 'base64url').toString())
    profileId = stateData.profileId
    stateRandom = stateData.random
    if (!profileId || !stateRandom) {
      throw new Error('Missing fields in state')
    }
  } catch {
    console.error('Failed to parse OAuth state')
    return NextResponse.redirect(
      new URL('/admin/google-photos?error=invalid_state', request.url)
    )
  }

  // Verify CSRF: compare state nonce against cookie
  const storedNonce = request.cookies.get('oauth-state')?.value
  if (!storedNonce || storedNonce !== stateRandom) {
    console.error('OAuth state CSRF verification failed')
    return NextResponse.redirect(
      new URL('/admin/google-photos?error=invalid_state', request.url)
    )
  }

  // Verify the profile is still an admin (security check)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', profileId)
    .single()

  if (profileError || !profile?.is_admin) {
    console.error('Profile is not admin or does not exist')
    return NextResponse.redirect(
      new URL('/admin/google-photos?error=access_denied', request.url)
    )
  }

  // Exchange code for tokens
  try {
    const tokens = await exchangeCodeForTokens(code)
    await storeTokens(profileId, tokens)
  } catch (err) {
    console.error('Failed to exchange code for tokens:', err)
    return NextResponse.redirect(
      new URL('/admin/google-photos?error=token_exchange_failed', request.url)
    )
  }

  // Clear the oauth-state cookie and redirect
  const response = NextResponse.redirect(
    new URL('/admin/google-photos?connected=true', request.url)
  )
  response.cookies.set('oauth-state', '', { path: '/', maxAge: 0 })
  return response
}
