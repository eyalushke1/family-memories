import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { checkSupabase } from '@/lib/api/supabase-check'
import { successResponse, errorResponse } from '@/lib/api/response'

const SETTING_KEY = 'supabase_access_token'

/** GET — Check if a Supabase access token is configured (does not return the token itself) */
export async function GET() {
  const err = checkSupabase()
  if (err) return err

  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', SETTING_KEY)
    .single()

  return successResponse({ configured: !!data?.value })
}

/** PUT — Save or update the Supabase access token */
export async function PUT(request: NextRequest) {
  const err = checkSupabase()
  if (err) return err

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return errorResponse('Invalid JSON', 400)
  }

  const token = String(body.token || '').trim()

  if (!token) {
    return errorResponse('Token is required', 400)
  }

  const { error } = await supabase
    .from('settings')
    .upsert({
      key: SETTING_KEY,
      value: token,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' })

  if (error) {
    console.error('[Settings] Failed to save Supabase access token:', error)
    return errorResponse(`Failed to save token: ${error.message}`)
  }

  return successResponse({ configured: true })
}

/** DELETE — Remove the Supabase access token */
export async function DELETE() {
  const err = checkSupabase()
  if (err) return err

  const { error } = await supabase
    .from('settings')
    .delete()
    .eq('key', SETTING_KEY)

  if (error) {
    return errorResponse(`Failed to remove token: ${error.message}`)
  }

  return successResponse({ configured: false })
}
