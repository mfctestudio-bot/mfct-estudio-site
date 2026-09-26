import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { criarMensalidadePendente } from '@/lib/planos'

export async function POST(req: NextRequest) {
  const authError = requireAdmin(req)
  if (authError) return authError

  try {
    const body = await req.json()
    if (!body.alunoId || !body.planoId || body.valor == null) {
      return NextResponse.json({ error: 'alunoId, planoId e valor são obrigatórios' }, { status: 400 })
    }
    const resultado = await criarMensalidadePendente({
      alunoId: body.alunoId,
      planoId: body.planoId,
      valor: Number(body.valor),
      valorOriginal: Number(body.valorOriginal ?? body.valor),
      desconto: Number(body.desconto || 0),
      observacao: body.observacao,
    })
    return NextResponse.json({ ok: true, ...resultado })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'falha ao criar mensalidade pendente' }, { status: 500 })
  }
}
