import { NextRequest } from 'next/server'
import { successResponse, errorResponse } from '@/lib/api/response'

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'http://localhost:3001'
const WHATSAPP_API_KEY = process.env.WHATSAPP_API_KEY || ''

/** POST — Send a WhatsApp message with clip link */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return errorResponse('Invalid JSON', 400)
  }

  const { phoneNumber, shareUrl, clipTitle } = body as {
    phoneNumber?: string
    shareUrl?: string
    clipTitle?: string
  }

  if (!phoneNumber || !shareUrl) {
    return errorResponse('phoneNumber and shareUrl are required', 400)
  }

  // Normalize phone number: strip spaces, dashes, parentheses
  let normalized = String(phoneNumber).replace(/[\s\-()]/g, '')

  // Ensure it starts with + for international format
  if (!normalized.startsWith('+')) {
    // If it starts with 0 (local Israeli format), convert to +972
    if (normalized.startsWith('0')) {
      normalized = '+972' + normalized.slice(1)
    } else {
      // Assume it already has country code digits
      normalized = '+' + normalized
    }
  }

  // Basic validation: must be + followed by 7-15 digits
  if (!/^\+\d{7,15}$/.test(normalized)) {
    return errorResponse('Invalid phone number format', 400)
  }

  // wweb-mcp expects digits only (no + prefix)
  const digitsOnly = normalized.replace(/^\+/, '')

  const message = clipTitle
    ? `${clipTitle}\n\nWatch here: ${shareUrl}`
    : `Watch this clip: ${shareUrl}`

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (WHATSAPP_API_KEY) {
      headers['Authorization'] = `Bearer ${WHATSAPP_API_KEY}`
    }

    console.log(`[WhatsApp] Sending to: input="${phoneNumber}" → normalized="${normalized}" → digits="${digitsOnly}"`)

    const res = await fetch(`${WHATSAPP_API_URL}/api/send`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        number: digitsOnly,
        message,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[WhatsApp] Send failed:', res.status, text)
      return errorResponse('Failed to send WhatsApp message', 502)
    }

    const result = await res.json()
    console.log(`[WhatsApp] Sent successfully:`, result)

    return successResponse({ sent: true, to: normalized })
  } catch (err) {
    console.error('[WhatsApp] Connection error:', err)
    return errorResponse(
      'WhatsApp service is not available. Make sure the WhatsApp bridge is running (npm run whatsapp).',
      503
    )
  }
}
