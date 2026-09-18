import { NextRequest, NextResponse } from 'next/server'
import { isAdminSession } from '@/lib/api-auth'

const PROTECTED = ['/admin']

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PROTECTED.some(p => pathname.startsWith(p))) {
    if (isAdminSession(req)) return NextResponse.next()

    const loginUrl = new URL('/admin-login', req.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
