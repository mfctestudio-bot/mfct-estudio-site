// trigger redeploy
import { NextRequest, NextResponse } from 'next/server'

const PROTECTED = ['/admin']

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PROTECTED.some(p => pathname.startsWith(p))) {
    const cookie = req.cookies.get('admin_auth')?.value
    const adminUser = process.env.ADMIN_USER || 'ronynsc5'
    const adminPass = process.env.ADMIN_PASSWORD || '@Miudinho123'
    const expectedToken = Buffer.from().toString('base64')

    if (cookie === expectedToken) return NextResponse.next()

    const loginUrl = new URL('/admin-login', req.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
