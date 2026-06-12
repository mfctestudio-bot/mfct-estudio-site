import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { usuario, senha } = await req.json()
  const adminUser = process.env.ADMIN_USER || 'ronynsc5'
  const adminPass = process.env.ADMIN_PASSWORD || '@Miudinho123'

  if (usuario !== adminUser || senha !== adminPass) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })

  // Token simples derivado das credenciais (cookie httpOnly)
  const token = Buffer.from(`${adminUser}:${adminPass}`).toString('base64')

  res.cookies.set('admin_auth', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 7, // 7 dias
    path: '/',
  })

  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set('admin_auth', '', { maxAge: 0, path: '/' })
  return res
}
