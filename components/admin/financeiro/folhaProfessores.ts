// Cálculo do que os professores têm a receber (aulas dadas × valor por aula).
// Movido de app/admin/financeiro/page.tsx sem mudar a regra (02/10/2026).
import { supabase } from '@/lib/supabaseAdmin'

export type ConfigPagamentoProfessores = {
  pagar_quando_aluno_cancela: boolean
  pagar_quando_estudio_cancela: boolean
}

export async function carregarConfigPagamentoProfessores(): Promise<ConfigPagamentoProfessores> {
  const { data } = await supabase.from('config_pagamento_professores').select('*').eq('id', true).single()
  return (data as ConfigPagamentoProfessores) || { pagar_quando_aluno_cancela: false, pagar_quando_estudio_cancela: true }
}

export function sessaoContaParaPagamento(status: string, canceladoPor: string | null, config: ConfigPagamentoProfessores): boolean {
  if (status === 'confirmado') return true
  if (status === 'cancelado') {
    // Cancelamento sem origem registrada (ex: veio da Elen no WhatsApp, fora do painel) conta como "aluno cancelou"
    const origem = canceladoPor || 'aluno'
    return origem === 'estudio' ? config.pagar_quando_estudio_cancela : config.pagar_quando_aluno_cancela
  }
  return false
}

export async function carregarFolhaProfessoresMes(): Promise<number> {
  const hoje = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  hoje.setHours(0, 0, 0, 0)
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  const fmtISO = (d: Date) => d.toISOString().slice(0, 10)

  const [{ data: profData }, { data: horData }, { data: agData }, { data: faltasData }, config] = await Promise.all([
    supabase.from('professores').select('id, valor_por_aula'),
    supabase.from('horarios').select('id, professor_id'),
    supabase
      .from('agendamentos')
      .select('data, status, cancelado_por, tipo, horario_id')
      .in('tipo', ['aula', 'experimental'])
      .gte('data', fmtISO(inicioMes))
      .lte('data', fmtISO(hoje)),
    supabase
      .from('professor_faltas')
      .select('professor_id, data, horario_id')
      .gte('data', fmtISO(inicioMes))
      .lte('data', fmtISO(hoje)),
    carregarConfigPagamentoProfessores(),
  ])

  const mapaValor = new Map<string, number>()
  for (const p of profData || []) mapaValor.set(p.id, Number(p.valor_por_aula))
  const mapaProfessorPorHorario = new Map<string, string | null>()
  for (const h of horData || []) mapaProfessorPorHorario.set(h.id, h.professor_id)

  // Conta por SESSÃO (data + horário), não por aluno agendado — uma aula em grupo com
  // vários alunos ainda é só 1 hora de trabalho do professor. Conta aulas confirmadas e,
  // conforme a regra configurada, aulas canceladas também.
  const sessoesPorProfessor = new Map<string, Set<string>>()
  for (const a of agData || []) {
    if (!sessaoContaParaPagamento(a.status, a.cancelado_por, config)) continue
    const professorId = mapaProfessorPorHorario.get(a.horario_id)
    if (!professorId) continue
    const chave = `${a.data}_${a.horario_id}`
    if (!sessoesPorProfessor.has(professorId)) sessoesPorProfessor.set(professorId, new Set())
    sessoesPorProfessor.get(professorId)!.add(chave)
  }

  // Remove sessões marcadas como falta do professor
  for (const f of faltasData || []) {
    const chave = `${f.data}_${f.horario_id}`
    sessoesPorProfessor.get(f.professor_id)?.delete(chave)
  }

  let total = 0
  for (const [professorId, sessoes] of sessoesPorProfessor) {
    total += sessoes.size * (mapaValor.get(professorId) || 0)
  }
  return total
}
