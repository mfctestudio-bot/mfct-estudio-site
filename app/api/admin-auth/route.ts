import { NextRequest, NextResponse } from 'next/server'
import { credenciaisAdmin, tokenAdmin } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  const { usuario, senha } = await req.json()
  const cred = credenciaisAdmin()

  if (!cred || usuario !== cred.usuario || senha !== cred.senha) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })

  // Token simples derivado das credenciais (cookie httpOnly)
  const token = tokenAdmin(cred.usuario, cred.senha)

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
