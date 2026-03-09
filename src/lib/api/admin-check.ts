import { NextRequest } from 'next/server'
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client'
import { errorResponse } from './response'
import { verifyProfileCookie, isValidUUID } from './signed-cookie'

/**
 * Verify that the current request is from an admin user.
 * Returns an error response if not admin, or null if OK.
 * Usage: const err = await checkAdmin(request); if (err) return err;
 */
export async function checkAdmin(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return errorResponse('Database not configured', 500)
  }

  const profileId = getProfileId(request)

  if (!profileId) {
    return errorResponse('Profile not selected', 401)
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', profileId)
    .single()

  if (error || !profile?.is_admin) {
    return errorResponse('Admin access required', 403)
  }

  return null
}

/**
 * Get the verified profile ID from the request.
 * Checks signature if present, falls back to UUID validation.
 * Returns null if not set or invalid.
 */
export function getProfileId(request: NextRequest): string | null {
  // First try signed cookie verification
  const signedId = verifyProfileCookie(request.cookies)
  if (signedId) return signedId

  // Fall back to unsigned cookie with UUID validation only
  // (for backward compatibility during migration)
  const rawId = request.cookies.get('fm-profile-id')?.value
  if (rawId && isValidUUID(rawId)) return rawId

  return null
}
