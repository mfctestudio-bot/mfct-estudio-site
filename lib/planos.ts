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

  return { pagamentoId, periodoId: periodo.id, dataInicio, dataFim }
}