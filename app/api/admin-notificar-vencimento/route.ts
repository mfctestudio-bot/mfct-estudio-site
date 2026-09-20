import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { notificarVencimentoManual } from '@/lib/planos'

export async function POST(req: NextRequest) {
  const authError = requireAdmin(req)
  if (authError) return authError

  try {
    const body = await req.json()
    if (!body.alunoId) {
      return NextResponse.json({ error: 'alunoId é obrigatório' }, { status: 400 })
    }
    const result = await notificarVencimentoManual(body.alunoId)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'falha ao notificar vencimento' }, { status: 500 })
  }
}
