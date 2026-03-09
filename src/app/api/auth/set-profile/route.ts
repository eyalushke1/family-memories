import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { checkSupabase } from '@/lib/api/supabase-check'
import { errorResponse } from '@/lib/api/response'
import { signProfileId, isValidUUID, COOKIE_NAME, SIGNATURE_COOKIE } from '@/lib/api/signed-cookie'
import { rateLimit, getRateLimitKey } from '@/lib/api/rate-limit'

/**
 * POST /api/auth/set-profile
 * Sets a signed profile cookie server-side.
 */
export async function POST(request: NextRequest) {
  // Rate limit: 20 profile switches per minute per IP
  const rlErr = rateLimit(getRateLimitKey(request, 'set-profile'), { maxRequests: 20 })
  if (rlErr) return rlErr

  const err = checkSupabase()
  if (err) return err

  const body = await request.json()
  const { profileId } = body

  if (!profileId || !isValidUUID(profileId)) {
    return errorResponse('Valid profile ID is required', 400)
  }

  // Verify the profile exists
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('id', profileId)
    .single()

  if (profileError || !profile) {
    return errorResponse('Profile not found', 404)
  }

  const signature = signProfileId(profileId)
  const maxAge = 60 * 60 * 24 * 365

  const response = NextResponse.json({ success: true, data: { profileId: profile.id, name: profile.name } })
  response.cookies.set(COOKIE_NAME, profileId, {
    path: '/',
    maxAge,
    sameSite: 'lax',
    httpOnly: false, // Client needs to read it for UI state
  })
  response.cookies.set(SIGNATURE_COOKIE, signature, {
    path: '/',
    maxAge,
    sameSite: 'lax',
    httpOnly: true, // Signature stays server-only
  })

  return response
}

/**
 * DELETE /api/auth/set-profile
 * Clears the profile cookies.
 */
export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.set(COOKIE_NAME, '', { path: '/', maxAge: 0 })
  response.cookies.set(SIGNATURE_COOKIE, '', { path: '/', maxAge: 0 })
  return response
}
