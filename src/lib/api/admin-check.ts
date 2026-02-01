import { NextRequest } from 'next/server'
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client'
import { errorResponse } from './response'

/**
 * Verify that the current request is from an admin user.
 * Returns an error response if not admin, or null if OK.
 * Usage: const err = await checkAdmin(request); if (err) return err;
 */
export async function checkAdmin(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return errorResponse('Database not configured', 500)
  }

  const profileId = request.cookies.get('fm-profile-id')?.value

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
 * Get the profile ID from the request, returns null if not set.
 */
export function getProfileId(request: NextRequest): string | null {
  return request.cookies.get('fm-profile-id')?.value ?? null
}
