import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/api-auth'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tgpestsfhjrdahtzwodk.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const STATUS_PERMITIDOS = ['pausado', 'cancelado']

export async function POST(req: NextRequest) {
  const authError = requireAdmin(req)
  if (authError) return authError
  if (!SERVICE_KEY) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor' }, { status: 500 })

  const { alunoId, status } = await req.json()
  if (!alunoId || !STATUS_PERMITIDOS.includes(status)) {
    return NextResponse.json({ error: 'alunoId e status administrativo válido são obrigatórios' }, { status: 400 })
  }
  const { error } = await createClient(SUPA_URL, SERVICE_KEY).from('alunos').update({ status_plano: status }).eq('id', alunoId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}