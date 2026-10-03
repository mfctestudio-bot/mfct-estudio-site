'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseAdmin'
import { Cabecalho } from '@/components/ui/Cabecalho'

type AlunoOpt = { id: string; nome: string }

type CreditoRow = {
  id: string
  aluno_id: string
  valor: number
  status: string
  comprovante_url: string | null
  comprovante_recebido_em: string | null
  confirmado_em: string | null
  metodo_pagamento: string | null
  data_compra: string
  data_disponivel_ate: string | null
  alunos: { nome: string; telefone: string | null } | null
}

const STATUS_LABEL: Record<string, string> = {
  aguardando_pagamento: 'Aguardando pagamento',
  aguardando_confirmacao: 'Aguard. confirmação',
  disponivel: 'Disponível pra usar',
  agendado: 'Já agendou',
  usado: 'Usado',
  expirado: 'Expirado',
  cancelado: 'Cancelado',
}
const STATUS_COLOR: Record<string, string> = {
  aguardando_pagamento: 'var(--text3)',
  aguardando_confirmacao: '#f0a500',
  disponivel: '#3fb950',
  agendado: 'var(--accent)',
  usado: 'var(--text3)',
  expirado: 'var(--danger)',
  cancelado: 'var(--text3)',
}


export default function AvulsasPage() {
  const [rows, setRows] = useState<CreditoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('aguardando_confirmacao')
  const [imgModal, setImgModal] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [metodoConfirm, setMetodoConfirm] = useState<Record<string, string>>({})

  const [novoModal, setNovoModal] = useState(false)
  const [alunosOpt, setAlunosOpt] = useState<AlunoOpt[]>([])
  const [novoAlunoId, setNovoAlunoId] = useState('')
  const [novoValor, setNovoValor] = useState('15')
  const [salvandoNovo, setSalvandoNovo] = useState(false)

  async function load() {
    setLoading(true)
    let query = supabase.from('creditos_avulsos')
      .select('id, aluno_id, valor, status, comprovante_url, comprovante_recebido_em, confirmado_em, metodo_pagamento, data_compra, data_disponivel_ate, alunos(nome, telefone)')
      .order('created_at', { ascending: false })
    if (filtro !== 'todos') query = query.eq('status', filtro)
    const { data } = await query
    setRows((data as unknown as CreditoRow[]) || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [filtro])

  useEffect(() => {
    supabase.from('alunos').select('id, nome').order('nome').then(({ data }) => setAlunosOpt((data as AlunoOpt[]) || []))
    // Valor padrão vem do serviço da categoria "Aula avulsa"
    supabase.from('servicos').select('nome, valor, servicos_categorias(nome)').then(({ data }) => {
      const lista = (data as unknown as { nome: string; valor: number; servicos_categorias: { nome: string } | { nome: string }[] | null }[]) || []
      const cat = (x: typeof lista[number]) => ((Array.isArray(x.servicos_categorias) ? x.servicos_categorias[0] : x.servicos_categorias)?.nome || '').toLowerCase()
      const s = lista.find(x => cat(x).includes('avulsa')) || lista.find(x => x.nome.toLowerCase().includes('avulsa'))
      if (s) setNovoValor(String(Number(s.valor)))
    })
  }, [])

  async function confirmar(id: string) {
    setConfirmando(id)
    const dataDisponivelAte = new Date()
    dataDisponivelAte.setDate(dataDisponivelAte.getDate() + 7)
    await supabase.from('creditos_avulsos').update({
      status: 'disponivel',
      confirmado_em: new Date().toISOString(),
      confirmado_por: 'admin',
      metodo_pagamento: metodoConfirm[id] || 'pix',
      data_disponivel_ate: dataDisponivelAte.toISOString(),
    }).eq('id', id)

    // Avisar o aluno que já pode marcar
    const row = rows.find(r => r.id === id)
    if (row?.alunos?.telefone) {
      try {
        await fetch('/api/confirmar-avulsa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: row.alunos.telefone, nomeAluno: row.alunos.nome, prazo: dataDisponivelAte.toISOString() }),
        })
      } catch (e) {}
    }
    setConfirmando(null)
    load()
  }

  async function cancelar(id: string) {
    if (!confirm('Cancelar esse crédito?')) return
    await supabase.from('creditos_avulsos').update({ status: 'cancelado' }).eq('id', id)
    load()
  }

  async function salvarNovo() {
    if (!novoAlunoId || !novoValor) return
    setSalvandoNovo(true)
    await supabase.from('creditos_avulsos').insert({
      aluno_id: novoAlunoId,
      valor: Number(novoValor),
      status: 'aguardando_confirmacao',
    })
    setSalvandoNovo(false)
    setNovoModal(false)
    setNovoAlunoId('')
    load()
  }

  const pendentes = rows.filter(r => r.status === 'aguardando_confirmacao').length

  return (
    <div>
      <Cabecalho
        titulo="Pagamentos de serviços"
        subtitulo="Aula avulsa: quem comprou aula avulsa — a pessoa paga, você confirma, e ela pode marcar o dia que quiser em até 7 dias. (O preço e o Pix da aula avulsa se ajustam em Serviços → Aula Avulsa.) Vale tanto pra quem não tem plano fixo quanto pra aluno com plano mensal que quer uma aula extra."
        acoes={
          <button onClick={() => setNovoModal(true)} className="btn btn-primary">
            + Registrar crédito
          </button>
        }
      />

      {pendentes > 0 && (
        <div className="aviso aviso-atencao">
          ⚠️ {pendentes} crédito{pendentes > 1 ? 's' : ''} aguardando sua confirmação
        </div>
      )}

      <div className="chips">
        {['aguardando_confirmacao', 'disponivel', 'agendado', 'usado', 'expirado', 'todos'].map(s => (
          <button key={s} onClick={() => setFiltro(s)} className={`chip${filtro === s ? ' ativo' : ''}`}>
            {s === 'todos' ? 'Todos' : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="vazio">Carregando...</p>
      ) : rows.length === 0 ? (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, padding: '1.5rem', color: 'var(--text2)', fontSize: 13 }}>
          Nenhum crédito encontrado.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
          {rows.map(c => (
            <div key={c.id} className="card card-hover" style={{
              borderColor: c.status === 'aguardando_confirmacao' ? '#f0a500' : 'var(--border)',
              padding: '14px 16px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{c.alunos?.nome || 'Sem nome'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                    R$ {Number(c.valor).toFixed(2).replace('.', ',')}
                    {c.data_disponivel_ate && ` · Prazo até ${new Date(c.data_disponivel_ate).toLocaleDateString('pt-BR')}`}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 4,
                    color: STATUS_COLOR[c.status] || 'var(--text2)', border: `1px solid ${STATUS_COLOR[c.status] || 'var(--border)'}`,
                  }}>
                    {STATUS_LABEL[c.status] || c.status}
                  </span>
                  {(c.status === 'aguardando_confirmacao' || c.status === 'aguardando_pagamento') && (
                    <button onClick={() => cancelar(c.id)} className="btn btn-outline-danger btn-sm">
                      Cancelar
                    </button>
                  )}
                </div>
              </div>

              {c.status === 'aguardando_confirmacao' && (
                <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  {c.comprovante_url && (
                    <button onClick={() => setImgModal(c.comprovante_url!)} className="btn btn-ghost btn-sm">
                      🖼️ Ver comprovante
                    </button>
                  )}
                  <div style={{ minWidth: 110 }}>
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Como pagou</div>
                    <select className="campo" value={metodoConfirm[c.id] || 'pix'} onChange={e => setMetodoConfirm(prev => ({ ...prev, [c.id]: e.target.value }))}>
                      <option value="pix">Pix</option>
                      <option value="dinheiro">Dinheiro</option>
                      <option value="cartao">Cartão</option>
                    </select>
                  </div>
                  <button
                    onClick={() => confirmar(c.id)}
                    disabled={confirmando === c.id}
                    className="btn btn-success"
                  >
                    {confirmando === c.id ? 'Confirmando...' : '✅ Confirmar pagamento'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal comprovante */}
      {imgModal && (
        <div onClick={() => setImgModal(null)} style={{ position: 'fixed', inset: 0, background: '#000c', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, cursor: 'pointer' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imgModal} alt="Comprovante" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8 }} />
        </div>
      )}

      {/* Modal novo crédito manual */}
      {novoModal && (
        <div onClick={() => setNovoModal(false)} style={{ position: 'fixed', inset: 0, background: '#000c', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: 20, width: '100%', maxWidth: 380 }}>
            <h3 style={{ fontSize: 16, marginBottom: 16 }}>Registrar crédito de aula avulsa</h3>
            <div style={{ marginBottom: 12 }}>
              <label className="rotulo">Aluno</label>
              <select className="campo" value={novoAlunoId} onChange={e => setNovoAlunoId(e.target.value)}>
                <option value="">-- selecionar --</option>
                {alunosOpt.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label className="rotulo">Valor (R$)</label>
              <input className="campo" type="number" step="0.01" value={novoValor} onChange={e => setNovoValor(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={salvarNovo} disabled={salvandoNovo || !novoAlunoId} className="btn btn-success" style={{ flex: 1 }}>
                {salvandoNovo ? 'Salvando...' : 'Salvar (aguardando confirmação)'}
              </button>
              <button onClick={() => setNovoModal(false)} className="btn btn-neutral">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
