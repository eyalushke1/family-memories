import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { errorResponse } from './response'

/**
 * Check if a profile is selected (for features that require a profile context).
 * Admin access is controlled by PIN code via AdminAuthGuard, not by profile.
 * This function only checks if a profile is selected for features like Google Photos
 * that need to store data per-profile.
 *
 * Returns an error response if no profile selected, or null if OK.
 * Usage: const err = checkAdmin(request); if (err) return err;
 */
export function checkAdmin(request: NextRequest) {
  const profileId = request.cookies.get('fm-profile-id')?.value

  if (!profileId) {
    return errorResponse('Please select a profile first to use this feature', 401)
  }

  return null
}

/**
 * Get the profile ID from the request, returns null if not set.
 */
export function getProfileId(request: NextRequest): string | null {
  return request.cookies.get('fm-profile-id')?.value ?? null
}

/**
 * Resolve a profile ID from the request cookie, or auto-select the first
 * profile from the database if no cookie is set. Used by admin endpoints
 * that need a profile context (e.g. Google Photos).
 */
export async function resolveProfileId(request: NextRequest): Promise<string | null> {
  const cookieId = request.cookies.get('fm-profile-id')?.value
  if (cookieId) return cookieId

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)

  return profiles && profiles.length > 0 ? profiles[0].id : null
}
