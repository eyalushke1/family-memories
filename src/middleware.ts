import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const PROFILE_COOKIE = 'fm-profile-id'
const SIGNATURE_COOKIE = 'fm-profile-sig'
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function hmacSha256(secret: string, data: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
  return bytesToHex(new Uint8Array(signature))
}

async function getVerifiedProfileId(request: NextRequest): Promise<string | null> {
  const profileId = request.cookies.get(PROFILE_COOKIE)?.value
  if (!profileId || !UUID_REGEX.test(profileId)) return null

  const signature = request.cookies.get(SIGNATURE_COOKIE)?.value
  if (signature) {
    const secret = process.env.COOKIE_SECRET || process.env.SUPABASE_KEY || 'dev-fallback-secret'
    const expected = await hmacSha256(secret, profileId)

    // Constant-time comparison
    if (signature.length === expected.length) {
      const a = hexToBytes(signature)
      const b = hexToBytes(expected)
      let mismatch = 0
      for (let i = 0; i < a.length; i++) {
        mismatch |= a[i] ^ b[i]
      }
      if (mismatch === 0) return profileId
    }
  }

  // Backward compatibility: accept unsigned cookie with UUID validation
  return profileId
}

export async function middleware(request: NextRequest) {
  // Protect /admin page routes and /api/admin API routes
  const isAdminPage = request.nextUrl.pathname.startsWith('/admin')
  const isAdminApi = request.nextUrl.pathname.startsWith('/api/admin')

  if (!isAdminPage && !isAdminApi) {
    return NextResponse.next()
  }

  // Check for verified profile cookie
  const profileId = await getVerifiedProfileId(request)

  if (!profileId) {
    if (isAdminApi) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Verify profile is admin
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase not configured')
    if (isAdminApi) {
      return NextResponse.json({ success: false, error: 'Server configuration error' }, { status: 500 })
    }
    return NextResponse.redirect(new URL('/', request.url))
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    db: { schema: 'family_memories' },
  })

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', profileId)
    .single()

  if (error || !profile?.is_admin) {
    if (isAdminApi) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
    }
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}
