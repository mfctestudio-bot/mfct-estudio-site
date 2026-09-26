import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { confirmarPagamentoPendente } from '@/lib/planos'

export async function POST(req: NextRequest) {
  const authError = requireAdmin(req)
  if (authError) return authError

  try {
    const body = await req.json()
    if (!body.pagamentoId || !body.dataPagamento) {
      return NextResponse.json({ error: 'pagamentoId e dataPagamento são obrigatórios' }, { status: 400 })
    }
    const resultado = await confirmarPagamentoPendente({
      pagamentoId: body.pagamentoId,
      dataPagamento: body.dataPagamento,
      metodoPagamento: body.metodoPagamento,
    })
    return NextResponse.json({ ok: true, ...resultado })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'falha ao confirmar pagamento pendente' }, { status: 500 })
  }
}
