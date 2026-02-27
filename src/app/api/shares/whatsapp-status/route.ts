import { successResponse, errorResponse } from '@/lib/api/response'

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'http://localhost:3001'
const WHATSAPP_API_KEY = process.env.WHATSAPP_API_KEY || ''

/** GET — Check WhatsApp bridge connection status */
export async function GET() {
  try {
    const headers: Record<string, string> = {}
    if (WHATSAPP_API_KEY) {
      headers['Authorization'] = `Bearer ${WHATSAPP_API_KEY}`
    }

    const res = await fetch(`${WHATSAPP_API_URL}/api/status`, {
      headers,
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) {
      return successResponse({ status: 'disconnected', message: 'Bridge returned an error' })
    }

    const data = await res.json()
    return successResponse({
      status: 'connected',
      details: data,
    })
  } catch {
    return successResponse({
      status: 'unavailable',
      message: 'WhatsApp bridge is not running. Start it with: npm run whatsapp',
    })
  }
}
