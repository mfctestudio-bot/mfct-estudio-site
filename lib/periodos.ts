export type PeriodoAcesso = {
  data_inicio: string
  data_fim: string
  status: string
}

export type StatusAcesso = 'ativo' | 'vencido' | 'agendado' | 'sem_periodo'

export function statusPeriodoHoje<T extends PeriodoAcesso>(periodo: T, hoje = new Date()): StatusAcesso {
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