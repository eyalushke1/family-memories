import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const PROFILE_COOKIE = 'fm-profile-id'

export async function middleware(request: NextRequest) {
  // Only protect /admin routes
  if (!request.nextUrl.pathname.startsWith('/admin')) {
    return NextResponse.next()
  }

  // Check for profile cookie
  const profileId = request.cookies.get(PROFILE_COOKIE)?.value

  if (!profileId) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Verify profile is admin
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase not configured')
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
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/admin/:path*',
}
