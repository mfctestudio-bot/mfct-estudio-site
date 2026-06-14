'use client'
import { useEffect, useState } from 'react'
import { supabase, Horario } from '@/lib/supabase'

type AgendamentoRow = {
  id: string
  data: string
  status: string
  tipo: string
  horario_id: string
  alunos: { nome: string; telefone: string | null } | null
  horarios: { dia_semana: number; horario: string } | null
}

const DIAS = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado']

export default function AgendaPage() {
  const [tab, setTab] = useState<'aulas' | 'grade'>('aulas')

  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Agenda</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <TabButton active={tab === 'aulas'} onClick={() => setTab('aulas')}>Próximas aulas</TabButton>
        <TabButton active={tab === 'grade'} onClick={() => setTab('grade')}>Grade de horários</TabButton>
      </div>
      {tab === 'aulas' ? <ProximasAulas /> : <GradeHorarios />}
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
      .select('id, data, status, tipo, horario_id, alunos(nome, telefone), horarios(dia_semana, horario)')
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
        setToast(`Aula cancelada. ${json.canceladas} aluno(s) avisado(s).`)
        setTimeout(() => setToast(''), 3000)
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
      <div style={{ display: 'grid', gap: 8 }}>
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
          background: 'var(--card)', border: '1px solid var(--accent)', borderRadius: 6,
          padding: '10px 20px', fontSize: 13, color: 'var(--accent)',
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
  const [data, setData] = useState(() => new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })).toISOString().slice(0, 10))
  const [agendamentos, setAgendamentos] = useState<AgendamentoRow[]>([])
  const [expandido, setExpandido] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data: hData } = await supabase.from('horarios').select('*').order('dia_semana').order('horario')
    setHorarios(hData || [])

    const { data: aData } = await supabase
      .from('agendamentos')
      .select('id, data, status, tipo, horario_id, alunos(nome, telefone), horarios(dia_semana, horario)')
      .eq('data', data)
      .eq('status', 'confirmado')
    setAgendamentos((aData as unknown as AgendamentoRow[]) || [])

    setLoading(false)
  }

  useEffect(() => { load() }, [data])

  async function toggle(h: Horario) {
    setUpdating(h.id)
    await supabase.from('horarios').update({ ativo: !h.ativo }).eq('id', h.id)
    setHorarios(prev => prev.map(x => x.id === h.id ? { ...x, ativo: !x.ativo } : x))
    setUpdating(null)
  }

  if (loading) return <p style={{ color: 'var(--text2)' }}>Carregando...</p>

  // Diferenca de dia da semana entre a data selecionada e hoje, para filtrar horarios do dia certo
  const diaSemanaData = new Date(data + 'T12:00:00').getDay()

  const horariosDoDia = horarios.filter(h => h.dia_semana === diaSemanaData)

  // Mapear agendamentos por horario_id
  const porHorario = new Map<string, AgendamentoRow[]>()
  for (const a of agendamentos) {
    if (!porHorario.has(a.horario_id)) porHorario.set(a.horario_id, [])
    porHorario.get(a.horario_id)!.push(a)
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}>
        Desativar um horário remove ele permanentemente da grade — a Eleniria deixa de oferecer esse horário pros alunos.
        Selecione uma data para ver a ocupação de cada horário.
      </p>

      <div style={{ marginBottom: 16 }}>
        <input
          type="date"
          value={data}
          onChange={e => setData(e.target.value)}
          style={{
            background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)',
            borderRadius: 6, padding: '8px 12px', fontSize: 13, fontFamily: 'inherit',
          }}
        />
        <span style={{ marginLeft: 10, fontSize: 13, color: 'var(--accent)', fontWeight: 700 }}>
          {DIAS[diaSemanaData]}
        </span>
      </div>

      {horariosDoDia.length === 0 ? (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, padding: '1.5rem', color: 'var(--text2)', fontSize: 13 }}>
          Nenhum horário cadastrado para {DIAS[diaSemanaData]}.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {horariosDoDia.map(h => {
            const lista = porHorario.get(h.id) || []
            const ocupacao = lista.length
            const cheio = ocupacao >= h.capacidade
            const isExpandido = expandido === h.id

            return (
              <div key={h.id} style={{
                background: 'var(--card)', border: `1px solid ${h.ativo ? 'var(--border)' : 'var(--accent2)'}`,
                borderRadius: 6, overflow: 'hidden',
              }}>
                <div
                  onClick={() => setExpandido(isExpandido ? null : h.id)}
                  style={{
                    padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    gap: 12, flexWrap: 'wrap', cursor: 'pointer',
                    opacity: h.ativo ? 1 : 0.55,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, textDecoration: h.ativo ? 'none' : 'line-through' }}>
                      {h.horario.slice(0, 5)}
                    </span>
                    {!h.ativo && <span style={{ fontSize: 11, color: 'var(--accent2)' }}>(desativado)</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      fontSize: 12, fontWeight: 700,
                      color: cheio ? 'var(--accent2)' : 'var(--text2)',
                      background: 'var(--bg)', border: `1px solid ${cheio ? 'var(--accent2)' : 'var(--border)'}`,
                      borderRadius: 4, padding: '4px 10px',
                    }}>
                      {ocupacao}/{h.capacidade} vaga{h.capacidade === 1 ? '' : 's'} {cheio ? '(cheio)' : ''}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggle(h) }}
                      disabled={updating === h.id}
                      style={{
                        background: 'transparent',
                        border: `1px solid ${h.ativo ? 'var(--border)' : 'var(--accent2)'}`,
                        color: h.ativo ? 'var(--text2)' : 'var(--accent2)',
                        borderRadius: 4, padding: '6px 12px', fontSize: 12, fontWeight: 700,
                        cursor: 'pointer', fontFamily: 'inherit', opacity: updating === h.id ? 0.6 : 1,
                      }}
                    >
                      {h.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                  </div>
                </div>

                {isExpandido && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '10px 16px', fontSize: 13 }}>
                    {lista.length === 0 ? (
                      <span style={{ color: 'var(--text2)' }}>Nenhum aluno agendado.</span>
                    ) : (
                      <div style={{ display: 'grid', gap: 4 }}>
                        {lista.map(a => (
                          <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text2)' }}>
                            <span>{a.alunos?.nome || 'Sem nome'}</span>
                            <span style={{ fontSize: 11 }}>
                              {a.tipo === 'experimental' ? 'experimental' : 'aula'} · {a.alunos?.telefone || ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
