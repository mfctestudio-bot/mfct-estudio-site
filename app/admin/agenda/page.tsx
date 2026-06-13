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

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('horarios').select('*').order('dia_semana').order('horario')
    setHorarios(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function toggle(h: Horario) {
    setUpdating(h.id)
    await supabase.from('horarios').update({ ativo: !h.ativo }).eq('id', h.id)
    setHorarios(prev => prev.map(x => x.id === h.id ? { ...x, ativo: !x.ativo } : x))
    setUpdating(null)
  }

  if (loading) return <p style={{ color: 'var(--text2)' }}>Carregando...</p>

  // Agrupar por dia da semana
  const porDia = new Map<number, Horario[]>()
  for (const h of horarios) {
    if (!porDia.has(h.dia_semana)) porDia.set(h.dia_semana, [])
    porDia.get(h.dia_semana)!.push(h)
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}>
        Desativar um horário remove ele permanentemente da grade — a Eleniria deixa de oferecer esse horário pros alunos.
      </p>
      <div style={{ display: 'grid', gap: 16 }}>
        {[...porDia.entries()].map(([dia, lista]) => (
          <div key={dia}>
            <h3 style={{ fontSize: 13, color: 'var(--accent)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 8 }}>
              {DIAS[dia]}
            </h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {lista.map(h => (
                <button
                  key={h.id}
                  onClick={() => toggle(h)}
                  disabled={updating === h.id}
                  style={{
                    background: h.ativo ? 'var(--card)' : 'transparent',
                    border: `1px solid ${h.ativo ? 'var(--border)' : 'var(--accent2)'}`,
                    color: h.ativo ? 'var(--text)' : 'var(--accent2)',
                    borderRadius: 6, padding: '8px 14px', fontSize: 13, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit',
                    textDecoration: h.ativo ? 'none' : 'line-through',
                    opacity: updating === h.id ? 0.6 : 1,
                  }}
                >
                  {h.horario.slice(0, 5)} {h.ativo ? '' : '(desativado)'}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
