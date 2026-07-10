'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseAdmin'

type AeroRow = {
  id: string
  data: string
  horario: string
  aparelho: string
  duracao_minutos: number
  status: string
  alunos: { nome: string; telefone: string } | null
}

const APARELHO_EMOJI: Record<string, string> = {
  esteira: '🏃',
  eliptica: '🔄',
  bicicleta: '🚴',
}

export default function AerobicoPage() {
  const [rows, setRows] = useState<AeroRow[]>([])
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(new Date().toISOString().slice(0, 10))

  async function load() {
    setLoading(true)
    const { data: result } = await supabase
      .from('agendamentos_aerobico')
      .select('id, data, horario, aparelho, duracao_minutos, status, alunos(nome, telefone)')
      .eq('data', data)
      .eq('status', 'confirmado')
      .order('horario')
    setRows((result as unknown as AeroRow[]) || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [data])

  async function cancelar(id: string) {
    if (!confirm('Cancelar este agendamento de aeróbico?')) return
    await supabase.from('agendamentos_aerobico').update({ status: 'cancelado' }).eq('id', id)
    load()
  }

  const aparelhos = ['esteira', 'eliptica', 'bicicleta']

  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 4 }}>Agenda Aeróbico</h1>
      <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>
        Esteira, elíptica e bicicleta — agendamentos do dia
      </p>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
        <input
          type="date"
          value={data}
          onChange={e => setData(e.target.value)}
          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 6, padding: '8px 12px', fontSize: 14, fontFamily: 'inherit' }}
        />
        <span style={{ fontSize: 13, color: 'var(--text2)' }}>
          {new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
        </span>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text2)' }}>Carregando...</p>
      ) : rows.length === 0 ? (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '2rem', textAlign: 'center', color: 'var(--text2)' }}>
          Nenhum aeróbico agendado para este dia.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {/* Resumo por aparelho */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 8 }}>
            {aparelhos.map(ap => {
              const count = rows.filter(r => r.aparelho === ap).length
              return (
                <div key={ap} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 24 }}>{APARELHO_EMOJI[ap]}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4, textTransform: 'capitalize' }}>{ap}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: count > 0 ? 'var(--accent)' : 'var(--text2)', marginTop: 2 }}>{count}</div>
                  <div style={{ fontSize: 11, color: 'var(--text2)' }}>agendamento{count !== 1 ? 's' : ''}</div>
                </div>
              )
            })}
          </div>

          {/* Lista */}
          {rows.map(r => (
            <div key={r.id} style={{
              background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8,
              padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24 }}>{APARELHO_EMOJI[r.aparelho] || '🏋️'}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{r.alunos?.nome || 'Aluno'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                    {r.horario.slice(0, 5)} · {r.duracao_minutos} min · <span style={{ textTransform: 'capitalize' }}>{r.aparelho}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => cancelar(r.id)} style={{
                background: 'transparent', border: '1px solid var(--accent2)', color: 'var(--accent2)',
                borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit'
              }}>
                Cancelar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
