import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/api-auth'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tgpestsfhjrdahtzwodk.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

async function validarAcessoECapacidade(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  alunoId: string,
  horarioId: string,
  data: string,
  excluirAgendamentoId?: string,
) {
  const [alunoResp, periodosResp, horarioResp] = await Promise.all([
    supabase.from('alunos').select('id, status_plano').eq('id', alunoId).single(),
    supabase.from('planos_periodos').select('data_inicio, data_fim').eq('aluno_id', alunoId),
    supabase.from('horarios').select('id, capacidade, ativo').eq('id', horarioId).single(),
  ])
  const aluno = alunoResp.data as { id: string; status_plano: string } | null
  const alunoError = alunoResp.error
  const periodos = periodosResp.data as { data_inicio: string; data_fim: string }[] | null
  const periodosError = periodosResp.error
  const horario = horarioResp.data as { id: string; capacidade: number; ativo: boolean } | null
  const horarioError = horarioResp.error

  if (alunoError || !aluno) return 'aluno não encontrado'
  if (aluno.status_plano !== 'ativo') return 'a matrícula do aluno não está ativa'
  if (periodosError) return periodosError.message
  const periodoVigente = (periodos || []).some(periodo => periodo.data_inicio <= data && periodo.data_fim >= data)
  if (!periodoVigente) return 'o aluno não possui período vigente na data da aula'
  if (horarioError || !horario) return 'horário não encontrado'
  if (!horario.ativo) return 'horário inativo'

  let consulta = supabase
    .from('agendamentos')
    .select('id', { count: 'exact', head: true })
    .eq('data', data)
    .eq('horario_id', horarioId)
    .eq('status', 'confirmado')
  if (excluirAgendamentoId) consulta = consulta.neq('id', excluirAgendamentoId)
  const { count, error: ocupacaoError } = await consulta
  if (ocupacaoError) return ocupacaoError.message
  if ((count || 0) >= horario.capacidade) return 'não há vaga disponível nesse horário'
  return null
}

export async function POST(req: NextRequest) {
  const authError = requireAdmin(req)
  if (authError) return authError
  if (!SERVICE_KEY) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor' }, { status: 500 })

  const body = await req.json()
  const { alunoId, horarioId, data, tipo, repetirSemana } = body
  if (!alunoId || !horarioId || !data || !['aula', 'experimental'].includes(tipo)) {
    return NextResponse.json({ error: 'alunoId, horarioId, data e tipo são obrigatórios' }, { status: 400 })
  }

  const supabase = createClient(SUPA_URL, SERVICE_KEY)
  const erroValidacao = await validarAcessoECapacidade(supabase, alunoId, horarioId, data)
  if (erroValidacao) return NextResponse.json({ error: erroValidacao }, { status: 409 })

  const { data: agendamento, error } = await supabase.from('agendamentos').insert({
    aluno_id: alunoId,
    horario_id: horarioId,
    data,
    status: 'confirmado',
    tipo,
  }).select('id').single()
  if (error || !agendamento) return NextResponse.json({ error: error?.message || 'não foi possível criar o agendamento' }, { status: 500 })

  if (repetirSemana) {
    const { error: fixoError } = await supabase.from('horarios_fixos').insert({
      aluno_id: alunoId,
      horario_id: horarioId,
      ativo: true,
    })
    if (fixoError) return NextResponse.json({ error: `agendamento criado, mas horário fixo não foi criado: ${fixoError.message}`, agendamentoId: agendamento.id }, { status: 500 })
  }

  return NextResponse.json({ ok: true, agendamentoId: agendamento.id, hoje: hojeISO() })
}

export async function PATCH(req: NextRequest) {
  const authError = requireAdmin(req)
  if (authError) return authError
  if (!SERVICE_KEY) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor' }, { status: 500 })

  const body = await req.json()
  const { agendamentoId, horarioId, data } = body
  if (!agendamentoId || !horarioId || !data) {
    return NextResponse.json({ error: 'agendamentoId, horarioId e data são obrigatórios' }, { status: 400 })
  }

  const supabase = createClient(SUPA_URL, SERVICE_KEY)
  const { data: agendamento, error: agendamentoError } = await supabase
    .from('agendamentos')
    .select('id, aluno_id, tipo, status')
    .eq('id', agendamentoId)
    .single()
  if (agendamentoError || !agendamento) return NextResponse.json({ error: 'agendamento não encontrado' }, { status: 404 })
  if (agendamento.status !== 'confirmado') return NextResponse.json({ error: 'somente agendamentos confirmados podem ser remarcados' }, { status: 409 })

  const erroValidacao = await validarAcessoECapacidade(supabase, agendamento.aluno_id, horarioId, data, agendamentoId)
  if (erroValidacao) return NextResponse.json({ error: erroValidacao }, { status: 409 })

  const { error } = await supabase.from('agendamentos').update({ data, horario_id: horarioId }).eq('id', agendamentoId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}