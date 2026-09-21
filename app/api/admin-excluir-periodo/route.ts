import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { excluirPeriodo } from '@/lib/planos'

export async function POST(req: NextRequest) {
  const authError = requireAdmin(req)
  if (authError) return authError

  try {
    const body = await req.json()
    if (!body.periodoId) {
      return NextResponse.json({ error: 'periodoId é obrigatório' }, { status: 400 })
    }
    const result = await excluirPeriodo(body.periodoId)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'falha ao excluir período' }, { status: 500 })
  }
}
