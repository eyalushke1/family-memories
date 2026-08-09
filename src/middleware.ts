import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  MEDIA_COOKIE_NAME,
  MEDIA_COOKIE_MAX_AGE,
  issueMediaKey,
  verifyMediaKey,
} from '@/lib/media/access'

/**
 * Issues the short-lived `fm-media-key` cookie on page loads. The media routes
 * require it, which stops anonymous callers from fetching storage paths
 * directly. Browsers send it automatically on <video>/<img> requests, so no
 * client code needs to change.
 *
 * Admin routes remain protected client-side by AdminAuthGuard (PIN).
 */
export async function middleware(request: NextRequest) {
  const existing = request.cookies.get(MEDIA_COOKIE_NAME)?.value

  // Re-issue only when missing or no longer valid, so we aren't signing on
  // every navigation.
  if (await verifyMediaKey(existing)) {
    return NextResponse.next()
  }

  const key = await issueMediaKey()
  const response = NextResponse.next()

  if (key) {
    response.cookies.set(MEDIA_COOKIE_NAME, key, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: MEDIA_COOKIE_MAX_AGE,
    })
  } else {
    console.error(
      '[Media] No MEDIA_TOKEN_SECRET or TOKEN_ENCRYPTION_KEY set — media requests will be rejected'
    )
  }

  return response
}

export const config = {
  // Run on page navigations so the cookie is issued before any media loads.
  // Excludes API routes (they consume the cookie rather than issue it) and
  // static assets.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
