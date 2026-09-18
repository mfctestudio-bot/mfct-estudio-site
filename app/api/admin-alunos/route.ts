import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/api-auth'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tgpestsfhjrdahtzwodk.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function client() {
  return createClient(SUPA_URL, SERVICE_KEY)
}

export async function POST(req: NextRequest) {
  const authError = requireAdmin(req)
  if (authError) return authError
  if (!SERVICE_KEY) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor' }, { status: 500 })

  const body = await req.json()
  if (!body.nome) return NextResponse.json({ error: 'nome é obrigatório' }, { status: 400 })

  const { data, error } = await client().from('alunos').insert({
    nome: String(body.nome).trim(),
    cpf: body.cpf || null,
    telefone: body.telefone || null,
    data_nascimento: body.dataNascimento || null,
    plano_id: body.planoId || null,
    status_plano: body.status,
  }).select('id').single()
  if (error || !data) return NextResponse.json({ error: error?.message || 'não foi possível criar aluno' }, { status: 500 })
  return NextResponse.json({ ok: true, alunoId: data.id })
}

export async function PATCH(req: NextRequest) {
  const authError = requireAdmin(req)
  if (authError) return authError
  if (!SERVICE_KEY) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor' }, { status: 500 })

  const body = await req.json()
  if (!body.id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })
  const { error } = await client().from('alunos').update({
    nome: body.nome,
    cpf: body.cpf || null,
    telefone: body.telefone || null,
    data_nascimento: body.dataNascimento || null,
    observacoes: body.observacoes || null,
  }).eq('id', body.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}