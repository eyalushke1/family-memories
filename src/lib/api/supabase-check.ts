import { isSupabaseConfigured } from '@/lib/supabase/client'
import { errorResponse } from './response'

/**
 * Returns an error response if Supabase is not configured, or null if OK.
 * Usage: const err = checkSupabase(); if (err) return err;
 */
export function checkSupabase() {
  if (!isSupabaseConfigured) {
    return errorResponse('Database not configured. Please check environment variables.', 500)
  }
  return null
}
