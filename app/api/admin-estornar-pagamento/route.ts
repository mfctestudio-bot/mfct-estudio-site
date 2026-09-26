import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { estornarPagamento } from '@/lib/planos'

export async function POST(req: NextRequest) {
  const authError = requireAdmin(req)
  if (authError) return authError

  try {
    const body = await req.json()
    if (!body.pagamentoId) {
      return NextResponse.json({ error: 'pagamentoId é obrigatório' }, { status: 400 })
    }
    const resultado = await estornarPagamento(body.pagamentoId)
    return NextResponse.json({ ok: true, ...resultado })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'falha ao estornar pagamento' }, { status: 500 })
  }
}
