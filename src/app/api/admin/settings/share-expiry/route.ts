import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { checkSupabase } from '@/lib/api/supabase-check'
import { successResponse, errorResponse } from '@/lib/api/response'

const SETTING_KEY = 'share_default_expiry_days'
const DEFAULT_VALUE = '30'

/** GET — Read the current share expiry setting */
export async function GET() {
  const err = checkSupabase()
  if (err) return err

  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', SETTING_KEY)
    .single()

  return successResponse({ value: data?.value || DEFAULT_VALUE })
}

/** PUT — Update the share expiry setting */
export async function PUT(request: NextRequest) {
  const err = checkSupabase()
  if (err) return err

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return errorResponse('Invalid JSON', 400)
  }

  const value = String(body.value || '')
  const numValue = parseInt(value, 10)

  if (isNaN(numValue) || numValue < 0) {
    return errorResponse('Value must be a non-negative number', 400)
  }

  const { error } = await supabase
    .from('settings')
    .upsert({
      key: SETTING_KEY,
      value: String(numValue),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' })

  if (error) {
    console.error('[Settings] Failed to update share expiry:', error)
    return errorResponse(`Failed to save setting: ${error.message}`)
  }

  return successResponse({ value: String(numValue) })
}
