import { NextRequest, NextResponse } from 'next/server'
import { isAdminSession } from '@/lib/api-auth'
import { verificarVencimentos, verificarPausasExpiradas } from '@/lib/planos'

// Autoriza tanto o Vercel Cron (header Authorization: Bearer $CRON_SECRET,
// enviado automaticamente pela Vercel quando a env var CRON_SECRET esta
// configurada no projeto) quanto uma chamada manual autenticada como admin
// (util para rodar/testar a verificacao sob demanda pelo painel).
function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  if (secret && auth === `Bearer ${secret}`) return true
  return isAdminSession(req)
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  }

try {
  const vencimentos = await verificarVencimentos()
  const pausas = await verificarPausasExpiradas()
  return NextResponse.json({ ok: true, vencimentos, pausas })
} catch (error) {
  return NextResponse.json({ error: error instanceof Error ? error.message : 'falha ao verificar vencimentos' }, { status: 500 })
}
}
