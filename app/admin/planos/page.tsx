'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseAdmin'

type Plano = {
  id: string
  nome: string
  vezes_semana: number
  valor: number
  ativo: boolean
  created_at: string
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6,
  padding: '9px 12px', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit',
}

export default function PlanosPage() {
  const [planos, setPlanos] = useState<Plano[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)

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
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

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
        <div style={{ display: 'grid', gap: 8, marginBottom: 20 }}>
          {planos.map(p => (
            <div key={p.id} style={{
              background: 'var(--card)', border: `1px solid ${p.ativo ? 'var(--border)' : 'var(--accent2)'}`,
              borderRadius: 6, padding: '14px 16px', opacity: p.ativo ? 1 : 0.55,
            }}>
              {editandoId === p.id ? (
                <div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                    <input value={editNome} onChange={e => setEditNome(e.target.value)} style={{ ...inputStyle, flex: '2 1 160px' }} placeholder="Nome do plano" />
                    <input type="number" min={1} value={editVezes} onChange={e => setEditVezes(e.target.value)} style={{ ...inputStyle, flex: '1 1 80px' }} placeholder="Vezes/semana" />
                    <input type="number" step="0.01" value={editValor} onChange={e => setEditValor(e.target.value)} style={{ ...inputStyle, flex: '1 1 100px' }} placeholder="Valor (R$)" />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => salvarEdicao(p.id)} style={{ background: 'var(--accent2)', border: 'none', color: '#fff', borderRadius: 6, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Salvar</button>
                    <button onClick={() => setEditandoId(null)} style={{ background: 'transparent', border: '1px solid var(--border2)', color: 'var(--text2)', borderRadius: 6, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{p.nome}</span>
                    <span style={{ fontSize: 12, color: 'var(--text2)', marginLeft: 8 }}>
                      {p.vezes_semana}x/semana · R$ {Number(p.valor).toFixed(2)}
                    </span>
                    {!p.ativo && <span style={{ fontSize: 11, color: 'var(--accent2)', marginLeft: 8 }}>(desativado)</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => abrirEdicao(p)} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 4, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                      ✏️ Editar
                    </button>
                    <button onClick={() => toggleAtivo(p)} style={{
                      background: 'transparent', border: `1px solid ${p.ativo ? 'var(--border)' : 'var(--accent2)'}`,
                      color: p.ativo ? 'var(--text2)' : 'var(--accent2)', borderRadius: 4, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                      {p.ativo ? 'Desativar' : 'Ativar'}
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
          <div style={{ display: 'grid', gap: 10, marginBottom: 12 }}>
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
            <button onClick={criar} disabled={salvando || !nome.trim() || !valor} style={{
              background: 'var(--accent2)', border: 'none', color: '#fff', borderRadius: 6,
              padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              opacity: (salvando || !nome.trim() || !valor) ? 0.6 : 1,
            }}>
              {salvando ? 'Criando...' : '✅ Criar plano'}
            </button>
            <button onClick={() => setMostrarForm(false)} disabled={salvando} style={{
              background: 'transparent', border: '1px solid var(--border2)', color: 'var(--text2)', borderRadius: 6,
              padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
