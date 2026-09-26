'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseAdmin'

type PagamentoRow = {
  id: string
  valor: number
  valor_original: number | null
  desconto: number | null
  status: string
  data_vencimento: string | null
  data_pagamento: string | null
  comprovante_url: string | null
  comprovante_recebido_em: string | null
  confirmado_em: string | null
  metodo_pagamento: string | null
  observacao: string | null
  created_at: string
  aluno_id: string
  plano_id: string | null
  alunos: { nome: string; telefone: string } | null
  planos: { nome: string } | null
}

// Reorganização Mensalidades/Pagamentos (25/09/2026): esta tela agora é só o histórico
// financeiro. Criar mensalidade nova, corrigir data/valor ou trocar de plano são
// operações de Financeiro → Mensalidades (perfil do aluno) -- nunca daqui. Aqui só se
// confirma, estorna ou exclui um pagamento já existente. "pendente" é uma mensalidade
// criada em Mensalidades como Cenário B (renovação sem pagamento ainda); "estornado" é
// um pagamento que foi recebido e depois devolvido/cancelado (preserva o histórico).
const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  aguardando_confirmacao: 'Aguard. confirmação',
  pago: 'Pago',
  estornado: 'Estornado',
  cancelado: 'Cancelado',
}

const STATUS_COLOR: Record<string, string> = {
  pendente: '#f0a500',
  aguardando_confirmacao: '#f0a500',
  pago: '#3fb950',
  estornado: 'var(--text3)',
  cancelado: 'var(--text3)',
}

const inputStyle = {
  background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)',
  borderRadius: 6, padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' as const,
}

function PagamentosContent() {
  const params = useSearchParams()
  const [rows, setRows] = useState<PagamentoRow[]>([])
  const [ordenacao, setOrdenacao] = useState('recentes')
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState(params.get('status') || 'todos')
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [confirmandoPendente, setConfirmandoPendente] = useState<string | null>(null)
  const [estornando, setEstornando] = useState<string | null>(null)
  const [reparando, setReparando] = useState<string | null>(null)
  const [dataConfirm, setDataConfirm] = useState<Record<string, string>>({})
  const [metodoConfirm, setMetodoConfirm] = useState<Record<string, string>>({})
  const [imgModal, setImgModal] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    let q = supabase
      .from('pagamentos')
      .select('id, valor, valor_original, desconto, status, data_vencimento, data_pagamento, comprovante_url, comprovante_recebido_em, confirmado_em, metodo_pagamento, observacao, created_at, aluno_id, plano_id, alunos(nome, telefone), planos(nome)')
      .order('created_at', { ascending: false })
      .limit(100)
    if (filtro !== 'todos') q = q.eq('status', filtro)
    const { data } = await q
    setRows((data as unknown as PagamentoRow[]) || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [filtro])

  async function removerPagamento(id: string) {
    if (!confirm('Excluir este pagamento do histórico? Essa ação não pode ser desfeita.')) return
    const resposta = await fetch(`/api/admin-pagamentos?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (!resposta.ok) {
      const erro = await resposta.json().catch(() => null)
      alert(erro?.error || 'Não foi possível excluir o pagamento. Se ele já tem uma mensalidade vinculada, exclua a mensalidade em Financeiro → Mensalidades primeiro.')
      return
    }
    load()
  }

  // CENÁRIO B: confirma um pagamento pendente criado em Financeiro → Mensalidades
  // (renovação sem pagamento ainda). Libera a mensalidade que já existia -- não cria
  // uma nova (ver confirmarPagamentoPendente em lib/planos.ts).
  async function confirmarPendente(id: string) {
    setConfirmandoPendente(id)
    const dataPag = dataConfirm[id] || new Date().toISOString().slice(0, 10)
    const metodo = metodoConfirm[id] || 'pix'
    const resposta = await fetch('/api/admin-confirmar-pagamento-pendente', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pagamentoId: id, dataPagamento: dataPag, metodoPagamento: metodo }),
    })
    setConfirmandoPendente(null)
    if (!resposta.ok) {
      const erro = await resposta.json().catch(() => null)
      alert(erro?.error || 'Não foi possível confirmar esse pagamento.')
      return
    }
    load()
  }

  // Estorno: preserva o histórico (status vira 'estornado'), mas remove o período de
  // acesso que esse pagamento tinha liberado. Diferente de excluir (ver seção 8 do
  // pedido de reorganização).
  async function estornarPagamentoHandler(p: PagamentoRow) {
    if (!confirm(`Estornar o pagamento de R$ ${Number(p.valor).toFixed(2).replace('.', ',')} de ${p.alunos?.nome || 'aluno'}? O histórico fica registrado como estornado, e o período de acesso que ele tinha liberado é removido.`)) return
    setEstornando(p.id)
    const resposta = await fetch('/api/admin-estornar-pagamento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pagamentoId: p.id }),
    })
    const resultado = await resposta.json().catch(() => null)
    setEstornando(null)
    if (!resposta.ok) {
      alert(resultado?.error || 'Não foi possível estornar esse pagamento.')
      return
    }
    if (resultado.alunoMarcadoVencido) {
      alert('Pagamento estornado. Esse era o período que cobria hoje, então o aluno já voltou pra "vencido".')
    }
    load()
  }

  async function confirmarPagamento(id: string) {
    setConfirmando(id)
    const dataPag = dataConfirm[id] || new Date().toISOString().slice(0, 10)
    const metodo = metodoConfirm[id] || 'pix'
    const pag = rows.find(r => r.id === id)
    if (!pag) {
      setConfirmando(null)
      return
    }
    const { data: aluno } = await supabase.from('alunos').select('plano_id').eq('id', pag.aluno_id).single()
    const planoId = pag.plano_id || aluno?.plano_id
    if (!planoId) {
      setConfirmando(null)
      return
    }

    const resposta = await fetch('/api/admin-ativar-plano', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alunoId: pag.aluno_id,
        pagamentoId: pag.id,
        planoId,
        valor: Number(pag.valor),
        valorOriginal: Number(pag.valor_original || pag.valor),
        desconto: Number(pag.desconto || 0),
        dataPagamento: dataPag,
        metodoPagamento: metodo,
      }),
    })
    if (resposta.ok) {
      // Notificar aluno via WhatsApp
      try {
        await fetch('/api/confirmar-pagamento', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ alunoId: pag.aluno_id })
        })
      } catch (e) {}
    }

    setConfirmando(null)
    load()
  }

  async function repararPeriodo(pagamentoId: string) {
    setReparando(pagamentoId)
    const resposta = await fetch('/api/admin-reparar-periodo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pagamentoId }),
    })
    const resultado = await resposta.json().catch(() => null)
    setReparando(null)
    if (!resposta.ok) {
      alert(resultado?.error || 'Não foi possível verificar/reparar esse pagamento.')
      return
    }
    if (resultado.jaExistia) {
      alert(`Esse pagamento já tinha um período certinho (até ${new Date(resultado.dataFim + 'T00:00:00').toLocaleDateString('pt-BR')}). Nada foi alterado.`)
    } else {
      alert(`Período recriado com sucesso: até ${new Date(resultado.dataFim + 'T00:00:00').toLocaleDateString('pt-BR')}. O aluno já recebeu um aviso no WhatsApp.`)
    }
    load()
  }

  const pendentes = rows.filter(r => r.status === 'aguardando_confirmacao').length
  const rowsOrdenadas = [...rows].sort((a, b) => {
    if (ordenacao === 'recentes') return (b.created_at || '').localeCompare(a.created_at || '')
    if (ordenacao === 'antigos') return (a.created_at || '').localeCompare(b.created_at || '')
    if (ordenacao === 'maior_valor') return Number(b.valor) - Number(a.valor)
    if (ordenacao === 'menor_valor') return Number(a.valor) - Number(b.valor)
    if (ordenacao === 'nome') return (a.alunos?.nome || '').localeCompare(b.alunos?.nome || '')
    if (ordenacao === 'vencimento') return (a.data_vencimento || '').localeCompare(b.data_vencimento || '')
    return 0
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 28, marginBottom: 4 }}>Pagamentos</h1>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: -8, marginBottom: 12 }}>
        Histórico financeiro. Pra criar uma mensalidade nova (renovação, troca de plano), vá em Financeiro → Mensalidades → o aluno.
      </p>
      {pendentes > 0 && (
        <div style={{ background: '#f0a50022', border: '1px solid #f0a500', borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#f0a500', fontWeight: 700 }}>
          ⚠️ {pendentes} comprovante{pendentes > 1 ? 's' : ''} aguardando sua confirmação
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['pendente', 'aguardando_confirmacao', 'pago', 'estornado', 'cancelado', 'todos'].map(s => (
          <button key={s} onClick={() => setFiltro(s)} style={{
            background: filtro === s ? '#3fb95022' : 'var(--card)',
            border: `1.5px solid ${filtro === s ? '#3fb950' : 'var(--border)'}`, color: filtro === s ? '#3fb950' : 'var(--text2)',
            borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            {s === 'aguardando_confirmacao' ? '⚠️ Aguardando' : s === 'todos' ? 'Todos' : STATUS_LABEL[s]}
          </button>
        ))}
        <select value={ordenacao} onChange={e => setOrdenacao(e.target.value)} style={{
          background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6,
          padding: '6px 12px', color: 'var(--text)', fontSize: 12, outline: 'none', fontFamily: 'inherit',
        }}>
          <option value="recentes">Mais recentes</option>
          <option value="antigos">Mais antigos</option>
          <option value="maior_valor">Maior valor</option>
          <option value="menor_valor">Menor valor</option>
          <option value="nome">Nome (A-Z)</option>
          <option value="vencimento">Cobertura mais próxima</option>
        </select>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text2)' }}>Carregando...</p>
      ) : rows.length === 0 ? (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, padding: '1.5rem', color: 'var(--text2)', fontSize: 13 }}>
          Nenhum pagamento encontrado.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
          {rowsOrdenadas.map(p => (
            <div key={p.id} className="card card-hover" style={{
              borderColor: p.status === 'aguardando_confirmacao' ? '#f0a500' : 'var(--border)',
              padding: '14px 16px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{p.alunos?.nome || 'Sem nome'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                    {p.planos?.nome || 'Plano'} · R$ {Number(p.valor).toFixed(2).replace('.', ',')}
                    {!!p.desconto && Number(p.desconto) > 0 && (
                      <span style={{ color: '#f0a500' }}>
                        {' '}(desconto de {p.valor_original ? `${((Number(p.desconto) / Number(p.valor_original)) * 100).toFixed(0)}% ` : ''}
                        R$ {Number(p.desconto).toFixed(2).replace('.', ',')})
                      </span>
                    )}
                    {p.data_vencimento && ` · Cobre até ${new Date(p.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}`}
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
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 4,
                    background: 'var(--bg)', border: `1px solid ${STATUS_COLOR[p.status] || 'var(--border)'}`,
                    color: STATUS_COLOR[p.status] || 'var(--text2)',
                  }}>
                    {STATUS_LABEL[p.status] || p.status}
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {p.status === 'pago' && (
                      <button onClick={() => estornarPagamentoHandler(p)} disabled={estornando === p.id} className="btn btn-outline-warning btn-sm">
                        {estornando === p.id ? 'Estornando...' : '↩️ Estornar'}
                      </button>
                    )}
                    <button onClick={() => removerPagamento(p.id)} className="btn btn-ghost btn-sm">
                      🗑️ Excluir
                    </button>
                  </div>
                </div>
              </div>

              {/* Pagamento pendente (Cenário B, criado em Financeiro → Mensalidades):
                  confirma exatamente esse pagamento, sem criar nada novo. */}
              {p.status === 'pendente' && (
                <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 130 }}>
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Data do pagamento</div>
                    <input
                      type="date"
                      value={dataConfirm[p.id] || new Date().toISOString().slice(0, 10)}
                      onChange={e => setDataConfirm(prev => ({ ...prev, [p.id]: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 110 }}>
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Como pagou</div>
                    <select
                      value={metodoConfirm[p.id] || 'pix'}
                      onChange={e => setMetodoConfirm(prev => ({ ...prev, [p.id]: e.target.value }))}
                      style={inputStyle}
                    >
                      <option value="pix">Pix</option>
                      <option value="dinheiro">Dinheiro</option>
                      <option value="cartao">Cartão</option>
                    </select>
                  </div>
                  <button
                    onClick={() => confirmarPendente(p.id)}
                    disabled={confirmandoPendente === p.id}
                    className="btn btn-success"
                    style={{ whiteSpace: 'nowrap', marginTop: 18 }}
                  >
                    {confirmandoPendente === p.id ? 'Confirmando...' : '✅ Confirmar pagamento'}
                  </button>
                </div>
              )}

              {/* Reparo manual (uso raro/avançado): pagamento já "pago" mas sem período de
                  30 dias criado (ver repararPeriodoPagamento em lib/planos.ts). Fica
                  escondido de propósito -- não é uma operação normal do dia a dia. */}
              {p.status === 'pago' && (
                <details style={{ marginTop: 10 }}>
                  <summary style={{ fontSize: 11, color: 'var(--text3)', cursor: 'pointer' }}>Opções avançadas</summary>
                  <button
                    onClick={() => repararPeriodo(p.id)}
                    disabled={reparando === p.id}
                    style={{
                      marginTop: 8, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text2)',
                      borderRadius: 6, padding: '7px 12px', fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit',
                    }}
                    title="Use só se o aluno pagou mas o plano continua mostrando vencido -- confere e recria o período de 30 dias desse pagamento, se estiver faltando."
                  >
                    {reparando === p.id ? 'Verificando...' : '🔧 Verificar/recriar período desse pagamento'}
                  </button>
                </details>
              )}

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
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 130 }}>
                      <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Data do pagamento</div>
                      <input
                        type="date"
                        value={dataConfirm[p.id] || new Date().toISOString().slice(0, 10)}
                        onChange={e => setDataConfirm(prev => ({ ...prev, [p.id]: e.target.value }))}
                        style={inputStyle}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 110 }}>
                      <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Como pagou</div>
                      <select
                        value={metodoConfirm[p.id] || 'pix'}
                        onChange={e => setMetodoConfirm(prev => ({ ...prev, [p.id]: e.target.value }))}
                        style={inputStyle}
                      >
                        <option value="pix">Pix</option>
                        <option value="dinheiro">Dinheiro</option>
                        <option value="cartao">Cartão</option>
                      </select>
                    </div>
                    <button
                      onClick={() => confirmarPagamento(p.id)}
                      disabled={confirmando === p.id || (p.status as string) === 'pago'}
                      className="btn btn-success"
                      style={{ whiteSpace: 'nowrap', marginTop: 18 }}
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

export default function PagamentosPage() {
  return <Suspense><PagamentosContent /></Suspense>
}
