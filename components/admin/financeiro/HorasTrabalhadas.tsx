'use client'
// Horas trabalhadas / pagamento de professores.
// Movido de app/admin/financeiro/page.tsx sem mudar a lógica (02/10/2026).
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseAdmin'
import { carregarConfigPagamentoProfessores, sessaoContaParaPagamento } from './folhaProfessores'
import { CardNumero as Card } from './CardNumero'

type Sessao = {
  data: string
  horarioId: string
  horarioLabel: string
  diaSemanaLabel: string
  motivo: 'confirmada' | 'cancelada_estudio' | 'cancelada_aluno'
}

type LinhaHoras = {
  professorId: string
  nome: string
  ativo: boolean
  valorPorAula: number
  sessoesSemana: Sessao[]
  sessoesMes: Sessao[]
  faltasMesDetalhe: Sessao[]
}

const DIAS_ABREV_HORAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function segundaDaSemanaHoras(ref: Date) {
  const d = new Date(ref)
  const diaSemana = d.getDay() // 0=dom..6=sáb
  const diff = diaSemana === 0 ? -6 : 1 - diaSemana
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function HorasTrabalhadas() {
  const [loading, setLoading] = useState(true)
  const [linhas, setLinhas] = useState<LinhaHoras[]>([])
  const [semProfessor, setSemProfessor] = useState({ sessoesSemana: 0, sessoesMes: 0 })
  const [expandido, setExpandido] = useState<string | null>(null)
  const [marcando, setMarcando] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const hoje = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
    hoje.setHours(0, 0, 0, 0)

    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    const inicioSemana = segundaDaSemanaHoras(hoje)
    const inicioBusca = inicioSemana < inicioMes ? inicioSemana : inicioMes

    const fmtISO = (d: Date) => d.toISOString().slice(0, 10)

    const [{ data: profData }, { data: horData }, { data: agData }, { data: faltasData }, config] = await Promise.all([
      supabase.from('professores').select('id, nome, ativo, valor_por_aula'),
      supabase.from('horarios').select('id, professor_id, horario, dia_semana'),
      supabase
        .from('agendamentos')
        .select('data, status, cancelado_por, tipo, horario_id')
        .in('tipo', ['aula', 'experimental'])
        .gte('data', fmtISO(inicioBusca))
        .lte('data', fmtISO(hoje)),
      supabase
        .from('professor_faltas')
        .select('professor_id, data, horario_id')
        .gte('data', fmtISO(inicioBusca))
        .lte('data', fmtISO(hoje)),
      carregarConfigPagamentoProfessores(),
    ])

    const mapaHorario = new Map<string, { professorId: string | null; horario: string; diaSemana: number }>()
    for (const h of horData || []) {
      mapaHorario.set(h.id, { professorId: h.professor_id, horario: h.horario, diaSemana: h.dia_semana })
    }

    const inicioMesISO = fmtISO(inicioMes)
    const inicioSemanaISO = fmtISO(inicioSemana)

    // Sessões distintas (data + horário) por professor — não conta aluno duplicado na mesma aula.
    // Conta aulas confirmadas e, conforme a regra configurada, aulas canceladas também.
    const sessoesPorProfessor = new Map<string, Map<string, Sessao>>()
    let semProfSemana = new Set<string>()
    let semProfMes = new Set<string>()

    for (const a of agData || []) {
      if (!sessaoContaParaPagamento(a.status, a.cancelado_por, config)) continue
      const info = mapaHorario.get(a.horario_id)
      const chave = `${a.data}_${a.horario_id}`
      if (!info || !info.professorId) {
        if (a.data >= inicioSemanaISO) semProfSemana.add(chave)
        if (a.data >= inicioMesISO) semProfMes.add(chave)
        continue
      }
      const motivo: Sessao['motivo'] = a.status === 'confirmado'
        ? 'confirmada'
        : (a.cancelado_por || 'aluno') === 'estudio' ? 'cancelada_estudio' : 'cancelada_aluno'
      if (!sessoesPorProfessor.has(info.professorId)) sessoesPorProfessor.set(info.professorId, new Map())
      sessoesPorProfessor.get(info.professorId)!.set(chave, {
        data: a.data,
        horarioId: a.horario_id,
        horarioLabel: info.horario.slice(0, 5),
        diaSemanaLabel: DIAS_ABREV_HORAS[info.diaSemana],
        motivo,
      })
    }

    const faltasPorProfessor = new Map<string, Set<string>>()
    for (const f of faltasData || []) {
      const chave = `${f.data}_${f.horario_id}`
      if (!faltasPorProfessor.has(f.professor_id)) faltasPorProfessor.set(f.professor_id, new Set())
      faltasPorProfessor.get(f.professor_id)!.add(chave)
    }

    const resultado: LinhaHoras[] = (profData || []).map(p => {
      const todasSessoes = [...(sessoesPorProfessor.get(p.id)?.values() || [])]
      const faltas = faltasPorProfessor.get(p.id) || new Set<string>()
      const sessoesValidas = todasSessoes.filter(s => !faltas.has(`${s.data}_${s.horarioId}`))
      const faltasDetalhe = todasSessoes.filter(s => faltas.has(`${s.data}_${s.horarioId}`) && s.data >= inicioMesISO)
      return {
        professorId: p.id,
        nome: p.nome,
        ativo: p.ativo,
        valorPorAula: Number(p.valor_por_aula),
        sessoesMes: sessoesValidas.filter(s => s.data >= inicioMesISO).sort((a, b) => b.data.localeCompare(a.data)),
        sessoesSemana: sessoesValidas.filter(s => s.data >= inicioSemanaISO),
        faltasMesDetalhe: faltasDetalhe.sort((a, b) => b.data.localeCompare(a.data)),
      }
    })

    setLinhas(resultado)
    setSemProfessor({
      sessoesSemana: [...semProfSemana].filter(k => k.split('_')[0] >= inicioSemanaISO).length,
      sessoesMes: semProfMes.size,
    })
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function marcarFalta(professorId: string, sessao: Sessao) {
    setMarcando(`${sessao.data}_${sessao.horarioId}`)
    await supabase.from('professor_faltas').insert({
      professor_id: professorId,
      horario_id: sessao.horarioId,
      data: sessao.data,
    })
    await load()
    setMarcando(null)
  }

  async function desmarcarFalta(professorId: string, sessao: Sessao) {
    setMarcando(`${sessao.data}_${sessao.horarioId}`)
    await supabase
      .from('professor_faltas')
      .delete()
      .eq('professor_id', professorId)
      .eq('horario_id', sessao.horarioId)
      .eq('data', sessao.data)
    await load()
    setMarcando(null)
  }

  if (loading) return <p className="vazio">Carregando...</p>

  const totalValorMes = linhas.reduce((s, l) => s + l.sessoesMes.length * l.valorPorAula, 0)
  const totalValorSemana = linhas.reduce((s, l) => s + l.sessoesSemana.length * l.valorPorAula, 0)

  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
        Calculado por aula dada (uma sessão com vários alunos ainda conta como 1 hora). Aulas canceladas entram ou não conforme as regras em Configurações → Professores → Regras de pagamento em cancelamento. Se o professor faltou numa aula específica, abra &quot;Ver aulas do mês&quot; e marque a falta — ela sai do cálculo e das Despesas fixas do Caixa na hora.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        <Card label="A pagar essa semana" value={`R$ ${totalValorSemana.toFixed(2)}`} />
        <Card label="A pagar esse mês" value={`R$ ${totalValorMes.toFixed(2)}`} accent="var(--danger)" />
      </div>

      {linhas.length === 0 ? (
        <p style={{ color: 'var(--text2)', fontSize: 13 }}>Nenhum professor cadastrado ainda.</p>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {linhas.map(l => {
            const aberto = expandido === l.professorId
            return (
              <div key={l.professorId} className="card card-hover" style={{
                padding: '14px 16px', opacity: l.ativo ? 1 : 0.55,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>
                    {l.nome}{!l.ativo && <span style={{ fontSize: 11, color: 'var(--danger)', marginLeft: 6 }}>(inativo)</span>}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>R$ {l.valorPorAula.toFixed(2)}/aula</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 10 }}>
                  <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Essa semana</div>
                    <div style={{ fontSize: 13 }}>{l.sessoesSemana.length} aula{l.sessoesSemana.length === 1 ? '' : 's'} · {l.sessoesSemana.length}h</div>
                    <div style={{ fontFamily: 'Anton, sans-serif', fontSize: 18, color: 'var(--accent)', marginTop: 2 }}>R$ {(l.sessoesSemana.length * l.valorPorAula).toFixed(2)}</div>
                  </div>
                  <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Esse mês</div>
                    <div style={{ fontSize: 13 }}>{l.sessoesMes.length} aula{l.sessoesMes.length === 1 ? '' : 's'} · {l.sessoesMes.length}h</div>
                    <div style={{ fontFamily: 'Anton, sans-serif', fontSize: 18, color: 'var(--accent)', marginTop: 2 }}>R$ {(l.sessoesMes.length * l.valorPorAula).toFixed(2)}</div>
                  </div>
                </div>

                <button
                  onClick={() => setExpandido(aberto ? null : l.professorId)}
                  className="btn btn-ghost btn-sm"
                >
                  {aberto ? '▲ Esconder aulas do mês' : `▼ Ver aulas do mês (${l.sessoesMes.length}${l.faltasMesDetalhe.length > 0 ? ` + ${l.faltasMesDetalhe.length} falta(s)` : ''})`}
                </button>

                {aberto && (
                  <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                    {l.sessoesMes.length === 0 ? (
                      <p style={{ fontSize: 12, color: 'var(--text3)' }}>Nenhuma aula esse mês.</p>
                    ) : (
                      <div style={{ display: 'grid', gap: 6 }}>
                        {l.sessoesMes.map(s => {
                          const chave = `${s.data}_${s.horarioId}`
                          const dataFmt = new Date(s.data + 'T12:00:00').toLocaleDateString('pt-BR')
                          return (
                            <div key={chave} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '4px 0' }}>
                              <span>
                                {s.diaSemanaLabel} {dataFmt} às {s.horarioLabel}
                                {s.motivo !== 'confirmada' && (
                                  <span style={{ fontSize: 10, color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: 4, padding: '1px 5px', marginLeft: 6 }}>
                                    {s.motivo === 'cancelada_estudio' ? 'cancelada pelo estúdio · paga' : 'cancelada pelo aluno · paga'}
                                  </span>
                                )}
                              </span>
                              <button
                                onClick={() => marcarFalta(l.professorId, s)}
                                disabled={marcando === chave}
                                className="btn btn-outline-danger btn-sm"
                              >
                                {marcando === chave ? '...' : 'Professor faltou'}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {l.faltasMesDetalhe.length > 0 && (
                      <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px dashed var(--border)' }}>
                        <div style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Faltas marcadas (não contam no pagamento)
                        </div>
                        <div style={{ display: 'grid', gap: 6 }}>
                          {l.faltasMesDetalhe.map(s => {
                            const chave = `${s.data}_${s.horarioId}`
                            const dataFmt = new Date(s.data + 'T12:00:00').toLocaleDateString('pt-BR')
                            return (
                              <div key={chave} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '4px 0', opacity: 0.75 }}>
                                <span style={{ textDecoration: 'line-through' }}>{s.diaSemanaLabel} {dataFmt} às {s.horarioLabel}</span>
                                <button
                                  onClick={() => desmarcarFalta(l.professorId, s)}
                                  disabled={marcando === chave}
                                  style={{
                                    background: 'transparent', border: '1px solid var(--accent)', color: 'var(--accent)',
                                    borderRadius: 4, padding: '3px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                                    opacity: marcando === chave ? 0.6 : 1,
                                  }}
                                >
                                  {marcando === chave ? '...' : 'Desfazer'}
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {(semProfessor.sessoesMes > 0) && (
        <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 16 }}>
          {semProfessor.sessoesMes} aula{semProfessor.sessoesMes === 1 ? '' : 's'} esse mês {semProfessor.sessoesMes === 1 ? 'está' : 'estão'} em horário sem professor atribuído e não {semProfessor.sessoesMes === 1 ? 'entra' : 'entram'} nesse cálculo. Atribua um professor na Grade de horário geral (Agenda) pra incluir.
        </p>
      )}
    </div>
  )
}
