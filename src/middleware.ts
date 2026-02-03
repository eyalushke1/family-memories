import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Admin routes are protected client-side by AdminAuthGuard (PIN code)
  // No server-side profile check needed - anyone with the PIN can access admin
  return NextResponse.next()
}

export const config = {
  // Matcher for routes that need middleware processing
  // Currently all admin auth is handled client-side via PIN
  matcher: '/admin/:path*',
}
