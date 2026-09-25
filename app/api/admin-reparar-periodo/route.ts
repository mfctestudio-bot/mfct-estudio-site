import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { repararPeriodoPagamento } from '@/lib/planos'

// Ação de manutenção: conserta um pagamento que ficou "pago" sem o período de 30
// dias correspondente (ver comentário em repararPeriodoPagamento, lib/planos.ts).
// Continua passando só por lib/planos.ts -- não é uma via nova de ativação.
export async function POST(req: NextRequest) {
  const authError = requireAdmin(req)
  if (authError) return authError

  try {
    const body = await req.json()
    if (!body.pagamentoId) {
      return NextResponse.json({ error: 'pagamentoId é obrigatório' }, { status: 400 })
    }
    const result = await repararPeriodoPagamento(body.pagamentoId)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'falha ao reparar período' }, { status: 500 })
  }
}
