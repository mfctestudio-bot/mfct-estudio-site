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

  const supabase = createClient(SUPA_URL, SERVICE_KEY)

  const { error } = await supabase.from('alunos').update({ status_plano: status }).eq('id', alunoId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Regra de negócio: MATRÍCULA ATIVA + PERÍODO VIGENTE = DIREITO DE TREINAR.
  // Um aluno pausado ou cancelado deixa de ter matrícula ativa, então não pode
  // continuar ocupando vagas futuras — nem avulsas (agendamentos) nem recorrentes
  // (horarios_fixos). Sem isso, a vaga fica "presa" com alguém sem direito de
  // treinar, tirando capacidade de quem tem.
  //
  // Isso não inventa estrutura nova: usa apenas colunas que já existem
  // (agendamentos.status/cancelado_por, horarios_fixos.ativo).
  const hojeSP = new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }).slice(0, 10)
  const hojeISO = new Date(hojeSP).toISOString().slice(0, 10)

  const { data: agendamentosLiberados, error: erroAgenda } = await supabase
    .from('agendamentos')
    .update({ status: 'cancelado', cancelado_por: 'estudio' })
    .eq('aluno_id', alunoId)
    .eq('status', 'confirmado')
    .gte('data', hojeISO)
    .select('id')

  const { data: fixosDesativados, error: erroFixos } = await supabase
    .from('horarios_fixos')
    .update({ ativo: false })
    .eq('aluno_id', alunoId)
    .eq('ativo', true)
    .select('id')

  return NextResponse.json({
    ok: true,
    agendamentos_futuros_liberados: agendamentosLiberados?.length || 0,
    horarios_fixos_desativados: fixosDesativados?.length || 0,
    avisos: [erroAgenda?.message, erroFixos?.message].filter(Boolean),
  })
}
