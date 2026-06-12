'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type PagamentoRow = {
  id: string
  valor: number
  status: string
  data_vencimento: string | null
  alunos: { nome: string } | null
}

const STATUS_COLOR: Record<string, string> = {
  pendente: 'var(--accent)',
  pago: '#3fb950',
  vencido: 'var(--accent2)',
  cancelado: 'var(--text3)',
}

export default function PagamentosPage() {
  const [rows, setRows] = useState<PagamentoRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('pagamentos')
        .select('id, valor, status, data_vencimento, alunos(nome)')
        .order('data_vencimento', { ascending: true })
        .limit(50)
      setRows((data as unknown as PagamentoRow[]) || [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Pagamentos</h1>
      <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>
        A geração automática de cobranças via Mercado Pago será adicionada na próxima fase.
        Por enquanto, esta tela mostra os pagamentos registrados.
      </p>

      {loading ? (
        <p style={{ color: 'var(--text2)' }}>Carregando...</p>
      ) : rows.length === 0 ? (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, padding: '1.5rem', color: 'var(--text2)', fontSize: 13 }}>
          Nenhum pagamento registrado ainda.
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
                  R$ {r.valor.toFixed(2)} {r.data_vencimento ? `· vence ${r.data_vencimento}` : ''}
                </div>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 4,
                color: STATUS_COLOR[r.status], border: `1px solid ${STATUS_COLOR[r.status]}`,
                textTransform: 'uppercase', letterSpacing: '0.5px',
              }}>
                {r.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
