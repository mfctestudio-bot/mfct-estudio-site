export type PeriodoAcesso = {
  data_inicio: string
  data_fim: string
  status: string
}

export type StatusAcesso = 'ativo' | 'vencido' | 'agendado' | 'pendente' | 'sem_periodo'

// Correcao (25/09/2026, reorganizacao Mensalidades/Pagamentos): um periodo com
// status='pendente' (Cenario B -- renovacao criada mas pagamento ainda nao
// confirmado) NUNCA pode contar como cobertura de acesso, mesmo que a data dele
// já cubra hoje. Por isso o status da COLUNA manda antes de olhar as datas --
// sem essa checagem, periodoAtualHoje()/periodoFuturoHoje() e a tela de
// mensalidades tratariam uma renovacao ainda nao paga como se já estivesse ativa.
export function statusPeriodoHoje<T extends PeriodoAcesso>(periodo: T, hoje = new Date()): StatusAcesso {
  if (periodo.status === 'pendente') return 'pendente'
  const hojeIso = hoje.toISOString().slice(0, 10)
  if (periodo.data_fim < hojeIso) return 'vencido'
  if (periodo.data_inicio > hojeIso) return 'agendado'
  return 'ativo'
}

export function periodoAtualHoje<T extends PeriodoAcesso>(periodos: T[], hoje = new Date()): T | null {
  const ativos = [...periodos]
    .filter(periodo => statusPeriodoHoje(periodo, hoje) === 'ativo')
  return ativos.length === 1 ? ativos[0] : null
}

export function periodoFuturoHoje<T extends PeriodoAcesso>(periodos: T[], hoje = new Date()): T | null {
  const futuros = [...periodos]
    .filter(periodo => statusPeriodoHoje(periodo, hoje) === 'agendado')
  return futuros.length === 1 ? futuros[0] : null
}
