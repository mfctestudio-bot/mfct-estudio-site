'use client'
import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseAdmin'
import { Aluno, Plano } from '@/lib/supabase'

const STATUS_LABEL: Record<string, string> = {
  lead: 'Lead',
  experimental_oferecida: 'Exp. oferecida',
  experimental_agendada: 'Exp. agendada',
  experimental_realizada: 'Exp. realizada',
  faltou_experimental: 'Faltou exp.',
  em_negociacao: 'Em negociação',
  perdido: 'Perdido',
  experimental: 'Experimental',
  ativo: 'Ativo',
  vencido: 'Vencido',
  cancelado: 'Cancelado',
}

const STATUS_COLOR: Record<string, string> = {
  lead: 'var(--text2)',
  experimental_oferecida: 'var(--accent)',
  experimental_agendada: 'var(--accent)',
  experimental_realizada: 'var(--accent)',
  faltou_experimental: 'var(--text3)',
  em_negociacao: 'var(--accent)',
  perdido: 'var(--text3)',
  experimental: 'var(--accent)',
  ativo: '#3fb950',
  vencido: 'var(--accent2)',
  cancelado: 'var(--text3)',
}

function AlunosContent() {
  const params = useSearchParams()
  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [planos, setPlanos] = useState<Plano[]>([])
  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState(params.get('status') || 'todos')
  const [loading, setLoading] = useState(true)
  const [novoOpen, setNovoOpen] = useState(false)

  async function load() {
    setLoading(true)
    const { data: planosData } = await supabase.from('planos').select('*').order('valor')
    setPlanos(planosData || [])

    let query = supabase.from('alunos').select('*, planos(*)').order('nome')
    if (statusFiltro !== 'todos') query = query.eq('status_plano', statusFiltro)
    const { data } = await query
    setAlunos(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [statusFiltro])

  const filtrados = alunos.filter(a =>
    a.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (a.cpf || '').includes(busca) ||
    (a.telefone || '').includes(busca)
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 28 }}>Alunos</h1>
        <button onClick={() => setNovoOpen(true)} style={{
          background: 'var(--accent2)', color: '#fff', border: 'none', borderRadius: 6,
          padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          + Novo aluno
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          placeholder="Buscar por nome, CPF ou telefone..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{
            flex: 1, minWidth: 200, background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 6, padding: '10px 12px', color: 'var(--text)', fontSize: 14, outline: 'none',
          }}
        />
        <select value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)} style={{
          background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6,
          padding: '10px 12px', color: 'var(--text)', fontSize: 14, outline: 'none',
        }}>
          <option value="todos">Todos os status</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text2)' }}>Carregando...</p>
      ) : filtrados.length === 0 ? (
        <p style={{ color: 'var(--text2)' }}>Nenhum aluno encontrado.</p>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {filtrados.map(a => (
            <Link key={a.id} href={`/admin/alunos/${a.id}`} style={{
              background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6,
              padding: '14px 16px', textDecoration: 'none', color: 'var(--text)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{a.nome}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                  {a.telefone || 'sem telefone'} {a.planos ? `· ${a.planos.nome}` : ''}
                </div>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 4,
                color: STATUS_COLOR[a.status_plano], border: `1px solid ${STATUS_COLOR[a.status_plano]}`,
                textTransform: 'uppercase', letterSpacing: '0.5px',
              }}>
                {STATUS_LABEL[a.status_plano]}
              </span>
            </Link>
          ))}
        </div>
      )}

      {novoOpen && <NovoAlunoModal planos={planos} onClose={() => setNovoOpen(false)} onSaved={() => { setNovoOpen(false); load() }} />}
    </div>
  )
}

function NovoAlunoModal({ planos, onClose, onSaved }: { planos: Plano[]; onClose: () => void; onSaved: () => void }) {
  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [telefone, setTelefone] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [planoId, setPlanoId] = useState('')
  const [status, setStatus] = useState('ativo')
  const [saving, setSaving] = useState(false)

  async function salvar() {
    if (!nome.trim()) return
    setSaving(true)
    await supabase.from('alunos').insert({
      nome: nome.trim(),
      cpf: cpf.trim() || null,
      telefone: telefone.trim() || null,
      data_nascimento: dataNascimento || null,
      plano_id: planoId || null,
      status_plano: status,
    })
    setSaving(false)
    onSaved()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16,
    }}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '1.5rem', width: '100%', maxWidth: 420 }}>
        <h2 style={{ fontSize: 20, marginBottom: 16 }}>Novo aluno</h2>
        <Campo label="Nome">
          <input value={nome} onChange={e => setNome(e.target.value)} style={inputStyle} autoFocus />
        </Campo>
        <Campo label="CPF">
          <input value={cpf} onChange={e => setCpf(e.target.value)} style={inputStyle} placeholder="opcional" />
        </Campo>
        <Campo label="Telefone">
          <input value={telefone} onChange={e => setTelefone(e.target.value)} style={inputStyle} placeholder="(21) 9XXXX-XXXX" />
        </Campo>
        <Campo label="Data de nascimento">
          <input type="date" value={dataNascimento} onChange={e => setDataNascimento(e.target.value)} style={inputStyle} />
        </Campo>
        <Campo label="Plano">
          <select value={planoId} onChange={e => setPlanoId(e.target.value)} style={inputStyle}>
            <option value="">Sem plano</option>
            {planos.map(p => <option key={p.id} value={p.id}>{p.nome} — R$ {p.valor.toFixed(2)}</option>)}
          </select>
        </Campo>
        <Campo label="Status">
          <select value={status} onChange={e => setStatus(e.target.value)} style={inputStyle}>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Campo>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={onClose} style={{ ...btnStyle, background: 'transparent', border: '1px solid var(--border2)', color: 'var(--text)' }}>
            Cancelar
          </button>
          <button onClick={salvar} disabled={saving || !nome.trim()} style={{ ...btnStyle, background: 'var(--accent2)', color: '#fff', opacity: saving || !nome.trim() ? 0.6 : 1 }}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, letterSpacing: '0.5px', marginBottom: 6, display: 'block' }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6,
  padding: '10px 12px', color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const btnStyle: React.CSSProperties = {
  flex: 1, border: 'none', borderRadius: 6, padding: '11px', fontSize: 13, fontWeight: 700,
  cursor: 'pointer', fontFamily: 'inherit',
}

export default function AlunosPage() {
  return <Suspense><AlunosContent /></Suspense>
}
