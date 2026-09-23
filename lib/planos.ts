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

function diasEntre(dataInicioIso: string, dataFimIso: string): number {
  const inicio = new Date(`${dataInicioIso}T00:00:00`)
  const fim = new Date(`${dataFimIso}T00:00:00`)
  return Math.round((fim.getTime() - inicio.getTime()) / 86400000)
}

const EVO_URL = process.env.EVO_URL || ''
const EVO_KEY = process.env.EVO_KEY || ''

// Notificacao "best effort" pelo WhatsApp (mesma Evolution API usada pela Elen
// no n8n). Uma falha aqui nunca pode travar um cancelamento/pausa automatico
// -- por isso engole qualquer erro.
export async function enviarWhatsAppAluno(telefone: string | null | undefined, texto: string): Promise<void> {
  if (!telefone || !EVO_URL || !EVO_KEY) return
  try {
    await fetch(`${EVO_URL}/message/sendText/MFCT-ESTUDIO`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
      body: JSON.stringify({ number: telefone, text: texto }),
    })
  } catch {
    // notificacao e best effort -- nao pode quebrar o fluxo principal
  }
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
  .select('id, status_desde, nome, telefone')
  .eq('status_plano', 'ativo')
  if (alunosError) throw new Error(alunosError.message)
  const statusDesdePorAluno = new Map<string, string | null>()
  const nomeTelefonePorAluno = new Map<string, { nome: string | null; telefone: string | null }>()
  for (const a of alunosAtivos || []) {
    statusDesdePorAluno.set(a.id, a.status_desde ?? null)
    nomeTelefonePorAluno.set(a.id, { nome: a.nome ?? null, telefone: a.telefone ?? null })
  }

const cancelados: VerificarVencimentosResult['cancelados'] = []
  const avisos: string[] = []
    const alunoIds = (alunosAtivos || []).map(a => a.id)
  if (alunoIds.length === 0) return { verificados: 0, cancelados, avisos }

const { data: periodos, error: periodosError } = await supabase
  .from('planos_periodos')
  .select('aluno_id, data_inicio, data_fim')
  .in('aluno_id', alunoIds)
  .order('data_fim', { ascending: false })
  if (periodosError) throw new Error(periodosError.message)

const periodosPorAluno = new Map<string, { data_inicio: string; data_fim: string }[]>()
  for (const periodo of periodos || []) {
    const lista = periodosPorAluno.get(periodo.aluno_id) || []
    lista.push({ data_inicio: periodo.data_inicio, data_fim: periodo.data_fim })
    periodosPorAluno.set(periodo.aluno_id, lista)
  }

for (const alunoId of alunoIds) {
  const listaPeriodos = periodosPorAluno.get(alunoId)
  if (!listaPeriodos || listaPeriodos.length === 0) {
    // Bug real encontrado em 22/09/2026 (caso Cleiciane): aluno "ativo" sem NENHUM periodo
    // registrado ficava para sempre sem ser avaliado por aqui, porque nao ha data_fim pra medir
    // dias de vencido. Em vez de pular pra sempre, damos 1 dia de folga (pro periodo ainda estar
    // sendo criado logo apos a ativacao) e, passado isso, marcamos "vencido" pra revisao manual --
    // nao "cancelado" direto, porque sem nenhum periodo nao da pra saber ha quanto tempo isso
    // acontece nem se e so um cadastro incompleto.
    const statusDesde = statusDesdePorAluno.get(alunoId) || null
    if (statusDesde && statusDesde >= hojeIso) {
      avisos.push(`aluno ${alunoId}: status ativo sem periodo registrado, ativado hoje -- ainda nao avaliado`)
      continue
    }
    const { error: updateError } = await supabase
      .from('alunos')
      .update({ status_plano: 'vencido' })
      .eq('id', alunoId)
      .eq('status_plano', 'ativo')
      .select('id')
      .single()
    if (updateError) {
      avisos.push(`aluno ${alunoId}: ${updateError.message}`)
    } else {
      avisos.push(`aluno ${alunoId}: status ativo sem NENHUM periodo registrado -- marcado vencido pra revisao manual`)
    }
    continue
  }

  // Hoje esta coberto por algum periodo (passado, atual ou ja agendado)? entao nao venceu,
  // mesmo que exista tambem um periodo futuro ja cadastrado.
  const coberto = listaPeriodos.some(p => p.data_inicio <= hojeIso && p.data_fim >= hojeIso)
  if (coberto) continue

  // Nao ha periodo cobrindo hoje. O que importa pra saber ha quanto tempo esta vencido
  // e o periodo passado mais recente (o ultimo que de fato cobriu o aluno) -- nunca um
  // periodo futuro ja agendado, que nao diz nada sobre um buraco no meio.
  const periodosPassados = listaPeriodos.filter(p => p.data_fim < hojeIso)
  if (periodosPassados.length === 0) {
    avisos.push(`aluno ${alunoId}: so tem periodo(s) futuro(s) agendado(s), sem cobertura ate hoje -- nao avaliado automaticamente`)
    continue
  }
  const dataFim = periodosPassados.reduce((maior, p) => (p.data_fim > maior ? p.data_fim : maior), periodosPassados[0].data_fim)

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

  // Avisa o aluno que o plano foi cancelado por falta de pagamento -- mesmo padrao
  // ja usado em verificarPausasExpiradas pra pausa cancelada por prazo. Sem isso,
  // o aluno so descobria que perdeu acesso quando tentasse agendar de novo.
  const dadosAluno = nomeTelefonePorAluno.get(alunoId)
  if (dadosAluno?.telefone) {
    await enviarWhatsAppAluno(
      dadosAluno.telefone,
      `Oi${dadosAluno.nome ? `, ${dadosAluno.nome.split(' ')[0]}` : ''}! Sua mensalidade no MFCT Estúdio venceu há ${dias} dias e o plano foi cancelado -- por isso o acesso aos horários (fixo ou avulso) fica em espera. Pra voltar a treinar é só regularizar o pagamento que eu já libero de novo. Qualquer dúvida me chama por aqui! 💪`
    )
  }
}

return { verificados: alunoIds.length, cancelados, avisos }
}

export const LIMITE_DIAS_PAUSA = 15

export type ContinuarPlanoResult = {
  periodoId: string
  dataFimAnterior: string
  dataFimNova: string
  diasPausado: number
}

// "Continuar" depois de uma pausa: dentro do limite de LIMITE_DIAS_PAUSA dias
// corridos, o aluno volta a treinar sem pagar de novo. Nao conta aula --
// conta dia corrido: o vencimento do periodo que estava em curso quando a
// pausa comecou e so empurrado pelo numero de dias que ele ficou parado.
// Ex.: periodo ia ate dia 30, pausou dia 10 (sobravam 20 dias), voltou dia 17
// (ficou 7 dias pausado) -> novo vencimento = dia 30 + 7 = dia 37.
export async function continuarPlano(alunoId: string): Promise<ContinuarPlanoResult> {
  const supabase = serviceClient()
  const hojeIso = hojeISOSaoPaulo()

  const { data: aluno, error: alunoError } = await supabase
    .from('alunos')
    .select('id, status_plano, status_desde')
    .eq('id', alunoId)
    .single()
  if (alunoError || !aluno) throw new Error(alunoError?.message || 'aluno não encontrado')
  if (aluno.status_plano !== 'pausado') throw new Error('esse aluno não está pausado')
  if (!aluno.status_desde) throw new Error('não foi possível determinar a data em que a pausa começou')

  const diasPausado = diasEntre(aluno.status_desde, hojeIso)
  if (diasPausado > LIMITE_DIAS_PAUSA) {
    throw new Error(`Essa pausa já passou de ${LIMITE_DIAS_PAUSA} dias (${diasPausado} dias). O plano já deveria estar cancelado -- use "Reativar" com um novo pagamento.`)
  }

  // periodo que estava em curso no dia em que a pausa comecou
  const { data: periodo, error: periodoError } = await supabase
    .from('planos_periodos')
    .select('id, data_inicio, data_fim')
    .eq('aluno_id', alunoId)
    .lte('data_inicio', aluno.status_desde)
    .gte('data_fim', aluno.status_desde)
    .order('data_fim', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (periodoError) throw new Error(periodoError.message)
  if (!periodo) throw new Error('não foi encontrado o período que estava em curso quando a pausa começou')

  const fimAnteriorDate = new Date(`${periodo.data_fim}T00:00:00`)
  fimAnteriorDate.setDate(fimAnteriorDate.getDate() + diasPausado)
  const dataFimNova = isoDate(fimAnteriorDate)

  const { error: updatePeriodoError } = await supabase
    .from('planos_periodos')
    .update({ data_fim: dataFimNova, status: 'ativo' })
    .eq('id', periodo.id)
  if (updatePeriodoError) throw new Error(updatePeriodoError.message)

  const { error: updateAlunoError } = await supabase
    .from('alunos')
    .update({ status_plano: 'ativo' })
    .eq('id', alunoId)
  if (updateAlunoError) throw new Error(updateAlunoError.message)

  return { periodoId: periodo.id, dataFimAnterior: periodo.data_fim, dataFimNova, diasPausado }
}

export type VerificarPausasResult = {
  verificados: number
  cancelados: { alunoId: string; diasPausado: number }[]
  avisos: string[]
}

// Pausa -> Cancelado: uma pausa tem prazo maximo de LIMITE_DIAS_PAUSA dias
// corridos a partir do dia em que comecou (status_desde), independente de
// quantos dias de mensalidade ainda restavam quando pausou. Passado o prazo
// sem o aluno voltar (continuarPlano), o plano e cancelado automaticamente,
// com o mesmo efeito de liberacao de agenda do cancelamento manual, e o
// aluno e avisado pelo WhatsApp (Elen) que precisa pagar de novo pra voltar.
export async function verificarPausasExpiradas(
  limiteDias = LIMITE_DIAS_PAUSA,
  supabaseClient?: SupabaseClient,
): Promise<VerificarPausasResult> {
  const supabase = supabaseClient || serviceClient()
  const hojeIso = hojeISOSaoPaulo()

  const { data: alunosPausados, error: alunosError } = await supabase
    .from('alunos')
    .select('id, nome, telefone, status_desde')
    .eq('status_plano', 'pausado')
  if (alunosError) throw new Error(alunosError.message)

  const cancelados: VerificarPausasResult['cancelados'] = []
  const avisos: string[] = []

  for (const aluno of alunosPausados || []) {
    if (!aluno.status_desde) {
      avisos.push(`aluno ${aluno.id}: pausado sem status_desde registrado -- nao avaliado automaticamente`)
      continue
    }
    const diasPausado = diasEntre(aluno.status_desde, hojeIso)
    if (diasPausado <= limiteDias) continue

    const { error: updateError } = await supabase
      .from('alunos')
      .update({ status_plano: 'cancelado' })
      .eq('id', aluno.id)
      .eq('status_plano', 'pausado') // evita corrida com um "continuar" concorrente
      .select('id')
      .single()
    if (updateError) {
      avisos.push(`aluno ${aluno.id}: ${updateError.message}`)
      continue
    }

    const liberacao = await liberarAgendaDoAluno(supabase, aluno.id)
    avisos.push(...liberacao.avisos)

    await enviarWhatsAppAluno(
      aluno.telefone,
      `Oi, ${aluno.nome}! Infelizmente sua mensalidade no MFCT Estúdio foi cancelada porque o tempo máximo de pausa (${limiteDias} dias) passou. Se quiser voltar a treinar, é só pagar a mensalidade de novo pra gente reativar. 💪`
    )

    cancelados.push({ alunoId: aluno.id, diasPausado })
  }

  return { verificados: (alunosPausados || []).length, cancelados, avisos }
}

export type NotificarVencimentoResult = {
  diasVencido: number
  valor: number | null
  telefone: string
}

// Cobranca manual: disparada pelo admin clicando um botao no perfil da
// mensalidade, pra um aluno com matricula vencida. Usa o mesmo canal
// (Evolution API/WhatsApp) que a Elen ja usa pra avisos automaticos -- mas,
// ao contrario de enviarWhatsAppAluno (best-effort, engole erro), aqui um
// erro de envio precisa aparecer pra quem clicou o botao.
export async function notificarVencimentoManual(
  alunoId: string,
  supabaseClient?: SupabaseClient,
): Promise<NotificarVencimentoResult> {
  const supabase = supabaseClient || serviceClient()
  const hojeIso = hojeISOSaoPaulo()

  const { data: aluno, error: alunoError } = await supabase
    .from('alunos')
    .select('id, nome, telefone, plano_id')
    .eq('id', alunoId)
    .single()
  if (alunoError || !aluno) throw new Error('Aluno não encontrado')
  if (!aluno.telefone) throw new Error('Esse aluno não tem telefone cadastrado')

  const { data: periodos, error: periodosError } = await supabase
    .from('planos_periodos')
    .select('data_fim')
    .eq('aluno_id', alunoId)
    .order('data_fim', { ascending: false })
    .limit(1)
  if (periodosError) throw new Error(periodosError.message)
  const periodo = (periodos || [])[0]
  if (!periodo) throw new Error('Esse aluno não tem nenhum período de mensalidade registrado')

  const dias = diasVencido(periodo.data_fim, hojeIso)
  if (dias <= 0) throw new Error('A mensalidade desse aluno não está vencida')

  let valor: number | null = null
  if (aluno.plano_id) {
    const { data: plano } = await supabase.from('planos').select('valor').eq('id', aluno.plano_id).single()
    valor = plano?.valor ?? null
  }

  const valorTexto = valor != null ? `R$ ${valor.toFixed(2).replace('.', ',')}` : 'o valor combinado'
  const texto = `Oi, ${aluno.nome}! Passando aqui pra lembrar que sua mensalidade do MFCT Estúdio venceu há ${dias} dia${dias === 1 ? '' : 's'} (valor: ${valorTexto}). Pra continuar treinando sem problemas, é só regularizar o pagamento. Qualquer dúvida, me chama! 💪`

  if (!EVO_URL || !EVO_KEY) throw new Error('WhatsApp (Evolution API) não está configurado no servidor')

  const resposta = await fetch(`${EVO_URL}/message/sendText/MFCT-ESTUDIO`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
    body: JSON.stringify({ number: aluno.telefone, text: texto }),
  })
  if (!resposta.ok) throw new Error('Falha ao enviar a mensagem pelo WhatsApp')

  return { diasVencido: dias, valor, telefone: aluno.telefone }
}

export type EditarInicioPeriodoInput = {
  periodoId: string
  novaDataInicio: string
}

export type EditarInicioPeriodoResult = {
  periodoId: string
  dataInicio: string
  dataFim: string
  status: string
}

// Permite corrigir a data de inicio de um periodo ja cadastrado (ex.: quando
// o plano foi cadastrado atrasado, com a data errada). Recalcula data_fim
// (sempre 30 dias a partir da nova data_inicio) e o status do periodo
// ('ativo' se ja comecou, 'agendado' se comeca no futuro). Nao mexe em
// pagamento nem em nenhuma outra tabela -- so nas datas desse periodo.
export async function editarInicioPeriodo(input: EditarInicioPeriodoInput): Promise<EditarInicioPeriodoResult> {
  const supabase = serviceClient()
  const novaDataInicio = input.novaDataInicio
  const novaData = new Date(`${novaDataInicio}T00:00:00`)
  if (Number.isNaN(novaData.getTime())) throw new Error('data de início inválida')

  const { data: periodo, error: periodoError } = await supabase
    .from('planos_periodos')
    .select('id, aluno_id')
    .eq('id', input.periodoId)
    .single()
  if (periodoError || !periodo) throw new Error(periodoError?.message || 'período não encontrado')

  const { data: outrosPeriodos, error: outrosError } = await supabase
    .from('planos_periodos')
    .select('id, data_inicio, data_fim')
    .eq('aluno_id', periodo.aluno_id)
    .neq('id', input.periodoId)
  if (outrosError) throw new Error(outrosError.message)

  const novaDataFimDate = new Date(`${novaDataInicio}T00:00:00`)
  novaDataFimDate.setDate(novaDataFimDate.getDate() + 30)
  const novaDataFim = isoDate(novaDataFimDate)

  const sobrepoe = (outrosPeriodos || []).some(p => novaDataInicio <= p.data_fim && novaDataFim >= p.data_inicio)
  if (sobrepoe) throw new Error('Essa data faz esse período se sobrepor a outro período já registrado do aluno. Ajuste ou remova o outro período primeiro.')

  const hoje = isoDate(new Date())
  const novoStatus = novaDataInicio <= hoje ? 'ativo' : 'agendado'

  const { data: atualizado, error: updateError } = await supabase
    .from('planos_periodos')
    .update({ data_inicio: novaDataInicio, data_fim: novaDataFim, status: novoStatus })
    .eq('id', input.periodoId)
    .select('id, data_inicio, data_fim, status')
    .single()
  if (updateError || !atualizado) throw new Error(updateError?.message || 'não foi possível atualizar o período')

  return { periodoId: atualizado.id, dataInicio: atualizado.data_inicio, dataFim: atualizado.data_fim, status: atualizado.status }
}

type ExcluirPeriodoResult = {
  periodoId: string
  eraVigenteHoje: boolean
}

// Exclui um período (contrato) do histórico do aluno. Não mexe em status_plano
// nem em pagamentos -- só remove o registro do período. Usado pra limpar
// contratos antigos/errados. Passa sempre por aqui (nunca DELETE direto em
// planos_periodos), mesma regra de autoridade central do resto do arquivo.
export async function excluirPeriodo(periodoId: string): Promise<ExcluirPeriodoResult> {
  const supabase = serviceClient()

  const { data: periodo, error: periodoError } = await supabase
    .from('planos_periodos')
    .select('id, data_inicio, data_fim')
    .eq('id', periodoId)
    .single()
  if (periodoError || !periodo) throw new Error(periodoError?.message || 'período não encontrado')

  const hoje = isoDate(new Date())
  const eraVigenteHoje = periodo.data_inicio <= hoje && periodo.data_fim >= hoje

  const { error: deleteError } = await supabase
    .from('planos_periodos')
    .delete()
    .eq('id', periodoId)
  if (deleteError) throw new Error(deleteError.message)

  return { periodoId, eraVigenteHoje }
}
