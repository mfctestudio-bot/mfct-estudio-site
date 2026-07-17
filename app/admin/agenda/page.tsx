'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseAdmin'
import { Horario } from '@/lib/supabase'

type AgendamentoRow = {
  id: string
  data: string
  status: string
  tipo: string
  horario_id: string
  aluno_id: string
  google_event_id: string | null
  alunos: { nome: string; telefone: string | null } | null
  horarios: { dia_semana: number; horario: string } | null
}

const DIAS = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado']

export default function AgendaPage() {
  const [tab, setTab] = useState<'semana' | 'aulas' | 'grade'>('semana')

  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Agenda</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <TabButton active={tab === 'semana'} onClick={() => setTab('semana')}>Semana</TabButton>
        <TabButton active={tab === 'aulas'} onClick={() => setTab('aulas')}>Próximas aulas</TabButton>
        <TabButton active={tab === 'grade'} onClick={() => setTab('grade')}>Grade de horários</TabButton>
      </div>
      {tab === 'semana' ? <GradeSemanal /> : tab === 'aulas' ? <ProximasAulas /> : <GradeHorarios />}
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      background: active ? 'var(--accent2)' : 'transparent',
      color: active ? '#fff' : 'var(--text2)',
      border: `1px solid ${active ? 'var(--accent2)' : 'var(--border)'}`,
      borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
    }}>
      {children}
    </button>
  )
}

function hojeSP() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
}

function segundaDaSemana(ref: Date) {
  const d = new Date(ref)
  const diaSemana = d.getDay() // 0=dom..6=sáb
  const diff = diaSemana === 0 ? -6 : 1 - diaSemana
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function fmtISO(d: Date) {
  return d.toISOString().slice(0, 10)
}

function fmtBR(d: Date) {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

const DIAS_ABREV = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

function GradeSemanal() {
  const [refDate, setRefDate] = useState(() => hojeSP())
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [agendamentos, setAgendamentos] = useState<AgendamentoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [célulaAberta, setCélulaAberta] = useState<{ data: string; horarioId: string } | null>(null)

  const [alunosOpt, setAlunosOpt] = useState<{ id: string; nome: string; status_plano: string; telefone: string | null }[]>([])
  const [mostrarForm, setMostrarForm] = useState(false)
  const [alunoEscolhido, setAlunoEscolhido] = useState('')
  const [repetirSemana, setRepetirSemana] = useState(false)
  const [movendoId, setMovendoId] = useState<string | null>(null)
  const [novaDataMover, setNovaDataMover] = useState('')
  const [novoHorarioMover, setNovoHorarioMover] = useState('')
  const [salvandoMover, setSalvandoMover] = useState(false)
  const [cancelandoId, setCancelandoId] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [tipoAula, setTipoAula] = useState<'aula' | 'experimental'>('aula')
  const [salvandoAgendamento, setSalvandoAgendamento] = useState(false)

  const monday = segundaDaSemana(refDate)
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
  const domingo = weekDates[6]

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: hData } = await supabase.from('horarios').select('*').eq('ativo', true).order('horario')
      setHorarios(hData || [])

      const { data: aData } = await supabase
        .from('agendamentos')
        .select('id, data, status, tipo, horario_id, aluno_id, google_event_id, alunos(nome, telefone), horarios(dia_semana, horario)')
        .eq('status', 'confirmado')
        .gte('data', fmtISO(monday))
        .lte('data', fmtISO(domingo))
      setAgendamentos((aData as unknown as AgendamentoRow[]) || [])
      setLoading(false)
    }
    load()
  }, [fmtISO(monday)])

  async function recarregarAgendamentos() {
    const { data: aData } = await supabase
      .from('agendamentos')
      .select('id, data, status, tipo, horario_id, aluno_id, google_event_id, alunos(nome, telefone), horarios(dia_semana, horario)')
      .eq('status', 'confirmado')
      .gte('data', fmtISO(monday))
      .lte('data', fmtISO(domingo))
    setAgendamentos((aData as unknown as AgendamentoRow[]) || [])
  }

  function abrirCelula(data: string, horarioId: string) {
    setCélulaAberta({ data, horarioId })
    setMostrarForm(false)
    setAlunoEscolhido('')
    setRepetirSemana(false)
    setTipoAula('aula')
    if (alunosOpt.length === 0) {
      supabase.from('alunos').select('id, nome, status_plano, telefone').order('nome').then(({ data }) => setAlunosOpt(data || []))
    }
  }

  async function adicionarAlunoNoHorario() {
    if (!célulaAberta || !alunoEscolhido) return
    setSalvandoAgendamento(true)

    const { data: novoAgendamento } = await supabase.from('agendamentos').insert({
      aluno_id: alunoEscolhido,
      horario_id: célulaAberta.horarioId,
      data: célulaAberta.data,
      status: 'confirmado',
      tipo: tipoAula,
    }).select('id').single()

    if (repetirSemana) {
      await supabase.from('horarios_fixos').insert({
        aluno_id: alunoEscolhido,
        horario_id: célulaAberta.horarioId,
        ativo: true,
      })
    }

    // Sincroniza com o Google Calendar
    if (novoAgendamento) {
      const aluno = alunosOpt.find(a => a.id === alunoEscolhido)
      const horarioObj = horarios.find(h => h.id === célulaAberta.horarioId)
      try {
        await fetch('/api/sync-calendario', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            acao: 'criar',
            agendamento_id: novoAgendamento.id,
            aluno_nome: aluno?.nome || '',
            data: célulaAberta.data,
            horario: horarioObj?.horario?.slice(0, 5) || '',
            tipo: tipoAula,
            origem: 'admin (manual)',
          }),
        })
      } catch {}

      // Avisa o aluno que foi marcado
      if (aluno?.telefone) {
        try {
          await fetch('/api/notificar-agendamento', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              telefone: aluno.telefone,
              nome: aluno.nome,
              tipo: 'criado',
              data: célulaAberta.data,
              horario: horarioObj?.horario?.slice(0, 5) || '',
            }),
          })
        } catch {}
      }
    }

    await recarregarAgendamentos()
    setSalvandoAgendamento(false)
    setMostrarForm(false)
    setAlunoEscolhido('')
    setRepetirSemana(false)
    setTipoAula('aula')
  }

  function abrirMoverAgendamento(a: AgendamentoRow) {
    setMovendoId(a.id)
    setNovaDataMover(a.data)
    setNovoHorarioMover(a.horario_id)
  }

  async function confirmarMoverAgendamento(agendamento: AgendamentoRow) {
    if (!novaDataMover || !novoHorarioMover) return
    setSalvandoMover(true)

    const { error: erroUpdate } = await supabase.from('agendamentos').update({
      data: novaDataMover,
      horario_id: novoHorarioMover,
    }).eq('id', agendamento.id)

    if (erroUpdate) {
      setToast(`Erro ao remarcar: ${erroUpdate.message || 'já existe uma aula desse aluno nesse horário/data'}`)
      setTimeout(() => setToast(''), 4000)
      setMovendoId(null)
      setSalvandoMover(false)
      return
    }

    // Sincroniza com o Google Calendar (mesmo padrão do "remarcar" da Elen — atualiza o evento existente)
    const horarioObj = horarios.find(h => h.id === novoHorarioMover)
    try {
      await fetch('/api/sync-calendario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'criar',
          agendamento_id: agendamento.id,
          aluno_nome: agendamento.alunos?.nome || '',
          telefone: agendamento.alunos?.telefone || '',
          data: novaDataMover,
          horario: horarioObj?.horario?.slice(0, 5) || '',
          tipo: agendamento.tipo,
          origem: 'admin (mudança de horário manual)',
        }),
      })
    } catch {}

    // Avisa o aluno da mudança
    let avisoWhats = ''
    if (agendamento.alunos?.telefone) {
      try {
        const resp = await fetch('/api/notificar-agendamento', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telefone: agendamento.alunos.telefone,
            nome: agendamento.alunos.nome,
            tipo: 'movido',
            data: novaDataMover,
            horario: horarioObj?.horario?.slice(0, 5) || '',
          }),
        })
        const json = await resp.json().catch(() => null)
        if (!json?.whatsappEnviado) {
          avisoWhats = ` — mas o aviso por WhatsApp falhou (${json?.whatsappErro || 'sem detalhe'}), avise o aluno manualmente.`
        }
      } catch {
        avisoWhats = ' — mas o aviso por WhatsApp falhou, avise o aluno manualmente.'
      }
    }

    setMovendoId(null)
    setSalvandoMover(false)
    setToast(`Horário atualizado.${avisoWhats}`)
    setTimeout(() => setToast(''), avisoWhats ? 6000 : 2500)
    await recarregarAgendamentos()
  }

  async function cancelarAgendamentoIndividual(a: AgendamentoRow) {
    if (!confirm(`Cancelar a aula de ${a.alunos?.nome || 'esse aluno'}? Ele vai receber um aviso pelo WhatsApp.`)) return
    setCancelandoId(a.id)
    try {
      const resp = await fetch('/api/cancelar-agendamento-individual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agendamento_id: a.id }),
      })
      const json = await resp.json().catch(() => null)
      if (json?.whatsappEnviado) {
        setToast('Aula cancelada e aluno avisado.')
      } else {
        setToast(`Aula cancelada, mas o aviso por WhatsApp falhou (${json?.whatsappErro || 'sem detalhe'}). Avise o aluno manualmente.`)
      }
      setTimeout(() => setToast(''), 5000)
      await recarregarAgendamentos()
    } catch {
      setToast('Erro ao cancelar.')
    }
    setCancelandoId(null)
  }

  // Horários únicos (union de todos os dias ativos), ordenados
  const horariosUnicos = Array.from(new Set(horarios.map(h => h.horario))).sort()

  function horarioNoDia(diaSemana: number, horario: string) {
    return horarios.find(h => h.dia_semana === diaSemana && h.horario === horario)
  }

  function agendamentosDaCelula(dataISO: string, horarioId: string) {
    return agendamentos.filter(a => a.data === dataISO && a.horario_id === horarioId)
  }

  const célula = célulaAberta ? agendamentosDaCelula(célulaAberta.data, célulaAberta.horarioId) : []
  const horarioCelula = célulaAberta ? horarios.find(h => h.id === célulaAberta.horarioId) : null

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={() => setRefDate(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n })} style={navBtnStyle}>← Semana anterior</button>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{fmtBR(monday)} a {fmtBR(domingo)}</span>
        <button onClick={() => setRefDate(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n })} style={navBtnStyle}>Próxima semana →</button>
        <button onClick={() => setRefDate(hojeSP())} style={{ ...navBtnStyle, color: '#3fb950', borderColor: '#3fb950' }}>Hoje</button>
      </div>

      <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>Clique em um horário pra ver quem está agendado.</p>

      {loading ? (
        <p style={{ color: 'var(--text2)' }}>Carregando...</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse', background: 'var(--card)', border: '1px solid var(--border)' }}>
            <thead>
              <tr>
                <th style={thStyle}>Horário</th>
                {weekDates.map((d, i) => (
                  <th key={i} style={thStyle}>
                    {DIAS_ABREV[d.getDay()]}<br />
                    <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 400 }}>{fmtBR(d)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {horariosUnicos.map(hr => (
                <tr key={hr}>
                  <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--text2)' }}>{hr.slice(0, 5)}</td>
                  {weekDates.map((d, i) => {
                    const diaSemana = d.getDay()
                    const h = horarioNoDia(diaSemana, hr)
                    if (!h) return <td key={i} style={{ ...tdStyle, color: 'var(--text3)' }}>—</td>
                    const dataISO = fmtISO(d)
                    const lista = agendamentosDaCelula(dataISO, h.id)
                    const ocupacao = lista.length
                    const cheio = ocupacao >= h.capacidade
                    return (
                      <td
                        key={i}
                        onClick={() => abrirCelula(dataISO, h.id)}
                        style={{
                          ...tdStyle, cursor: 'pointer',
                          background: ocupacao === 0 ? 'transparent' : cheio ? '#3fb95022' : 'var(--bg2)',
                        }}
                      >
                        <span style={{
                          fontSize: 12, fontWeight: 700,
                          color: ocupacao === 0 ? 'var(--text3)' : cheio ? '#3fb950' : '#4a90d9',
                        }}>
                          {ocupacao}/{h.capacidade}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {célulaAberta && (
        <div onClick={() => setCélulaAberta(null)} style={{
          position: 'fixed', inset: 0, background: '#000c', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16,
        }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: 20, width: '100%', maxWidth: 380, maxHeight: '80vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: 16, marginBottom: 4 }}>
              {new Date(célulaAberta.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}>
              {horarioCelula?.horario.slice(0, 5)} · {célula.length}/{horarioCelula?.capacidade} vaga{horarioCelula?.capacidade === 1 ? '' : 's'}
            </p>
            {célula.length === 0 ? (
              <p style={{ color: 'var(--text2)', fontSize: 13 }}>Nenhum aluno agendado nesse horário.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginBottom: 12 }}>
                {célula.map(a => (
                  <div key={a.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{a.alunos?.nome || 'Sem nome'}</span>
                        <div style={{ fontSize: 11, color: 'var(--text2)' }}>
                          {a.tipo === 'experimental' ? 'experimental' : 'aula'}{a.alunos?.telefone ? ` · ${a.alunos.telefone}` : ''}
                        </div>
                      </div>
                      {movendoId !== a.id && (
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <button onClick={() => abrirMoverAgendamento(a)} style={{
                            background: 'transparent', border: '1px solid var(--border)', color: 'var(--text2)',
                            borderRadius: 4, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                          }}>
                            ✏️ Mudar
                          </button>
                          <button onClick={() => cancelarAgendamentoIndividual(a)} disabled={cancelandoId === a.id} style={{
                            background: 'transparent', border: '1px solid var(--accent2)', color: 'var(--accent2)',
                            borderRadius: 4, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                            opacity: cancelandoId === a.id ? 0.6 : 1,
                          }}>
                            {cancelandoId === a.id ? '...' : '❌ Cancelar'}
                          </button>
                        </div>
                      )}
                    </div>

                    {movendoId === a.id && (
                      <div style={{ background: 'var(--bg2)', borderRadius: 6, padding: 10, marginTop: 8 }}>
                        <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, marginBottom: 4, display: 'block' }}>Nova data</label>
                        <input type="date" value={novaDataMover} onChange={e => setNovaDataMover(e.target.value)} style={{ ...inputStyleGrade, marginBottom: 8 }} />
                        <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, marginBottom: 4, display: 'block' }}>Novo horário</label>
                        <select value={novoHorarioMover} onChange={e => setNovoHorarioMover(e.target.value)} style={{ ...inputStyleGrade, marginBottom: 10 }}>
                          {horarios.map(h => <option key={h.id} value={h.id}>{h.horario.slice(0, 5)}</option>)}
                        </select>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => confirmarMoverAgendamento(a)} disabled={salvandoMover} style={{
                            ...navBtnStyle, flex: 1, background: '#3fb950', color: '#fff', opacity: salvandoMover ? 0.6 : 1,
                          }}>
                            {salvandoMover ? 'Salvando...' : '✅ Confirmar mudança'}
                          </button>
                          <button onClick={() => setMovendoId(null)} disabled={salvandoMover} style={navBtnStyle}>Cancelar</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {toast && <p style={{ fontSize: 12, color: '#3fb950', marginBottom: 10 }}>{toast}</p>}

            {!mostrarForm ? (
              <button onClick={() => setMostrarForm(true)} style={{ ...navBtnStyle, width: '100%', color: '#3fb950', borderColor: '#3fb950', marginBottom: 8 }}>
                + Adicionar aluno manualmente
              </button>
            ) : (
              <div style={{ background: 'var(--bg2)', borderRadius: 6, padding: 12, marginBottom: 8 }}>
                <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, marginBottom: 6, display: 'block' }}>Aluno</label>
                <select value={alunoEscolhido} onChange={e => setAlunoEscolhido(e.target.value)} style={{ ...inputStyleGrade }}>
                  <option value="">-- selecionar --</option>
                  {alunosOpt.map(a => (
                    <option key={a.id} value={a.id}>{a.nome}{a.status_plano !== 'ativo' ? ` (${a.status_plano})` : ''}</option>
                  ))}
                </select>
                <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, marginBottom: 6, display: 'block' }}>Tipo</label>
                <select value={tipoAula} onChange={e => setTipoAula(e.target.value as 'aula' | 'experimental')} style={{ ...inputStyleGrade, marginBottom: 10 }}>
                  <option value="aula">Aula normal</option>
                  <option value="experimental">Aula experimental</option>
                </select>
                {tipoAula === 'aula' && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 12, color: 'var(--text2)' }}>
                    <input type="checkbox" checked={repetirSemana} onChange={e => setRepetirSemana(e.target.checked)} />
                    Repetir toda semana (aula fixa)
                  </label>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button onClick={adicionarAlunoNoHorario} disabled={!alunoEscolhido || salvandoAgendamento} style={{
                    ...navBtnStyle, flex: 1, background: '#3fb950', color: '#fff', opacity: (!alunoEscolhido || salvandoAgendamento) ? 0.6 : 1,
                  }}>
                    {salvandoAgendamento ? 'Salvando...' : '✅ Confirmar'}
                  </button>
                  <button onClick={() => setMostrarForm(false)} disabled={salvandoAgendamento} style={navBtnStyle}>Cancelar</button>
                </div>
              </div>
            )}

            <button onClick={() => setCélulaAberta(null)} style={{ ...navBtnStyle, width: '100%' }}>Fechar</button>
          </div>
        </div>
      )}
    </div>
  )
}

const navBtnStyle: React.CSSProperties = {
  background: 'transparent', border: '1px solid var(--border)', color: 'var(--text2)',
  borderRadius: 6, padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
}

const inputStyleGrade: React.CSSProperties = {
  width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6,
  padding: '8px 10px', fontSize: 13, color: 'var(--text)', fontFamily: 'inherit',
}

const thStyle: React.CSSProperties = {
  border: '1px solid var(--border)', padding: '8px 6px', textAlign: 'center',
  fontSize: 11, fontWeight: 800, color: '#3fb950', letterSpacing: '0.5px',
  background: 'var(--bg2)', textTransform: 'uppercase' as const,
}

const tdStyle: React.CSSProperties = {
  border: '1px solid var(--border)', padding: '10px 6px', textAlign: 'center', fontSize: 13,
}

function ProximasAulas() {
  const [rows, setRows] = useState<AgendamentoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelando, setCancelando] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  async function load() {
    setLoading(true)
    // Usa o fuso de São Paulo para "hoje", incluindo um dia antes como margem
    const agoraSP = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
    agoraSP.setDate(agoraSP.getDate() - 1)
    const dataMin = agoraSP.toISOString().slice(0, 10)

    const { data } = await supabase
      .from('agendamentos')
      .select('id, data, status, tipo, horario_id, aluno_id, google_event_id, alunos(nome, telefone), horarios(dia_semana, horario)')
      .eq('status', 'confirmado')
      .gte('data', dataMin)
      .order('data')
      .limit(100)
    setRows((data as unknown as AgendamentoRow[]) || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Agrupar por data + horario_id
  const grupos = new Map<string, AgendamentoRow[]>()
  for (const r of rows) {
    const key = `${r.data}_${r.horario_id}`
    if (!grupos.has(key)) grupos.set(key, [])
    grupos.get(key)!.push(r)
  }

  async function cancelarTurma(data: string, horarioId: string, horario: string) {
    if (!confirm(`Cancelar a aula de ${data} às ${horario}? Todos os alunos confirmados nesse horário vão receber um aviso pelo WhatsApp.`)) return
    setCancelando(`${data}_${horarioId}`)
    try {
      const res = await fetch('/api/cancelar-aula', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, horario_id: horarioId }),
      })
      const json = await res.json()
      if (res.ok) {
        const falhas = (json.avisos || []).filter((a: { ok: boolean }) => !a.ok).length
        if (falhas > 0) {
          setToast(`Aula cancelada. ${json.canceladas} aluno(s), mas o aviso por WhatsApp falhou pra ${falhas} deles — avise manualmente.`)
          setTimeout(() => setToast(''), 6000)
        } else {
          setToast(`Aula cancelada. ${json.canceladas} aluno(s) avisado(s).`)
          setTimeout(() => setToast(''), 3000)
        }
        load()
      } else {
        setToast('Erro: ' + (json.error || 'falha ao cancelar'))
      }
    } catch {
      setToast('Erro ao cancelar')
    }
    setCancelando(null)
  }

  if (loading) return <p style={{ color: 'var(--text2)' }}>Carregando...</p>

  if (grupos.size === 0) {
    return <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, padding: '1.5rem', color: 'var(--text2)', fontSize: 13 }}>
      Nenhuma aula confirmada nos próximos dias.
    </div>
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}>
        Cancelar uma turma avisa por WhatsApp todos os alunos confirmados naquele dia/horário.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
        {[...grupos.entries()].map(([key, items]) => {
          const first = items[0]
          const horario = first.horarios?.horario.slice(0, 5) || ''
          return (
            <div key={key} style={{
              background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6,
              padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{first.data} às {horario}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                  {items.length} aluno(s): {items.map(i => i.alunos?.nome).filter(Boolean).join(', ')}
                </div>
              </div>
              <button
                onClick={() => cancelarTurma(first.data, first.horario_id, horario)}
                disabled={cancelando === key}
                style={{
                  background: 'transparent', border: '1px solid var(--accent2)', color: 'var(--accent2)',
                  borderRadius: 4, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  opacity: cancelando === key ? 0.6 : 1,
                }}
              >
                {cancelando === key ? 'Cancelando...' : 'Cancelar aula'}
              </button>
            </div>
          )
        })}
      </div>
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--card)', border: '1px solid #3fb950', borderRadius: 6,
          padding: '10px 20px', fontSize: 13, color: '#3fb950',
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}

function GradeHorarios() {
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [diaAtivo, setDiaAtivo] = useState(() => new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })).getDay())

  const [mostrarForm, setMostrarForm] = useState(false)
  const [novoHorario, setNovoHorario] = useState('18:00')
  const [novaCapacidade, setNovaCapacidade] = useState('5')
  const [novoProfessorId, setNovoProfessorId] = useState('')
  const [diasEscolhidos, setDiasEscolhidos] = useState<number[]>([])
  const [salvandoNovo, setSalvandoNovo] = useState(false)
  const [erroForm, setErroForm] = useState('')

  const [editandoCapacidade, setEditandoCapacidade] = useState<string | null>(null)
  const [capacidadeTemp, setCapacidadeTemp] = useState('')

  const [professoresOpt, setProfessoresOpt] = useState<{ id: string; nome: string }[]>([])

  async function load() {
    setLoading(true)
    const [{ data: hData }, { data: pData }] = await Promise.all([
      supabase.from('horarios').select('*, professores(nome)').order('dia_semana').order('horario'),
      supabase.from('professores').select('id, nome').eq('ativo', true).order('created_at'),
    ])
    setHorarios(hData || [])
    setProfessoresOpt(pData || [])
    if (pData && pData.length > 0) setNovoProfessorId(pData[0].id)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function mudarProfessor(h: Horario, professorId: string) {
    setUpdating(h.id)
    await supabase.from('horarios').update({ professor_id: professorId || null }).eq('id', h.id)
    const prof = professoresOpt.find(p => p.id === professorId)
    setHorarios(prev => prev.map(x => x.id === h.id ? { ...x, professor_id: professorId || null, professores: prof ? { ...prof, valor_por_aula: 0, ativo: true, created_at: '' } : null } : x))
    setUpdating(null)
  }

  async function toggle(h: Horario) {
    setUpdating(h.id)
    await supabase.from('horarios').update({ ativo: !h.ativo }).eq('id', h.id)
    setHorarios(prev => prev.map(x => x.id === h.id ? { ...x, ativo: !x.ativo } : x))
    setUpdating(null)
  }

  async function apagar(h: Horario) {
    if (!confirm(`Apagar de vez o horário das ${h.horario.slice(0, 5)} (${DIAS[h.dia_semana]})? Isso não pode ser desfeito. Se preferir só parar de oferecer, use "Desativar" em vez de apagar.`)) return
    setUpdating(h.id)
    const { error } = await supabase.from('horarios').delete().eq('id', h.id)
    if (error) {
      alert('Não consegui apagar — provavelmente já tem aluno agendado nesse horário (mesmo em datas passadas). Desative em vez de apagar, ou fale comigo pra investigar.')
    } else {
      setHorarios(prev => prev.filter(x => x.id !== h.id))
    }
    setUpdating(null)
  }

  function abrirEdicaoCapacidade(h: Horario) {
    setEditandoCapacidade(h.id)
    setCapacidadeTemp(String(h.capacidade))
  }

  async function salvarCapacidade(h: Horario) {
    const nova = parseInt(capacidadeTemp, 10)
    if (!nova || nova < 1) return
    await supabase.from('horarios').update({ capacidade: nova }).eq('id', h.id)
    setHorarios(prev => prev.map(x => x.id === h.id ? { ...x, capacidade: nova } : x))
    setEditandoCapacidade(null)
  }

  function toggleDiaEscolhido(dia: number) {
    setDiasEscolhidos(prev => prev.includes(dia) ? prev.filter(d => d !== dia) : [...prev, dia])
  }

  async function criarHorarios() {
    setErroForm('')
    if (diasEscolhidos.length === 0) { setErroForm('Escolhe pelo menos um dia da semana.'); return }
    if (!novoHorario) { setErroForm('Escolhe um horário.'); return }
    const capacidade = parseInt(novaCapacidade, 10) || 5

    // Nao deixar criar duplicado (mesmo dia + mesmo horario)
    const jaExiste = diasEscolhidos.filter(dia =>
      horarios.some(h => h.dia_semana === dia && h.horario.slice(0, 5) === novoHorario)
    )
    if (jaExiste.length > 0) {
      setErroForm(`Já existe horário das ${novoHorario} em: ${jaExiste.map(d => DIAS[d]).join(', ')}. Desmarque esses dias ou edite o horário existente.`)
      return
    }

    setSalvandoNovo(true)
    const novasLinhas = diasEscolhidos.map(dia => ({
      dia_semana: dia,
      horario: novoHorario + ':00',
      capacidade,
      ativo: true,
      professor_id: novoProfessorId || null,
    }))
    const { data: inseridos } = await supabase.from('horarios').insert(novasLinhas).select('*')
    setHorarios(prev => [...prev, ...(inseridos || [])].sort((a, b) => a.dia_semana - b.dia_semana || a.horario.localeCompare(b.horario)))
    setSalvandoNovo(false)
    setMostrarForm(false)
    setDiasEscolhidos([])
    setNovoHorario('18:00')
    setNovaCapacidade('5')
  }

  if (loading) return <p style={{ color: 'var(--text2)' }}>Carregando...</p>

  const horariosDoDia = horarios.filter(h => h.dia_semana === diaAtivo)

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}>
        Configure os horários de cada dia da semana: crie novos (em vários dias de uma vez), ajuste vagas, desative temporariamente ou apague de vez.
      </p>

      {/* Abas de dia da semana */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {DIAS.map((nome, i) => (
          <button
            key={i}
            onClick={() => setDiaAtivo(i)}
            style={{
              background: diaAtivo === i ? '#3fb95022' : 'transparent',
              color: diaAtivo === i ? '#3fb950' : 'var(--text2)',
              border: `1.5px solid ${diaAtivo === i ? '#3fb950' : 'var(--border)'}`,
              borderRadius: 6, padding: '7px 12px', fontSize: 12, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {nome}
          </button>
        ))}
      </div>

      {horariosDoDia.length === 0 ? (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, padding: '1.5rem', color: 'var(--text2)', fontSize: 13, marginBottom: 16 }}>
          Nenhum horário cadastrado para {DIAS[diaAtivo]}.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginBottom: 16 }}>
          {horariosDoDia.map(h => (
            <div key={h.id} style={{
              background: 'var(--card)', border: `1px solid ${h.ativo ? 'var(--border)' : 'var(--accent2)'}`,
              borderRadius: 6, padding: '12px 16px', display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', gap: 12, flexWrap: 'wrap', opacity: h.ativo ? 1 : 0.55,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 14, textDecoration: h.ativo ? 'none' : 'line-through' }}>
                  {h.horario.slice(0, 5)}
                </span>
                {!h.ativo && <span style={{ fontSize: 11, color: 'var(--accent2)' }}>(desativado)</span>}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {editandoCapacidade === h.id ? (
                  <>
                    <input
                      type="number" min={1} value={capacidadeTemp}
                      onChange={e => setCapacidadeTemp(e.target.value)}
                      style={{ width: 55, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 6px', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit' }}
                    />
                    <button onClick={() => salvarCapacidade(h)} style={{ background: '#3fb950', border: 'none', color: '#fff', borderRadius: 4, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>OK</button>
                  </>
                ) : (
                  <span
                    onClick={() => abrirEdicaoCapacidade(h)}
                    title="Clique pra editar"
                    style={{
                      fontSize: 12, fontWeight: 700, color: 'var(--text2)', background: 'var(--bg)',
                      border: '1px solid var(--border)', borderRadius: 4, padding: '4px 10px', cursor: 'pointer',
                    }}
                  >
                    {h.capacidade} vaga{h.capacidade === 1 ? '' : 's'} ✏️
                  </span>
                )}

                <select
                  value={h.professor_id || ''}
                  onChange={e => mudarProfessor(h, e.target.value)}
                  disabled={updating === h.id}
                  title="Professor responsável por este horário"
                  style={{
                    background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4,
                    padding: '4px 6px', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit',
                    maxWidth: 130,
                  }}
                >
                  <option value="">— sem professor —</option>
                  {professoresOpt.map(p => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>

                <button
                  onClick={() => toggle(h)}
                  disabled={updating === h.id}
                  style={{
                    background: 'transparent', border: `1px solid ${h.ativo ? 'var(--border)' : 'var(--accent2)'}`,
                    color: h.ativo ? 'var(--text2)' : 'var(--accent2)', borderRadius: 4, padding: '6px 12px',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: updating === h.id ? 0.6 : 1,
                  }}
                >
                  {h.ativo ? 'Desativar' : 'Ativar'}
                </button>

                <button
                  onClick={() => apagar(h)}
                  disabled={updating === h.id}
                  style={{
                    background: 'transparent', border: '1px solid var(--accent2)', color: 'var(--accent2)',
                    borderRadius: 4, padding: '6px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', opacity: updating === h.id ? 0.6 : 1,
                  }}
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!mostrarForm ? (
        <button onClick={() => setMostrarForm(true)} style={{
          background: 'transparent', border: '1px solid #3fb950', color: '#3fb950',
          borderRadius: 6, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          + Criar novo horário
        </button>
      ) : (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
          <h4 style={{ fontSize: 14, marginBottom: 12 }}>Criar novo horário</h4>

          <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, marginBottom: 6, display: 'block' }}>Em quais dias?</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {DIAS.map((nome, i) => (
              <button
                key={i}
                onClick={() => toggleDiaEscolhido(i)}
                style={{
                  background: diasEscolhidos.includes(i) ? '#3fb95022' : 'transparent',
                  color: diasEscolhidos.includes(i) ? '#3fb950' : 'var(--text2)',
                  border: `1.5px solid ${diasEscolhidos.includes(i) ? '#3fb950' : 'var(--border)'}`,
                  borderRadius: 6, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {nome}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, marginBottom: 6, display: 'block' }}>Horário</label>
              <input
                type="time" value={novoHorario} onChange={e => setNovoHorario(e.target.value)}
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, marginBottom: 6, display: 'block' }}>Vagas</label>
              <input
                type="number" min={1} value={novaCapacidade} onChange={e => setNovaCapacidade(e.target.value)}
                style={{ width: 70, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, marginBottom: 6, display: 'block' }}>Professor</label>
              <select
                value={novoProfessorId} onChange={e => setNovoProfessorId(e.target.value)}
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit' }}
              >
                <option value="">— sem professor —</option>
                {professoresOpt.map(p => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>
          </div>

          {erroForm && <p style={{ color: 'var(--accent2)', fontSize: 12, marginBottom: 10 }}>{erroForm}</p>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={criarHorarios} disabled={salvandoNovo} style={{
              background: '#3fb950', border: 'none', color: '#fff', borderRadius: 6,
              padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: salvandoNovo ? 0.6 : 1,
            }}>
              {salvandoNovo ? 'Criando...' : '✅ Criar'}
            </button>
            <button onClick={() => { setMostrarForm(false); setErroForm(''); setDiasEscolhidos([]) }} disabled={salvandoNovo} style={{
              background: 'transparent', border: '1px solid var(--border2)', color: 'var(--text2)', borderRadius: 6,
              padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
