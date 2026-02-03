import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { checkSupabase } from '@/lib/api/supabase-check'
import { successResponse, errorResponse } from '@/lib/api/response'

const DEFAULT_PIN = '2312'

async function getStoredPin(): Promise<string> {
  if (!supabase) return DEFAULT_PIN

  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'admin_pin')
    .single()

  return data?.value || DEFAULT_PIN
}

// Verify PIN
export async function POST(request: NextRequest) {
  const err = checkSupabase()
  if (err) return err

  const body = await request.json()
  const { pin } = body

  if (!pin) {
    return errorResponse('PIN is required', 400)
  }

  const storedPin = await getStoredPin()
  const isValid = pin === storedPin

  return successResponse({ valid: isValid })
}

// Update PIN
export async function PUT(request: NextRequest) {
  const err = checkSupabase()
  if (err) return err

  const body = await request.json()
  const { currentPin, newPin } = body

  if (!currentPin || !newPin) {
    return errorResponse('Current PIN and new PIN are required', 400)
  }

  if (newPin.length < 4 || newPin.length > 8) {
    return errorResponse('PIN must be 4-8 digits', 400)
  }

  if (!/^\d+$/.test(newPin)) {
    return errorResponse('PIN must contain only numbers', 400)
  }

  const storedPin = await getStoredPin()

  if (currentPin !== storedPin) {
    return errorResponse('Current PIN is incorrect', 403)
  }

  // Upsert the PIN setting
  const { error } = await supabase
    .from('settings')
    .upsert(
      { key: 'admin_pin', value: newPin, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )

  if (error) {
    console.error('Failed to update PIN:', error)
    return errorResponse('Failed to update PIN', 500)
  }

  return successResponse({ updated: true })
}

// Get PIN status (not the actual PIN, just if custom PIN is set)
export async function GET() {
  const err = checkSupabase()
  if (err) return err

  const storedPin = await getStoredPin()
  const isCustom = storedPin !== DEFAULT_PIN

  return successResponse({ isCustomPin: isCustom })
}
