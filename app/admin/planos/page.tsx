'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseAdmin'

type Plano = {
  id: string
  nome: string
  vezes_semana: number
  valor: number
  ativo: boolean
  created_at: string
}

type Desconto = {
  id: string
  plano_id: string
  nome: string
  motivo: string
  valor: number
  ativo: boolean
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6,
  padding: '9px 12px', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit',
}

function PlanosContent() {
  const params = useSearchParams()
  const [planos, setPlanos] = useState<Plano[]>([])
  const [descontos, setDescontos] = useState<Desconto[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [planoExpandido, setPlanoExpandido] = useState<string | null>(null)
  const [novoDescNome, setNovoDescNome] = useState('')
  const [novoDescValor, setNovoDescValor] = useState('')

  const [nome, setNome] = useState('')
  const [vezes, setVezes] = useState('3')
  const [valor, setValor] = useState('')
  const [salvando, setSalvando] = useState(false)

  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editNome, setEditNome] = useState('')
  const [editVezes, setEditVezes] = useState('')
  const [editValor, setEditValor] = useState('')

  async function carregar() {
    setLoading(true)
    const { data } = await supabase.from('planos').select('*').order('valor')
    setPlanos((data as Plano[]) || [])
    const { data: descData } = await supabase.from('descontos_planos').select('*').order('valor', { ascending: false })
    setDescontos((descData as Desconto[]) || [])
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  // Atalho do menu: clicar num plano específico na lista suspensa do menu
  // já abre direto a edição dele aqui, via ?editar=<id> na URL.
  useEffect(() => {
    const editarId = params.get('editar')
    if (editarId && planos.some(p => p.id === editarId)) {
      const plano = planos.find(p => p.id === editarId)
      if (plano) abrirEdicao(plano)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planos, params])

  async function criarDesconto(planoId: string) {
    if (!novoDescNome.trim() || !novoDescValor) return
    await supabase.from('descontos_planos').insert({
      plano_id: planoId, nome: novoDescNome.trim(), motivo: novoDescNome.trim().toLowerCase(), valor: Number(novoDescValor), ativo: true,
    })
    setNovoDescNome(''); setNovoDescValor('')
    carregar()
  }

  async function toggleDescontoAtivo(d: Desconto) {
    await supabase.from('descontos_planos').update({ ativo: !d.ativo }).eq('id', d.id)
    setDescontos(prev => prev.map(x => x.id === d.id ? { ...x, ativo: !x.ativo } : x))
  }

  async function excluirDesconto(id: string) {
    if (!confirm('Apagar esse desconto? A Elen não vai mais poder oferecer ele.')) return
    await supabase.from('descontos_planos').delete().eq('id', id)
    carregar()
  }

  async function criar() {
    if (!nome.trim() || !valor) return
    setSalvando(true)
    await supabase.from('planos').insert({
      nome: nome.trim(), vezes_semana: Number(vezes) || 1, valor: Number(valor), ativo: true,
    })
    setSalvando(false)
    setNome(''); setVezes('3'); setValor(''); setMostrarForm(false)
    carregar()
  }

  function abrirEdicao(p: Plano) {
    setEditandoId(p.id)
    setEditNome(p.nome)
    setEditVezes(String(p.vezes_semana))
    setEditValor(String(p.valor))
  }

  async function salvarEdicao(id: string) {
    await supabase.from('planos').update({
      nome: editNome.trim(), vezes_semana: Number(editVezes) || 1, valor: Number(editValor),
    }).eq('id', id)
    setEditandoId(null)
    carregar()
  }

  async function toggleAtivo(p: Plano) {
    await supabase.from('planos').update({ ativo: !p.ativo }).eq('id', p.id)
    setPlanos(prev => prev.map(x => x.id === p.id ? { ...x, ativo: !x.ativo } : x))
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Planos</h1>
      <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>
        Crie, edite ou desative os tipos de plano oferecidos pelo estúdio. Isso não mexe em nenhum aluno já cadastrado — só afeta quais opções aparecem pra escolher daqui pra frente.
      </p>

      {loading ? (
        <p style={{ color: 'var(--text2)' }}>Carregando...</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginBottom: 20 }}>
          {planos.map(p => (
            <div key={p.id} className="card card-hover" style={{
              borderColor: p.ativo ? 'var(--border)' : 'var(--danger)',
              padding: '14px 16px', opacity: p.ativo ? 1 : 0.55,
            }}>
              {editandoId === p.id ? (
                <div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                    <input value={editNome} onChange={e => setEditNome(e.target.value)} style={{ ...inputStyle, flex: '2 1 160px' }} placeholder="Nome do plano" />
                    <input type="number" min={1} value={editVezes} onChange={e => setEditVezes(e.target.value)} style={{ ...inputStyle, flex: '1 1 80px' }} placeholder="Vezes/semana" />
                    <input type="number" step="0.01" value={editValor} onChange={e => setEditValor(e.target.value)} style={{ ...inputStyle, flex: '1 1 100px' }} placeholder="Valor (R$)" />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => salvarEdicao(p.id)} className="btn btn-primary btn-sm">Salvar</button>
                    <button onClick={() => setEditandoId(null)} className="btn btn-neutral btn-sm">Cancelar</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{p.nome}</span>
                    <span style={{ fontSize: 12, color: 'var(--text2)', marginLeft: 8 }}>
                      {p.vezes_semana}x/semana · R$ {Number(p.valor).toFixed(2)}
                    </span>
                    {!p.ativo && <span style={{ fontSize: 11, color: 'var(--danger)', marginLeft: 8 }}>(desativado)</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setPlanoExpandido(planoExpandido === p.id ? null : p.id)} className="btn btn-ghost btn-sm">
                      🏷️ Descontos ({descontos.filter(d => d.plano_id === p.id && d.ativo).length})
                    </button>
                    <button onClick={() => abrirEdicao(p)} className="btn btn-ghost btn-sm">
                      ✏️ Editar
                    </button>
                    <button onClick={() => toggleAtivo(p)} style={{
                      background: 'transparent', border: `1px solid ${p.ativo ? 'var(--border)' : 'var(--danger)'}`,
                      color: p.ativo ? 'var(--text2)' : 'var(--danger)', borderRadius: 4, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                      {p.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                  </div>
                </div>
              )}

              {planoExpandido === p.id && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>
                    A Elen só pode oferecer os descontos que estiverem aqui — ela nunca inventa um valor.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                    {descontos.filter(d => d.plano_id === p.id).map(d => (
                      <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: 6, background: 'var(--bg)', opacity: d.ativo ? 1 : 0.5 }}>
                        <span style={{ fontSize: 12 }}>{d.nome} — R$ {Number(d.valor).toFixed(2)} de desconto{!d.ativo && ' (desativado)'}</span>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => toggleDescontoAtivo(d)} className="btn btn-ghost btn-sm">
                            {d.ativo ? 'Desativar' : 'Ativar'}
                          </button>
                          <button onClick={() => excluirDesconto(d.id)} className="btn btn-outline-danger btn-sm">
                            Apagar
                          </button>
                        </div>
                      </div>
                    ))}
                    {!descontos.filter(d => d.plano_id === p.id).length && (
                      <p style={{ fontSize: 12, color: 'var(--text3)' }}>Nenhum desconto configurado ainda pra esse plano.</p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={novoDescNome} onChange={e => setNovoDescNome(e.target.value)} placeholder="Ex: Falta de dinheiro" style={{ ...inputStyle, flex: 2 }} />
                    <input type="number" step="0.01" value={novoDescValor} onChange={e => setNovoDescValor(e.target.value)} placeholder="Valor R$" style={{ ...inputStyle, flex: 1 }} />
                    <button onClick={() => criarDesconto(p.id)} disabled={!novoDescNome.trim() || !novoDescValor} className="btn btn-primary btn-sm">
                      + Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!mostrarForm ? (
        <button onClick={() => setMostrarForm(true)} style={{
          background: 'transparent', border: '1px solid var(--accent)', color: 'var(--accent)',
          borderRadius: 6, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          + Criar novo plano
        </button>
      ) : (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
          <h3 style={{ fontSize: 14, marginBottom: 12 }}>Novo plano</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, marginBottom: 6, display: 'block' }}>Nome</label>
              <input value={nome} onChange={e => setNome(e.target.value)} style={inputStyle} placeholder="Ex: Plano 5x semana" />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, marginBottom: 6, display: 'block' }}>Vezes por semana</label>
                <input type="number" min={1} value={vezes} onChange={e => setVezes(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, marginBottom: 6, display: 'block' }}>Valor mensal (R$)</label>
                <input type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} style={inputStyle} placeholder="Ex: 199.90" />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={criar} disabled={salvando || !nome.trim() || !valor} className="btn btn-primary">
              {salvando ? 'Criando...' : '✅ Criar plano'}
            </button>
            <button onClick={() => setMostrarForm(false)} disabled={salvando} className="btn btn-neutral">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PlanosPage() {
  return <Suspense><PlanosContent /></Suspense>
}
