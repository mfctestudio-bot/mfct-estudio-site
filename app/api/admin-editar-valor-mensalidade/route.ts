import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { editarValorMensalidade } from '@/lib/planos'

export async function POST(req: NextRequest) {
  const authError = requireAdmin(req)
  if (authError) return authError

  try {
    const body = await req.json()
    if (!body.pagamentoId || body.valor == null) {
      return NextResponse.json({ error: 'pagamentoId e valor são obrigatórios' }, { status: 400 })
    }
    const resultado = await editarValorMensalidade(body.pagamentoId, Number(body.valor), Number(body.desconto || 0))
    return NextResponse.json({ ok: true, ...resultado })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'falha ao editar valor da mensalidade' }, { status: 500 })
  }
}
