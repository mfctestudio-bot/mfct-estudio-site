import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { editarInicioPeriodo } from '@/lib/planos'

export async function POST(req: NextRequest) {
  const authError = requireAdmin(req)
  if (authError) return authError

  try {
    const body = await req.json()
    if (!body.periodoId || !body.novaDataInicio) {
      return NextResponse.json({ error: 'periodoId e novaDataInicio são obrigatórios' }, { status: 400 })
    }
    const result = await editarInicioPeriodo({
      periodoId: body.periodoId,
      novaDataInicio: body.novaDataInicio,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'falha ao editar período' }, { status: 500 })
  }
}
