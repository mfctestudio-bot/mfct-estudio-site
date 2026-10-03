import { NextRequest, NextResponse } from 'next/server'

// Usuário e senha do admin vêm SÓ das variáveis da Vercel (ADMIN_USER / ADMIN_PASSWORD).
// Nada de senha escrita no código — o repositório é público.
export function credenciaisAdmin(): { usuario: string; senha: string } | null {
  const usuario = process.env.ADMIN_USER
  const senha = process.env.ADMIN_PASSWORD
  if (!usuario || !senha) return null
  return { usuario, senha }
}

export function tokenAdmin(usuario: string, senha: string) {
  return Buffer.from(`${usuario}:${senha}`).toString('base64')
}

function expectedToken() {
  const c = credenciaisAdmin()
  return c ? tokenAdmin(c.usuario, c.senha) : null
}

export function isAdminSession(req: NextRequest) {
  const esperado = expectedToken()
  if (!esperado) return false // sem senha configurada, ninguém entra
  return req.cookies.get('admin_auth')?.value === esperado
}

export function requireAdmin(req: NextRequest): NextResponse | null {
  if (isAdminSession(req)) return null
  return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
}
