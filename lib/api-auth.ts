import { NextRequest, NextResponse } from 'next/server'

function expectedToken() {
  const adminUser = process.env.ADMIN_USER || 'ronynsc5'
  const adminPass = process.env.ADMIN_PASSWORD || '@Miudinho123'
  return Buffer.from(`${adminUser}:${adminPass}`).toString('base64')
}

export function isAdminSession(req: NextRequest) {
  return req.cookies.get('admin_auth')?.value === expectedToken()
}

export function requireAdmin(req: NextRequest): NextResponse | null {
  if (isAdminSession(req)) return null
  return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
}