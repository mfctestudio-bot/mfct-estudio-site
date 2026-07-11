'use client'
import { useEffect, useState } from 'react'
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
  alunos: { nome: string; telefone: string } | null
  planos: { nome: string } | null
}

type AlunoOpt = { id: string; nome: string; plano_id: string | null }
type PlanoOpt = { id: string; nome: string; valor: number }

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
  const [ordenacao, setOrdenacao] = useState('recentes')
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todos')
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [dataConfirm, setDataConfirm] = useState<Record<string, string>>({})
  const [metodoConfirm, setMetodoConfirm] = useState<Record<string, string>>({})
  const [imgModal, setImgModal] = useState<string | null>(null)

  const [editando, setEditando] = useState<PagamentoRow | null>(null)
  const [editValor, setEditValor] = useState('')
  const [editDesconto, setEditDesconto] = useState('')
  const [editDescontoTipo, setEditDescontoTipo] = useState<'valor' | 'percentual'>('valor')
  const [editStatus, setEditStatus] = useState('')
  const [editData, setEditData] = useState('')
  const [editVencimento, setEditVencimento] = useState('')
  const [editAlunoId, setEditAlunoId] = useState('')
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)

  const [novoModal, setNovoModal] = useState(false)
  const [alunosOpt, setAlunosOpt] = useState<AlunoOpt[]>([])
  const [planosOpt, setPlanosOpt] = useState<PlanoOpt[]>([])
  const [novoAlunoId, setNovoAlunoId] = useState('')
  const [novoPlanoId, setNovoPlanoId] = useState('')
  const [novoValor, setNovoValor] = useState('')
  const [novoDesconto, setNovoDesconto] = useState('0')
  const [novoDescontoTipo, setNovoDescontoTipo] = useState<'valor' | 'percentual'>('valor')
  const [novoData, setNovoData] = useState(() => new Date().toISOString().slice(0, 10))
  const [salvandoNovo, setSalvandoNovo] = useState(false)

  async function load() {
    setLoading(true)
    let q = supabase
      .from('pagamentos')
      .select('id, valor, valor_original, desconto, status, data_vencimento, data_pagamento, comprovante_url, comprovante_recebido_em, confirmado_em, metodo_pagamento, observacao, created_at, aluno_id, alunos(nome, telefone), planos(nome)')
      .order('created_at', { ascending: false })
      .limit(100)
    if (filtro !== 'todos') q = q.eq('status', filtro)
    const { data } = await q
    setRows((data as unknown as PagamentoRow[]) || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [filtro])

  function abrirNovoModal() {
    setNovoAlunoId(''); setNovoPlanoId(''); setNovoValor(''); setNovoDesconto('0')
    setNovoData(new Date().toISOString().slice(0, 10))
    if (alunosOpt.length === 0) {
      supabase.from('alunos').select('id, nome, plano_id').order('nome').then(({ data }) => setAlunosOpt((data as AlunoOpt[]) || []))
    }
    if (planosOpt.length === 0) {
      supabase.from('planos').select('id, nome, valor').order('valor').then(({ data }) => setPlanosOpt((data as PlanoOpt[]) || []))
    }
    setNovoModal(true)
  }

  async function salvarNovoPagamento() {
    if (!novoAlunoId || !novoValor) return
    setSalvandoNovo(true)
    const plano = planosOpt.find(p => p.id === novoPlanoId)
    const valorOriginalPlano = plano ? Number(plano.valor) : Number(novoValor)
    const descontoReais = novoDescontoTipo === 'percentual'
      ? Math.round(valorOriginalPlano * (Number(novoDesconto || 0) / 100) * 100) / 100
      : Number(novoDesconto || 0)
    const dataPagDate = new Date(novoData + 'T12:00:00')
    const dataVencimento = new Date(dataPagDate)
    dataVencimento.setMonth(dataVencimento.getMonth() + 1)
    await supabase.from('pagamentos').insert({
      aluno_id: novoAlunoId,
      plano_id: novoPlanoId || null,
      valor: Number(novoValor),
      valor_original: valorOriginalPlano,
      desconto: descontoReais,
      status: 'pago',
      metodo_pagamento: 'manual',
      confirmado_em: new Date().toISOString(),
      confirmado_por: 'admin',
      data_pagamento: dataPagDate.toISOString(),
      data_vencimento: dataVencimento.toISOString().slice(0, 10),
    })
    setSalvandoNovo(false)
    setNovoModal(false)
    load()
  }

  function abrirEdicao(p: PagamentoRow) {
    setEditando(p)
    setEditValor(String(p.valor))
    setEditDesconto(String(p.desconto || 0))
    setEditDescontoTipo('valor')
    setEditStatus(p.status)
    setEditData(p.data_pagamento ? p.data_pagamento.slice(0, 10) : new Date().toISOString().slice(0, 10))
    setEditVencimento(p.data_vencimento ? p.data_vencimento.slice(0, 10) : '')
    setEditAlunoId(p.aluno_id)
  }

  async function salvarEdicao() {
    if (!editando) return
    setSalvandoEdicao(true)
    const valorRef = editando.valor_original ? Number(editando.valor_original) : Number(editValor)
    const descontoReais = editDescontoTipo === 'percentual'
      ? Math.round(valorRef * (Number(editDesconto || 0) / 100) * 100) / 100
      : Number(editDesconto || 0)
    await supabase.from('pagamentos').update({
      valor: Number(editValor),
      desconto: descontoReais,
      status: editStatus,
      data_pagamento: editStatus === 'pago' ? new Date(editData + 'T12:00:00').toISOString() : editando.data_pagamento,
      data_vencimento: editVencimento ? new Date(editVencimento + 'T12:00:00').toISOString() : null,
      aluno_id: editAlunoId,
    }).eq('id', editando.id)
    setSalvandoEdicao(false)
    setEditando(null)
    load()
  }

  async function removerPagamento(id: string) {
    if (!confirm('Remover este pagamento? Essa ação não pode ser desfeita.')) return
    await supabase.from('pagamentos').delete().eq('id', id)
    setEditando(null)
    load()
  }



  async function confirmarPagamento(id: string) {
    setConfirmando(id)
    const dataPag = dataConfirm[id] || new Date().toISOString().slice(0, 10)
    const dataPagDate = new Date(dataPag + 'T12:00:00')
    const dataVencimento = new Date(dataPagDate)
    dataVencimento.setMonth(dataVencimento.getMonth() + 1)
    const metodo = metodoConfirm[id] || 'pix'

    // Atualizar pagamento
    await supabase.from('pagamentos').update({
      status: 'pago',
      confirmado_em: new Date().toISOString(),
      confirmado_por: 'admin',
      data_pagamento: dataPagDate.toISOString(),
      data_vencimento: dataVencimento.toISOString().slice(0, 10),
      metodo_pagamento: metodo,
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
        <button onClick={abrirNovoModal} style={{
          background: 'var(--accent2)', border: 'none', color: '#fff', borderRadius: 6,
          padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          + Registrar pagamento
        </button>
      </div>
      {pendentes > 0 && (
        <div style={{ background: '#f0a50022', border: '1px solid #f0a500', borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#f0a500', fontWeight: 700 }}>
          ⚠️ {pendentes} comprovante{pendentes > 1 ? 's' : ''} aguardando sua confirmação
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['aguardando_confirmacao', 'pendente', 'pago', 'vencido', 'todos'].map(s => (
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
          <option value="vencimento">Vencimento mais próximo</option>
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
            <div key={p.id} style={{
              background: 'var(--card)', border: `1px solid ${p.status === 'aguardando_confirmacao' ? '#f0a500' : 'var(--border)'}`,
              borderRadius: 6, padding: '14px 16px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{p.alunos?.nome || 'Sem nome'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                    {p.planos?.nome || 'Plano'} · R$ {Number(p.valor).toFixed(2).replace('.', ',')}
                    {!!p.desconto && Number(p.desconto) > 0 && (
                      <span style={{ color: '#f0a500' }}> (desconto de R$ {Number(p.desconto).toFixed(2).replace('.', ',')})</span>
                    )}
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
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 4,
                    background: 'var(--bg)', border: `1px solid ${STATUS_COLOR[p.status] || 'var(--border)'}`,
                    color: STATUS_COLOR[p.status] || 'var(--text2)',
                  }}>
                    {STATUS_LABEL[p.status] || p.status}
                  </span>
                  <button onClick={() => abrirEdicao(p)} style={{
                    background: 'transparent', border: '1px solid var(--border)', color: 'var(--text2)',
                    borderRadius: 4, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    ✏️ Editar
                  </button>
                </div>
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
                      style={{
                        background: '#3fb950', border: 'none', color: '#fff',
                        borderRadius: 6, padding: '10px 18px', fontSize: 13, fontWeight: 700,
                        cursor: confirmando === p.id || (p.status as string) === 'pago' ? 'not-allowed' : 'pointer',
                        fontFamily: 'inherit', whiteSpace: 'nowrap',
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

      {/* Modal editar pagamento */}
      {editando && (
        <div onClick={() => !salvandoEdicao && setEditando(null)} style={{
          position: 'fixed', inset: 0, background: '#000c', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16,
        }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: 20, width: '100%', maxWidth: 380 }}>
            <h3 style={{ fontSize: 16, marginBottom: 4 }}>Editar pagamento</h3>
            <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 16 }}>{editando.planos?.nome || 'Plano'}</p>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, marginBottom: 6, display: 'block' }}>Aluno</label>
              <select value={editAlunoId} onChange={e => setEditAlunoId(e.target.value)} style={inputStyle}>
                {alunosOpt.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, marginBottom: 6, display: 'block' }}>Valor (R$)</label>
              <input type="number" step="0.01" value={editValor} onChange={e => setEditValor(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, marginBottom: 6, display: 'block' }}>Desconto</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="number" step="0.01" value={editDesconto} onChange={e => setEditDesconto(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                  {(['valor', 'percentual'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setEditDescontoTipo(t)} style={{
                      background: editDescontoTipo === t ? '#3fb95022' : 'transparent',
                      color: editDescontoTipo === t ? '#3fb950' : 'var(--text2)',
                      border: 'none', padding: '0 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                      {t === 'valor' ? 'R$' : '%'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, marginBottom: 6, display: 'block' }}>Status</label>
              <select value={editStatus} onChange={e => setEditStatus(e.target.value)} style={inputStyle}>
                {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, marginBottom: 6, display: 'block' }}>Data de vencimento (desse pagamento)</label>
              <input type="date" value={editVencimento} onChange={e => setEditVencimento(e.target.value)} style={inputStyle} />
            </div>
            {editStatus === 'pago' && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, marginBottom: 6, display: 'block' }}>Data do pagamento</label>
                <input type="date" value={editData} onChange={e => setEditData(e.target.value)} style={inputStyle} />
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button onClick={salvarEdicao} disabled={salvandoEdicao} style={{
                flex: 1, background: '#3fb950', border: 'none', color: '#fff', borderRadius: 6,
                padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: salvandoEdicao ? 0.6 : 1,
              }}>
                {salvandoEdicao ? 'Salvando...' : 'Salvar'}
              </button>
              <button onClick={() => removerPagamento(editando.id)} disabled={salvandoEdicao} style={{
                background: 'transparent', border: '1px solid var(--accent2)', color: 'var(--accent2)', borderRadius: 6,
                padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                🗑️ Remover
              </button>
              <button onClick={() => setEditando(null)} disabled={salvandoEdicao} style={{
                background: 'transparent', border: '1px solid var(--border2)', color: 'var(--text2)', borderRadius: 6,
                padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal novo pagamento manual */}
      {novoModal && (
        <div onClick={() => !salvandoNovo && setNovoModal(false)} style={{
          position: 'fixed', inset: 0, background: '#000c', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16,
        }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: 20, width: '100%', maxWidth: 380 }}>
            <h3 style={{ fontSize: 16, marginBottom: 16 }}>Registrar pagamento manual</h3>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, marginBottom: 6, display: 'block' }}>Aluno</label>
              <select value={novoAlunoId} onChange={e => setNovoAlunoId(e.target.value)} style={inputStyle}>
                <option value="">-- selecionar --</option>
                {alunosOpt.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, marginBottom: 6, display: 'block' }}>Plano</label>
              <select value={novoPlanoId} onChange={e => {
                setNovoPlanoId(e.target.value)
                const plano = planosOpt.find(p => p.id === e.target.value)
                if (plano) setNovoValor(String(plano.valor))
              }} style={inputStyle}>
                <option value="">-- sem plano / avulsa --</option>
                {planosOpt.map(p => <option key={p.id} value={p.id}>{p.nome} — R$ {Number(p.valor).toFixed(2)}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, marginBottom: 6, display: 'block' }}>Valor cobrado (R$)</label>
              <input type="number" step="0.01" value={novoValor} onChange={e => setNovoValor(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, marginBottom: 6, display: 'block' }}>Desconto</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="number" step="0.01" value={novoDesconto}
                  onChange={e => {
                    const novo = e.target.value
                    setNovoDesconto(novo)
                    const plano = planosOpt.find(p => p.id === novoPlanoId)
                    if (plano) {
                      const valorOriginal = Number(plano.valor)
                      const descontoReais = novoDescontoTipo === 'percentual' ? valorOriginal * (Number(novo || 0) / 100) : Number(novo || 0)
                      setNovoValor(String(Math.max(0, Math.round((valorOriginal - descontoReais) * 100) / 100)))
                    }
                  }}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                  {(['valor', 'percentual'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setNovoDescontoTipo(t)} style={{
                      background: novoDescontoTipo === t ? '#3fb95022' : 'transparent',
                      color: novoDescontoTipo === t ? '#3fb950' : 'var(--text2)',
                      border: 'none', padding: '0 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                      {t === 'valor' ? 'R$' : '%'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, marginBottom: 6, display: 'block' }}>Data do pagamento</label>
              <input type="date" value={novoData} onChange={e => setNovoData(e.target.value)} style={inputStyle} />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button onClick={salvarNovoPagamento} disabled={salvandoNovo || !novoAlunoId || !novoValor} style={{
                flex: 1, background: '#3fb950', border: 'none', color: '#fff', borderRadius: 6,
                padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: (salvandoNovo || !novoAlunoId || !novoValor) ? 0.6 : 1,
              }}>
                {salvandoNovo ? 'Salvando...' : '✅ Registrar'}
              </button>
              <button onClick={() => setNovoModal(false)} disabled={salvandoNovo} style={{
                background: 'transparent', border: '1px solid var(--border2)', color: 'var(--text2)', borderRadius: 6,
                padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Cancelar
              </button>
            </div>
          </div>
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
