import { NextRequest } from 'next/server'
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
