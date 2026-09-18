import { createClient, SupabaseClient } from '@supabase/supabase-js'

type AtivarPlanoInput = {
  alunoId: string
  planoId: string
  valor: number
  valorOriginal: number
  desconto: number
  dataPagamento: string
  pagamentoId?: string
  metodoPagamento?: string
  observacao?: string
}

type AtivarPlanoResult = {
  pagamentoId: string
  periodoId: string
  dataInicio: string
  dataFim: string
}

function serviceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase server credentials are not configured')
  return createClient(url, key)
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

export async function ativarPlano(input: AtivarPlanoInput): Promise<AtivarPlanoResult> {
  const supabase = serviceClient()
  const dataPagamento = new Date(`${input.dataPagamento}T12:00:00`)
  if (Number.isNaN(dataPagamento.getTime())) throw new Error('data de pagamento inválida')

  const { data: aluno, error: alunoError } = await supabase
    .from('alunos')
    .select('id')
    .eq('id', input.alunoId)
    .single()
  if (alunoError || !aluno) throw new Error(alunoError?.message || 'aluno não encontrado')

  const { data: ultimoPeriodo, error: periodoError } = await supabase
    .from('planos_periodos')
    .select('id, data_fim')
    .eq('aluno_id', input.alunoId)
    .order('data_fim', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (periodoError) throw new Error(periodoError.message)

  let dataInicio = input.dataPagamento
  if (ultimoPeriodo) {
    const fimUltimo = new Date(`${ultimoPeriodo.data_fim}T00:00:00`)
    if (fimUltimo >= dataPagamento) {
      fimUltimo.setDate(fimUltimo.getDate() + 1)
      dataInicio = isoDate(fimUltimo)
    }
  }

  const dataFimDate = new Date(`${dataInicio}T00:00:00`)
  dataFimDate.setDate(dataFimDate.getDate() + 30)
  const dataFim = isoDate(dataFimDate)
  const hoje = isoDate(new Date())
  const statusPeriodo = dataInicio <= hoje ? 'ativo' : 'agendado'
  const dataVencimento = new Date(dataPagamento)
  dataVencimento.setMonth(dataVencimento.getMonth() + 1)

  let pagamentoId = input.pagamentoId
  let pagamentoCriado = false
  let pagamentoAnterior: Record<string, unknown> | null = null

  if (pagamentoId) {
    const { data: pagamento, error } = await supabase
      .from('pagamentos')
      .select('*')
      .eq('id', pagamentoId)
      .eq('aluno_id', input.alunoId)
      .single()
    if (error || !pagamento) throw new Error(error?.message || 'pagamento não encontrado para o aluno')
    pagamentoAnterior = pagamento
    const { error: updateError } = await supabase.from('pagamentos').update({
      plano_id: input.planoId,
      valor: input.valor,
      valor_original: input.valorOriginal,
      desconto: input.desconto,
      status: 'pago',
      confirmado_em: new Date().toISOString(),
      confirmado_por: 'admin',
      data_pagamento: dataPagamento.toISOString(),
      data_vencimento: dataVencimento.toISOString().slice(0, 10),
        metodo_pagamento: input.metodoPagamento || 'manual',
    }).eq('id', pagamentoId).eq('aluno_id', input.alunoId)
    if (updateError) throw new Error(updateError.message)
  } else {
    const { data: pagamento, error } = await supabase.from('pagamentos').insert({
      aluno_id: input.alunoId,
      plano_id: input.planoId,
      valor: input.valor,
      valor_original: input.valorOriginal,
      desconto: input.desconto,
      status: 'pago',
      confirmado_em: new Date().toISOString(),
      confirmado_por: 'admin',
      data_pagamento: dataPagamento.toISOString(),
      data_vencimento: dataVencimento.toISOString().slice(0, 10),
      metodo_pagamento: input.metodoPagamento || 'manual',
      observacao: input.observacao,
    }).select('id').single()
    if (error || !pagamento) throw new Error(error?.message || 'não foi possível criar o pagamento')
    pagamentoId = pagamento.id
    pagamentoCriado = true
  }

  const { data: periodo, error: novoPeriodoError } = await supabase.from('planos_periodos').insert({
    aluno_id: input.alunoId,
    pagamento_id: pagamentoId,
    data_inicio: dataInicio,
    data_fim: dataFim,
    status: statusPeriodo,
  }).select('id').single()

  if (novoPeriodoError || !periodo) {
    if (pagamentoCriado) {
      await supabase.from('pagamentos').delete().eq('id', pagamentoId).eq('aluno_id', input.alunoId)
    } else if (pagamentoAnterior) {
      await supabase.from('pagamentos').update(pagamentoAnterior).eq('id', pagamentoId).eq('aluno_id', input.alunoId)
    }
    throw new Error(novoPeriodoError?.message || 'não foi possível criar o período')
  }

  const { error: alunoUpdateError } = await supabase.from('alunos').update({
    status_plano: 'ativo',
    plano_id: input.planoId,
    dia_vencimento: Number(input.dataPagamento.slice(8, 10)),
  }).eq('id', input.alunoId)

  if (alunoUpdateError) {
    await supabase.from('planos_periodos').delete().eq('id', periodo.id).eq('aluno_id', input.alunoId)
    if (pagamentoCriado) {
      await supabase.from('pagamentos').delete().eq('id', pagamentoId).eq('aluno_id', input.alunoId)
    } else if (pagamentoAnterior) {
      await supabase.from('pagamentos').update(pagamentoAnterior).eq('id', pagamentoId).eq('aluno_id', input.alunoId)
    }
    throw new Error(alunoUpdateError.message)
  }

  if (!pagamentoId) throw new Error('pagamentoId ausente após criação/atualização do pagamento')
  return { pagamentoId, periodoId: periodo.id, dataInicio, dataFim }
}

export type LiberacaoAgendaResult = {
  agendamentosFuturosLiberados: number
  horariosFixosDesativados: number
  avisos: string[]
}

function hojeISOSaoPaulo(): string {
  const hojeSP = new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }).slice(0, 10)
  return new Date(hojeSP).toISOString().slice(0, 10)
}

// Regra de negocio: MATRICULA ATIVA + PERIODO VIGENTE = DIREITO DE TREINAR.
// Um aluno pausado ou cancelado deixa de ter matricula ativa, entao nao pode
// continuar ocupando vagas futuras -- nem avulsas (agendamentos) nem recorrentes
// (horarios_fixos). Sem isso, a vaga fica "presa" com alguem sem direito de
// treinar, tirando capacidade de quem tem.
//
// Isso nao inventa estrutura nova: usa apenas colunas que ja existem
// (agendamentos.status/cancelado_por, horarios_fixos.ativo).
//
// Compartilhado entre o cancelamento/pausa manual (admin-aluno-status) e o
// cancelamento automatico por vencimento (verificarVencimentos), para que as
// duas vias produzam exatamente o mesmo efeito sobre a agenda.
export async function liberarAgendaDoAluno(supabase: SupabaseClient, alunoId: string): Promise<LiberacaoAgendaResult> {
  const hojeISO = hojeISOSaoPaulo()

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

return {
  agendamentosFuturosLiberados: agendamentosLiberados?.length || 0,
  horariosFixosDesativados: fixosDesativados?.length || 0,
  avisos: [erroAgenda?.message, erroFixos?.message].filter((m): m is string => Boolean(m)),
}
}

  export const DIAS_CARENCIA_VENCIMENTO = 14

// Quantos dias inteiros ja se passaram desde que o periodo venceu.
// dataFim e o ultimo dia coberto (o aluno ainda tem direito de treinar nesse
// dia); o primeiro dia "vencido" e dataFim + 1. Ex.: dataFim=01/01,
// hoje=15/01 -> 14 dias vencido (14 dias corridos desde o vencimento).
export function diasVencido(dataFim: string, hojeIso: string): number {
  const fim = new Date(`${dataFim}T00:00:00`)
  const hoje = new Date(`${hojeIso}T00:00:00`)
  return Math.round((hoje.getTime() - fim.getTime()) / 86400000)
}

export type VerificarVencimentosResult = {
  verificados: number
  cancelados: { alunoId: string; dataFim: string; diasVencido: number }[]
  avisos: string[]
}

// Vencimento -> Cancelado: aluno com matricula ativa cujo periodo mais recente
// venceu (data_fim no passado) e que ficou `diasCarencia` dias sem renovar
// (sem periodo novo cobrindo hoje ou o futuro) e cancelado automaticamente,
// com o mesmo efeito de liberacao de agenda do cancelamento manual.
//
// Enquanto estiver dentro da carencia (vencido, mas ha menos de `diasCarencia`
// dias), o status_plano continua 'ativo' -- e a UI (statusPeriodoHoje) que ja
// mostra esse aluno como "vencido" a partir da data_fim, com base nas datas
// reais do periodo. Isso preserva a cobranca: so depois de cancelado e que o
// aluno some das telas de cobranca (mensalidades, mensalidades e dashboard ja
// tratam status_plano === 'cancelado' como nao cobravel).
export async function verificarVencimentos(
  diasCarencia = DIAS_CARENCIA_VENCIMENTO,
  supabaseClient?: SupabaseClient,
  ): Promise<VerificarVencimentosResult> {
  const supabase = supabaseClient || serviceClient()
  const hojeIso = hojeISOSaoPaulo()

const { data: alunosAtivos, error: alunosError } = await supabase
  .from('alunos')
  .select('id')
  .eq('status_plano', 'ativo')
  if (alunosError) throw new Error(alunosError.message)

const cancelados: VerificarVencimentosResult['cancelados'] = []
  const avisos: string[] = []
    const alunoIds = (alunosAtivos || []).map(a => a.id)
  if (alunoIds.length === 0) return { verificados: 0, cancelados, avisos }

const { data: periodos, error: periodosError } = await supabase
  .from('planos_periodos')
  .select('aluno_id, data_fim')
  .in('aluno_id', alunoIds)
  .order('data_fim', { ascending: false })
  if (periodosError) throw new Error(periodosError.message)

const ultimoFimPorAluno = new Map<string, string>()
  for (const periodo of periodos || []) {
    // ja vem ordenado por data_fim desc, entao o primeiro valor visto por
  // aluno e o periodo mais recente (o que determina ate quando ele esta coberto)
  if (!ultimoFimPorAluno.has(periodo.aluno_id)) {
    ultimoFimPorAluno.set(periodo.aluno_id, periodo.data_fim)
  }
  }

for (const alunoId of alunoIds) {
  const dataFim = ultimoFimPorAluno.get(alunoId)
  if (!dataFim) {
    avisos.push(`aluno ${alunoId}: status ativo sem periodo registrado -- nao avaliado automaticamente`)
    continue
  }

  if (dataFim >= hojeIso) continue // periodo ainda cobre hoje (ou e uma renovacao futura ja registrada): nao venceu

  const dias = diasVencido(dataFim, hojeIso)
  if (dias < diasCarencia) continue // vencido, mas ainda dentro da carencia -- continua ativo e cobravel

  const { error: updateError } = await supabase
  .from('alunos')
  .update({ status_plano: 'cancelado' })
  .eq('id', alunoId)
  .eq('status_plano', 'ativo') // evita corrida com uma renovacao/alteracao de status concorrente
  .select('id')
  .single()
  if (updateError) {
    avisos.push(`aluno ${alunoId}: ${updateError.message}`)
    continue
  }

  const liberacao = await liberarAgendaDoAluno(supabase, alunoId)
  avisos.push(...liberacao.avisos)
  cancelados.push({ alunoId, dataFim, diasVencido: dias })
}

return { verificados: alunoIds.length, cancelados, avisos }
}
