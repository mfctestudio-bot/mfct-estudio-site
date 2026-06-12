'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type AgendamentoRow = {
  id: string
  data: string
  status: string
  tipo: string
  alunos: { nome: string; telefone: string | null } | null
  horarios: { dia_semana: number; horario: string } | null
}

export default function AgendaPage() {
  const [rows, setRows] = useState<AgendamentoRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('agendamentos')
        .select('id, data, status, tipo, alunos(nome, telefone), horarios(dia_semana, horario)')
        .gte('data', new Date().toISOString().slice(0, 10))
        .order('data')
        .limit(50)
      setRows((data as unknown as AgendamentoRow[]) || [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Agenda</h1>
      <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>
        Os agendamentos feitos pela Eleniria via WhatsApp aparecem aqui. A gestão completa
        (marcar/desmarcar pelo admin) será adicionada quando a integração da Eleniria com a agenda estiver pronta.
      </p>

      {loading ? (
        <p style={{ color: 'var(--text2)' }}>Carregando...</p>
      ) : rows.length === 0 ? (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, padding: '1.5rem', color: 'var(--text2)', fontSize: 13 }}>
          Nenhum agendamento futuro registrado ainda.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {rows.map(r => (
            <div key={r.id} style={{
              background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6,
              padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{r.alunos?.nome || 'Aluno'}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                  {r.data} às {r.horarios?.horario} {r.tipo === 'experimental' ? '· Aula experimental' : ''}
                </div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase' }}>{r.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
