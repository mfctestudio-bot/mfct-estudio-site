import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { ativarPlano } from '@/lib/planos'

export async function POST(req: NextRequest) {
  const authError = requireAdmin(req)
  if (authError) return authError

  try {
    const body = await req.json()
    if (!body.alunoId || !body.planoId || !body.dataPagamento) {
      return NextResponse.json({ error: 'alunoId, planoId e dataPagamento são obrigatórios' }, { status: 400 })
    }
    const result = await ativarPlano({
      alunoId: body.alunoId,
      planoId: body.planoId,
      pagamentoId: body.pagamentoId,
      valor: Number(body.valor),
      valorOriginal: Number(body.valorOriginal),
      desconto: Number(body.desconto || 0),
      dataPagamento: body.dataPagamento,
      metodoPagamento: body.metodoPagamento,
      observacao: body.observacao,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'falha ao ativar plano' }, { status: 500 })
  }
}