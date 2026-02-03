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
    const tokens = await exchangeCodeForTokens(code)
    await storeTokens(profileId, tokens)
  } catch (err) {
    console.error('Failed to exchange code for tokens:', err)
    return NextResponse.redirect(
      new URL('/admin/google-photos?error=token_exchange_failed', request.url)
    )
  }

  // Redirect back to Google Photos page
  return NextResponse.redirect(
    new URL('/admin/google-photos?connected=true', request.url)
  )
}
