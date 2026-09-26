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
    .select('id, nome, telefone')
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
  let statusEsperado: string | null = null

  if (pagamentoId) {
    const { data: pagamento, error } = await supabase
      .from('pagamentos')
      .select('*')
      .eq('id', pagamentoId)
      .eq('aluno_id', input.alunoId)
      .single()
    if (error || !pagamento) throw new Error(error?.message || 'pagamento não encontrado para o aluno')

    // Correcao (23/09/2026): faltava travar contra confirmar o mesmo pagamento duas vezes
    // (duplo-clique, duas abas abertas, ou clique + F5). Sem isso, a segunda chamada
    // recriava um segundo periodo pro mesmo pagamento, bagunçando o vencimento do aluno.
    if (pagamento.status === 'pago') {
      throw new Error('Esse pagamento já foi confirmado antes -- não dá pra ativar o plano de novo pra ele (evita duplicar o período). Atualize a tela.')
    }
    statusEsperado = pagamento.status
  } else {
    // Correcao (23/09/2026): mesma corrida do caso acima, mas pra ativação SEM um pagamento
    // existente (ex.: primeira mensalidade de um aluno novo). Aqui não há linha de pagamento
    // pra travar por status, então a trava é: não deixar nascer um segundo período com a
    // MESMA data de início pro mesmo aluno -- se duas chamadas concorrentes calcularam o
    // mesmo dataInicio (porque nenhuma tinha commitado ainda), a segunda é barrada aqui.
    const { data: possivelDuplicado } = await supabase
      .from('planos_periodos')
      .select('id')
      .eq('aluno_id', input.alunoId)
      .eq('data_inicio', dataInicio)
      .maybeSingle()
    if (possivelDuplicado) {
      throw new Error('Já existe um período começando nessa mesma data pra esse aluno -- parece um clique duplicado. Atualize a tela antes de tentar de novo.')
    }
  }

  // Correcao (25/09/2026): antes, pagamento -> periodo -> aluno eram 3 escritas separadas
  // (3 idas e voltas ao banco). Se o servidor fosse interrompido entre a 1a e a 2a (timeout,
  // etc.), o pagamento ficava "pago" mas o periodo nunca nascia -- e foi exatamente o que
  // aconteceu com a Larissa e a Ivanilda em 24/09/2026 (o rollback manual que existia aqui
  // nunca chegava a rodar, porque a funcao inteira ja tinha sido cortada). Agora as 3
  // escritas acontecem dentro de UMA UNICA transacao no banco (funcao ativar_plano_tx):
  // ou as 3 acontecem juntas, ou nenhuma acontece. Elimina esse jeito de quebrar de vez.
  const { data: resultado, error: rpcError } = await supabase
    .rpc('ativar_plano_tx', {
      p_aluno_id: input.alunoId,
      p_plano_id: input.planoId,
      p_pagamento_id: pagamentoId || null,
      p_status_esperado: statusEsperado,
      p_valor: input.valor,
      p_valor_original: input.valorOriginal,
      p_desconto: input.desconto,
      p_data_pagamento: dataPagamento.toISOString(),
      p_data_vencimento: dataVencimento.toISOString().slice(0, 10),
      p_metodo_pagamento: input.metodoPagamento || 'manual',
      p_observacao: input.observacao || null,
      p_data_inicio: dataInicio,
      p_data_fim: dataFim,
      p_status_periodo: statusPeriodo,
      p_dia_vencimento: Number(input.dataPagamento.slice(8, 10)),
    })
    .single()

  if (rpcError) {
    if (rpcError.message?.includes('pagamento_ja_confirmado')) {
      throw new Error('Esse pagamento já foi confirmado por outra ação ao mesmo tempo -- nada foi duplicado, só atualize a tela.')
    }
    throw new Error(rpcError.message)
  }
  if (!resultado) throw new Error('não foi possível ativar o plano')

  const rpcResultado = resultado as { pagamento_id: string; periodo_id: string }
  pagamentoId = rpcResultado.pagamento_id
  const periodoId = rpcResultado.periodo_id

  if (!pagamentoId) throw new Error('pagamentoId ausente após criação/atualização do pagamento')

  // Correcao (23/09/2026): ate aqui, quando um pagamento era confirmado, o aluno nao recebia
  // nenhum aviso -- so descobria que o plano estava ativo se perguntasse pra Elen ou aparecesse
  // pra treinar. Agora avisa automaticamente que o pagamento foi confirmado e ate quando o plano
  // vale. Best-effort (enviarWhatsAppAluno engole erro), nunca pode travar a ativacao do plano.
  if (aluno.telefone) {
    const dataFimFmt = new Date(`${dataFim}T00:00:00`).toLocaleDateString('pt-BR')
    const primeiroNome = aluno.nome ? aluno.nome.split(' ')[0] : ''
    await enviarWhatsAppAluno(
      aluno.telefone,
      `Oi${primeiroNome ? `, ${primeiroNome}` : ''}! Recebi seu pagamento e seu plano no MFCT Estúdio já está confirmado e ativo até ${dataFimFmt}. Bons treinos! 💪`
    )
  }

  return { pagamentoId, periodoId, dataInicio, dataFim }
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

  export const DIAS_CARENCIA_VENCIMENTO = 3

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

// Decisao de negocio (22/09/2026, a pedido do Matheus): acesso a horario (fixo
// ou avulso) so continua com matricula ativa + periodo vigente -- sem carencia
// de acesso. O que existe e uma carencia curta so pra CANCELAR o plano de vez
// (liberar a vaga pra outro aluno), dando um tempinho pro pagamento cair.
//
// Dois estagios, os dois decididos SO AQUI (unica autoridade -- antes existia
// um robo separado no n8n que tambem mexia em status_plano por conta propria,
// e como ele rodava mais tarde que este cron, ele pisava na carencia e ainda
// deixava o aluno preso em "vencido" pra sempre, sem nunca cancelar de verdade
// nem liberar a agenda. Esse robo foi corrigido pra parar de mexer em
// status_plano e so cuidar do aviso de renovacao):
//
//   1) ATIVO -> VENCIDO: no primeiro dia em que nenhum periodo cobre hoje.
//      A partir daqui o aluno ja aparece pra cobranca (robo de cobranca
//      automatica), mesmo sem ter passado nenhum dia de carencia.
//   2) VENCIDO -> CANCELADO: depois de `diasCarencia` dias vencido sem
//      renovar, cancela de vez e libera a agenda (mesmo efeito do
//      cancelamento manual) -- so entao o aluno some das telas de cobranca.
export async function verificarVencimentos(
  diasCarencia = DIAS_CARENCIA_VENCIMENTO,
  supabaseClient?: SupabaseClient,
  ): Promise<VerificarVencimentosResult> {
  const supabase = supabaseClient || serviceClient()
  const hojeIso = hojeISOSaoPaulo()

const { data: alunosRelevantes, error: alunosError } = await supabase
  .from('alunos')
  .select('id, status_plano, status_desde, nome, telefone')
  .in('status_plano', ['ativo', 'vencido'])
  if (alunosError) throw new Error(alunosError.message)

const cancelados: VerificarVencimentosResult['cancelados'] = []
  const avisos: string[] = []
  const alunoIds = (alunosRelevantes || []).map(a => a.id)
  if (alunoIds.length === 0) return { verificados: 0, cancelados, avisos }

const { data: periodos, error: periodosError } = await supabase
  .from('planos_periodos')
  .select('aluno_id, data_inicio, data_fim, status')
  .in('aluno_id', alunoIds)
  .order('data_fim', { ascending: false })
  if (periodosError) throw new Error(periodosError.message)

const periodosPorAluno = new Map<string, { data_inicio: string; data_fim: string; status: string }[]>()
  for (const periodo of periodos || []) {
    const lista = periodosPorAluno.get(periodo.aluno_id) || []
    lista.push({ data_inicio: periodo.data_inicio, data_fim: periodo.data_fim, status: periodo.status })
    periodosPorAluno.set(periodo.aluno_id, lista)
  }

for (const aluno of alunosRelevantes || []) {
  const alunoId = aluno.id
  const listaPeriodos = periodosPorAluno.get(alunoId) || []

  // Hoje esta coberto por algum periodo (passado, atual ou ja agendado)? entao esta em dia,
  // mesmo que exista tambem um periodo futuro ja cadastrado. Um periodo 'pendente'
  // (Cenario B -- renovacao criada mas pagamento ainda nao confirmado) NUNCA conta como
  // cobertura, mesmo que a data dele ja cubra hoje (correcao 25/09/2026).
  const coberto = listaPeriodos.some(p => p.status !== 'pendente' && p.data_inicio <= hojeIso && p.data_fim >= hojeIso)
  if (coberto) {
    if (aluno.status_plano === 'vencido') {
      // Reconciliacao de seguranca: nao deveria acontecer (renovar via ativarPlano ja bota
      // 'ativo' direto), mas se por algum motivo o periodo passou a cobrir hoje enquanto o
      // aluno ainda estava marcado vencido, corrige.
      await supabase.from('alunos').update({ status_plano: 'ativo' }).eq('id', alunoId).eq('status_plano', 'vencido')
      avisos.push(`aluno ${alunoId}: tinha periodo cobrindo hoje mas estava 'vencido' -- corrigido pra 'ativo'`)
    }
    continue
  }

  // Nao ha periodo cobrindo hoje. Estagio 1: ainda 'ativo' -> vira 'vencido' hoje mesmo,
  // sem carencia de acesso (matricula ativa + periodo vigente = direito de treinar).
  if (aluno.status_plano === 'ativo') {
    const { error: updateError } = await supabase
      .from('alunos')
      .update({ status_plano: 'vencido', status_desde: hojeIso })
      .eq('id', alunoId)
      .eq('status_plano', 'ativo') // evita corrida com uma renovacao/alteracao concorrente
    if (updateError) {
      avisos.push(`aluno ${alunoId}: ${updateError.message}`)
    } else {
      avisos.push(`aluno ${alunoId}: sem periodo cobrindo hoje -- marcado vencido`)
    }
    continue
  }

  // Estagio 2: ja estava 'vencido'. So cancela de vez depois de `diasCarencia` dias
  // vencido, contados a partir de quando ficou vencido (status_desde).
  const desde = aluno.status_desde || hojeIso
  const dias = diasVencido(desde, hojeIso)
  if (dias < diasCarencia) continue // vencido, mas ainda dentro do prazo de tolerancia pra pagar

  const { error: updateError } = await supabase
  .from('alunos')
  .update({ status_plano: 'cancelado' })
  .eq('id', alunoId)
  .eq('status_plano', 'vencido') // evita corrida com uma renovacao/alteracao de status concorrente
  .select('id')
  .single()
  if (updateError) {
    avisos.push(`aluno ${alunoId}: ${updateError.message}`)
    continue
  }

  const liberacao = await liberarAgendaDoAluno(supabase, alunoId)
  avisos.push(...liberacao.avisos)
  cancelados.push({ alunoId, dataFim: desde, diasVencido: dias })

  // Avisa o aluno que o plano foi cancelado por falta de pagamento -- mesmo padrao
  // ja usado em verificarPausasExpiradas pra pausa cancelada por prazo. Sem isso,
  // o aluno so descobria que perdeu acesso quando tentasse agendar de novo.
  if (aluno.telefone) {
    await enviarWhatsAppAluno(
      aluno.telefone,
      `Oi${aluno.nome ? `, ${aluno.nome.split(' ')[0]}` : ''}! Sua mensalidade no MFCT Estúdio está vencida há ${dias} dias e o plano foi cancelado -- por isso o acesso aos horários (fixo ou avulso) fica em espera. Pra voltar a treinar é só regularizar o pagamento que eu já libero de novo. Qualquer dúvida me chama por aqui! 💪`
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
    .select('id, aluno_id, status')
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
  // Correcao (25/09/2026): um periodo 'pendente' (Cenario B, pagamento ainda nao
  // confirmado) tem que continuar pendente mesmo depois de corrigir a data -- so
  // confirmarPagamentoPendente() pode tirar ele do pendente. Sem isso, so corrigir
  // a data de um periodo pendente ja liberava o acesso sem o pagamento ser confirmado.
  const novoStatus = periodo.status === 'pendente' ? 'pendente' : (novaDataInicio <= hoje ? 'ativo' : 'agendado')

  const { data: atualizado, error: updateError } = await supabase
    .from('planos_periodos')
    .update({ data_inicio: novaDataInicio, data_fim: novaDataFim, status: novoStatus })
    .eq('id', input.periodoId)
    .select('id, data_inicio, data_fim, status')
    .single()
  if (updateError || !atualizado) throw new Error(updateError?.message || 'não foi possível atualizar o período')

  return { periodoId: atualizado.id, dataInicio: atualizado.data_inicio, dataFim: atualizado.data_fim, status: atualizado.status }
}

export type RepararPeriodoResult = {
  periodoId: string
  dataInicio: string
  dataFim: string
  jaExistia: boolean
}

// Reparo manual (25/09/2026): achamos pagamentos com status='pago' e confirmado_em
// preenchido, mas SEM nenhum planos_periodos correspondente -- ou seja, o dinheiro
// foi registrado mas o plano nunca foi de fato renovado (a aula continuava marcando
// vencimento antigo). Causa exata ainda nao confirmada (suspeita de timeout do
// servidor entre o INSERT do pagamento e o INSERT do periodo, sem der tempo do
// rollback automatico rodar). Esta funcao conserta so esse buraco especifico:
// não mexe em nada que já esteja certo, e usa exatamente a mesma conta de datas
// que ativarPlano() usaria (30 dias a partir de onde o ultimo periodo do aluno
// parou de cobrir, ou a partir da data do pagamento se não havia período anterior).
// Não é uma porta lateral nova: continua dentro de lib/planos.ts, e só cria o que
// ativarPlano() já deveria ter criado para aquele pagamento específico.
export async function repararPeriodoPagamento(pagamentoId: string): Promise<RepararPeriodoResult> {
  const supabase = serviceClient()

  const { data: pagamento, error: pagamentoError } = await supabase
    .from('pagamentos')
    .select('id, aluno_id, data_pagamento, status')
    .eq('id', pagamentoId)
    .single()
  if (pagamentoError || !pagamento) throw new Error(pagamentoError?.message || 'pagamento não encontrado')
  if (pagamento.status !== 'pago') throw new Error('esse pagamento não está com status "pago" -- nada a reparar')

  const { data: periodoExistente, error: existenteError } = await supabase
    .from('planos_periodos')
    .select('id, data_inicio, data_fim')
    .eq('pagamento_id', pagamentoId)
    .maybeSingle()
  if (existenteError) throw new Error(existenteError.message)
  if (periodoExistente) {
    return { periodoId: periodoExistente.id, dataInicio: periodoExistente.data_inicio, dataFim: periodoExistente.data_fim, jaExistia: true }
  }

  const dataPagamentoIso = isoDate(new Date(pagamento.data_pagamento))

  // Mesmo período "mais recente" que ativarPlano() teria olhado antes de criar este.
  const { data: outrosPeriodos, error: outrosError } = await supabase
    .from('planos_periodos')
    .select('id, data_fim')
    .eq('aluno_id', pagamento.aluno_id)
    .neq('pagamento_id', pagamentoId)
    .order('data_fim', { ascending: false })
    .limit(1)
  if (outrosError) throw new Error(outrosError.message)
  const ultimoPeriodo = (outrosPeriodos || [])[0] || null

  let dataInicio = dataPagamentoIso
  if (ultimoPeriodo) {
    const fimUltimo = new Date(`${ultimoPeriodo.data_fim}T00:00:00`)
    const dataPagDate = new Date(`${dataPagamentoIso}T00:00:00`)
    if (fimUltimo >= dataPagDate) {
      fimUltimo.setDate(fimUltimo.getDate() + 1)
      dataInicio = isoDate(fimUltimo)
    }
  }

  const dataFimDate = new Date(`${dataInicio}T00:00:00`)
  dataFimDate.setDate(dataFimDate.getDate() + 30)
  const dataFim = isoDate(dataFimDate)
  const hoje = isoDate(new Date())
  const status = dataInicio <= hoje ? 'ativo' : 'agendado'

  const { data: periodo, error: periodoError } = await supabase
    .from('planos_periodos')
    .insert({ aluno_id: pagamento.aluno_id, pagamento_id: pagamentoId, data_inicio: dataInicio, data_fim: dataFim, status })
    .select('id')
    .single()
  if (periodoError || !periodo) throw new Error(periodoError?.message || 'não foi possível criar o período')

  const { data: aluno } = await supabase.from('alunos').select('nome, telefone').eq('id', pagamento.aluno_id).single()
  if (aluno?.telefone) {
    const dataFimFmt = new Date(`${dataFim}T00:00:00`).toLocaleDateString('pt-BR')
    const primeiroNome = aluno.nome ? aluno.nome.split(' ')[0] : ''
    await enviarWhatsAppAluno(
      aluno.telefone,
      `Oi${primeiroNome ? `, ${primeiroNome}` : ''}! Seu contrato no MFCT Estúdio foi renovado com sucesso, valendo até ${dataFimFmt}. Agradecemos demais por fazer parte da família MFCT! 💪🙏`
    )
  }

  return { periodoId: periodo.id, dataInicio, dataFim, jaExistia: false }
}

export type CriarMensalidadePendenteInput = {
  alunoId: string
  planoId: string
  valor: number
  valorOriginal: number
  desconto: number
  observacao?: string
}

export type CriarMensalidadePendenteResult = {
  pagamentoId: string
  periodoId: string
  dataInicio: string
  dataFim: string
}

// Reorganizacao Mensalidades/Pagamentos (25/09/2026) -- CENARIO B do fluxo de renovacao:
// cria a mensalidade (periodo) e o pagamento correspondente, os dois como PENDENTE, numa
// unica transacao no banco (mesma logica de atomicidade do ativarPlano()). O aluno NAO e
// liberado aqui -- status_plano so muda quando o pagamento for confirmado de fato, em
// confirmarPagamentoPendente(). O pagamento pendente aparece na hora em Financeiro ->
// Pagamentos, esperando confirmacao.
export async function criarMensalidadePendente(input: CriarMensalidadePendenteInput): Promise<CriarMensalidadePendenteResult> {
  const supabase = serviceClient()

  const { data: ultimoPeriodo, error: periodoError } = await supabase
    .from('planos_periodos')
    .select('id, data_fim')
    .eq('aluno_id', input.alunoId)
    .order('data_fim', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (periodoError) throw new Error(periodoError.message)

  const hoje = isoDate(new Date())
  let dataInicio = hoje
  if (ultimoPeriodo) {
    const fimUltimo = new Date(`${ultimoPeriodo.data_fim}T00:00:00`)
    const hojeDate = new Date(`${hoje}T00:00:00`)
    if (fimUltimo >= hojeDate) {
      fimUltimo.setDate(fimUltimo.getDate() + 1)
      dataInicio = isoDate(fimUltimo)
    }
  }
  const dataFimDate = new Date(`${dataInicio}T00:00:00`)
  dataFimDate.setDate(dataFimDate.getDate() + 30)
  const dataFim = isoDate(dataFimDate)

  const dataVencimento = new Date(`${dataInicio}T12:00:00`)
  dataVencimento.setMonth(dataVencimento.getMonth() + 1)

  const { data: resultado, error } = await supabase
    .rpc('criar_mensalidade_pendente_tx', {
      p_aluno_id: input.alunoId,
      p_plano_id: input.planoId,
      p_valor: input.valor,
      p_valor_original: input.valorOriginal,
      p_desconto: input.desconto,
      p_data_vencimento: dataVencimento.toISOString().slice(0, 10),
      p_observacao: input.observacao || null,
      p_data_inicio: dataInicio,
      p_data_fim: dataFim,
    })
    .single()
  if (error) throw new Error(error.message)
  if (!resultado) throw new Error('não foi possível criar a mensalidade pendente')

  const r = resultado as { pagamento_id: string; periodo_id: string }
  return { pagamentoId: r.pagamento_id, periodoId: r.periodo_id, dataInicio, dataFim }
}

export type ConfirmarPagamentoPendenteInput = {
  pagamentoId: string
  dataPagamento: string
  metodoPagamento?: string
}

export type ConfirmarPagamentoPendenteResult = {
  pagamentoId: string
  periodoId: string
  dataInicio: string
  dataFim: string
}

// CENARIO B (continuacao): confirma um pagamento que estava pendente. Muda o MESMO
// periodo que ja existia (pendente -> ativo/agendado) -- nunca cria um segundo periodo
// pro mesmo pagamento. Libera o aluno (status_plano='ativo') so agora, na confirmacao.
export async function confirmarPagamentoPendente(input: ConfirmarPagamentoPendenteInput): Promise<ConfirmarPagamentoPendenteResult> {
  const supabase = serviceClient()
  const dataPagamento = new Date(`${input.dataPagamento}T12:00:00`)
  if (Number.isNaN(dataPagamento.getTime())) throw new Error('data de pagamento inválida')

  const { data: pagamento, error: pagamentoError } = await supabase
    .from('pagamentos')
    .select('id, aluno_id')
    .eq('id', input.pagamentoId)
    .single()
  if (pagamentoError || !pagamento) throw new Error(pagamentoError?.message || 'pagamento não encontrado')

  const { data: aluno, error: alunoError } = await supabase
    .from('alunos')
    .select('id, nome, telefone')
    .eq('id', pagamento.aluno_id)
    .single()
  if (alunoError || !aluno) throw new Error(alunoError?.message || 'aluno não encontrado')

  const { data: resultado, error } = await supabase
    .rpc('confirmar_pagamento_pendente_tx', {
      p_pagamento_id: input.pagamentoId,
      p_metodo_pagamento: input.metodoPagamento || 'manual',
      p_data_pagamento: dataPagamento.toISOString(),
      p_dia_vencimento: Number(input.dataPagamento.slice(8, 10)),
    })
    .single()
  if (error) {
    if (error.message?.includes('pagamento_nao_esta_pendente')) {
      throw new Error('Esse pagamento não está mais pendente (já foi confirmado ou removido) -- atualize a tela.')
    }
    throw new Error(error.message)
  }
  if (!resultado) throw new Error('não foi possível confirmar o pagamento')

  const r = resultado as { pagamento_id: string; periodo_id: string; data_inicio: string; data_fim: string; status_periodo: string }

  if (aluno.telefone) {
    const dataFimFmt = new Date(`${r.data_fim}T00:00:00`).toLocaleDateString('pt-BR')
    const primeiroNome = aluno.nome ? aluno.nome.split(' ')[0] : ''
    await enviarWhatsAppAluno(
      aluno.telefone,
      `Oi${primeiroNome ? `, ${primeiroNome}` : ''}! Recebi seu pagamento e seu plano no MFCT Estúdio já está confirmado e ativo até ${dataFimFmt}. Bons treinos! 💪`
    )
  }

  return { pagamentoId: r.pagamento_id, periodoId: r.periodo_id, dataInicio: r.data_inicio, dataFim: r.data_fim }
}

export type EstornarPagamentoResult = {
  pagamentoId: string
  periodoRemovidoId: string | null
  alunoMarcadoVencido: boolean
}

// Estorna um pagamento PAGO: preserva o historico (status='estornado', o valor e a data
// continuam registrados), mas remove o periodo de acesso que esse pagamento tinha
// liberado -- o dinheiro voltou, entao o acesso concedido por ele nao vale mais. Se esse
// periodo era o que cobria hoje, o aluno ja volta pra 'vencido' na hora.
export async function estornarPagamento(pagamentoId: string): Promise<EstornarPagamentoResult> {
  const supabase = serviceClient()
  const { data: resultado, error } = await supabase
    .rpc('estornar_pagamento_tx', { p_pagamento_id: pagamentoId })
    .single()
  if (error) {
    if (error.message?.includes('pagamento_nao_esta_pago')) {
      throw new Error('Só dá pra estornar um pagamento que está com status "Pago".')
    }
    throw new Error(error.message)
  }
  if (!resultado) throw new Error('não foi possível estornar o pagamento')
  const r = resultado as { pagamento_id: string; periodo_removido_id: string | null; aluno_marcado_vencido: boolean }
  return { pagamentoId: r.pagamento_id, periodoRemovidoId: r.periodo_removido_id, alunoMarcadoVencido: r.aluno_marcado_vencido }
}

export type EditarValorMensalidadeResult = {
  pagamentoId: string
  valor: number
  desconto: number
}

// Edicao de valor da mensalidade (Financeiro -> Mensalidades -> Aluno). So corrige o
// valor/desconto do pagamento JA existente relacionado aquele periodo -- nunca cria um
// segundo pagamento (regra de consistencia do pedido de reorganizacao). Funciona tanto
// pro pagamento ainda pendente quanto pro ja pago (correcao pontual, ex.: desconto dado
// depois -- preserva o historico, so ajusta o valor).
export async function editarValorMensalidade(pagamentoId: string, novoValor: number, novoDesconto: number): Promise<EditarValorMensalidadeResult> {
  const supabase = serviceClient()
  const { data: atualizado, error } = await supabase
    .from('pagamentos')
    .update({ valor: novoValor, desconto: novoDesconto })
    .eq('id', pagamentoId)
    .select('id, valor, desconto')
    .single()
  if (error || !atualizado) throw new Error(error?.message || 'não foi possível atualizar o valor da mensalidade')
  return { pagamentoId: atualizado.id, valor: Number(atualizado.valor), desconto: Number(atualizado.desconto || 0) }
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
