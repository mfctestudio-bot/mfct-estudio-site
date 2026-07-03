'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type PagamentoRow = {
  id: string
  valor: number
  status: string
  data_vencimento: string | null
  comprovante_url: string | null
  comprovante_recebido_em: string | null
  confirmado_em: string | null
  metodo_pagamento: string | null
  created_at: string
  alunos: { nome: string; telefone: string } | null
  planos: { nome: string } | null
}

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  aguardando_confirmacao: 'Aguard. confirmação',
  pago: 'Pago',
  vencido: 'Vencido',
  cancelado: 'Cancelado',
}

const STATUS_COLOR: Record<string, string> = {
  pendente: 'var(--accent)',
  aguardando_confirmacao: '#f0a500',
  pago: '#3fb950',
  vencido: 'var(--accent2)',
  cancelado: 'var(--text3)',
}

const inputStyle = {
  background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)',
  borderRadius: 6, padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' as const,
}

export default function PagamentosPage() {
  const [rows, setRows] = useState<PagamentoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('aguardando_confirmacao')
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [dataConfirm, setDataConfirm] = useState<Record<string, string>>({})
  const [imgModal, setImgModal] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    let q = supabase
      .from('pagamentos')
      .select('id, valor, status, data_vencimento, comprovante_url, comprovante_recebido_em, confirmado_em, metodo_pagamento, created_at, alunos(nome, telefone), planos(nome)')
      .order('created_at', { ascending: false })
      .limit(100)
    if (filtro !== 'todos') q = q.eq('status', filtro)
    const { data } = await q
    setRows((data as unknown as PagamentoRow[]) || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [filtro])

  async function confirmarPagamento(id: string) {
    setConfirmando(id)
    const dataPag = dataConfirm[id] || new Date().toISOString().slice(0, 10)
    
    // Atualizar pagamento
    await supabase.from('pagamentos').update({
      status: 'pago',
      confirmado_em: new Date().toISOString(),
      confirmado_por: 'admin',
      data_pagamento: new Date(dataPag + 'T12:00:00').toISOString(),
    }).eq('id', id)

    // Ativar aluno
    const pag = rows.find(r => r.id === id)
    if (pag?.alunos?.telefone) {
      await supabase.from('alunos')
        .update({ status_plano: 'ativo' })
        .eq('telefone', pag.alunos.telefone)

      // Notificar aluno via WhatsApp
      try {
        await fetch('/api/confirmar-pagamento', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: pag.alunos.telefone, nomeAluno: pag.alunos.nome })
        })
      } catch (e) {}
    }

    setConfirmando(null)
    load()
  }

  const pendentes = rows.filter(r => r.status === 'aguardando_confirmacao').length

  return (
    <div style={{ maxWidth: 700 }}>
      <h1 style={{ fontSize: 28, marginBottom: 4 }}>Pagamentos</h1>
      {pendentes > 0 && (
        <div style={{ background: '#f0a50022', border: '1px solid #f0a500', borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#f0a500', fontWeight: 700 }}>
          ⚠️ {pendentes} comprovante{pendentes > 1 ? 's' : ''} aguardando sua confirmação
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['aguardando_confirmacao', 'pendente', 'pago', 'vencido', 'todos'].map(s => (
          <button key={s} onClick={() => setFiltro(s)} style={{
            background: filtro === s ? 'var(--accent)' : 'var(--card)',
            border: '1px solid var(--border)', color: filtro === s ? '#fff' : 'var(--text2)',
            borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            {s === 'aguardando_confirmacao' ? '⚠️ Aguardando' : s === 'todos' ? 'Todos' : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: 'var(--text2)' }}>Carregando...</p>
      ) : rows.length === 0 ? (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, padding: '1.5rem', color: 'var(--text2)', fontSize: 13 }}>
          Nenhum pagamento encontrado.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map(p => (
            <div key={p.id} style={{
              background: 'var(--card)', border: `1px solid ${p.status === 'aguardando_confirmacao' ? '#f0a500' : 'var(--border)'}`,
              borderRadius: 6, padding: '14px 16px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{p.alunos?.nome || 'Sem nome'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                    {p.planos?.nome || 'Plano'} · R$ {Number(p.valor).toFixed(2).replace('.', ',')}
                    {p.data_vencimento && ` · Vence ${new Date(p.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}`}
                  </div>
                  {p.comprovante_recebido_em && (
                    <div style={{ fontSize: 12, color: '#f0a500', marginTop: 4 }}>
                      Comprovante recebido em {new Date(p.comprovante_recebido_em).toLocaleString('pt-BR')}
                    </div>
                  )}
                  {p.confirmado_em && (
                    <div style={{ fontSize: 12, color: '#3fb950', marginTop: 4 }}>
                      ✅ Confirmado em {new Date(p.confirmado_em).toLocaleString('pt-BR')}
                    </div>
                  )}
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 4,
                  background: 'var(--bg)', border: `1px solid ${STATUS_COLOR[p.status] || 'var(--border)'}`,
                  color: STATUS_COLOR[p.status] || 'var(--text2)',
                }}>
                  {STATUS_LABEL[p.status] || p.status}
                </span>
              </div>

              {/* Comprovante + Confirmação */}
              {p.status === 'aguardando_confirmacao' && (
                <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  {p.comprovante_url && (
                    <button onClick={() => setImgModal(p.comprovante_url!)} style={{
                      background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)',
                      borderRadius: 6, padding: '8px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                      🖼️ Ver comprovante
                    </button>
                  )}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Data do pagamento</div>
                      <input
                        type="date"
                        value={dataConfirm[p.id] || new Date().toISOString().slice(0, 10)}
                        onChange={e => setDataConfirm(prev => ({ ...prev, [p.id]: e.target.value }))}
                        style={inputStyle}
                      />
                    </div>
                    <button
                      onClick={() => confirmarPagamento(p.id)}
                      disabled={confirmando === p.id}
                      style={{
                        background: '#3fb950', border: 'none', color: '#fff',
                        borderRadius: 6, padding: '10px 18px', fontSize: 13, fontWeight: 700,
                        cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                        opacity: confirmando === p.id ? 0.6 : 1, marginTop: 18,
                      }}
                    >
                      {confirmando === p.id ? 'Confirmando...' : '✅ Confirmar pagamento'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal comprovante */}
      {imgModal && (
        <div
          onClick={() => setImgModal(null)}
          style={{
            position: 'fixed', inset: 0, background: '#000c', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 9999, cursor: 'pointer',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imgModal} alt="Comprovante" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8 }} />
        </div>
      )}
    </div>
  )
}
