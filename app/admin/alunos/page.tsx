'use client'
import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseAdmin'
import { Aluno, Plano } from '@/lib/supabase'
import { periodoAtualHoje, statusPeriodoHoje } from '@/lib/periodos'

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
  pausado: 'Pausado',
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
  pausado: '#f0a500',
  vencido: 'var(--danger)',
  cancelado: 'var(--text3)',
}

function AlunosContent() {
  const params = useSearchParams()
  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [planos, setPlanos] = useState<Plano[]>([])
  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState(params.get('status') || 'todos')
  const [ordenacao, setOrdenacao] = useState('nome_az')
  const [loading, setLoading] = useState(true)
  const [novoOpen, setNovoOpen] = useState(false)
  const [comAvulsa, setComAvulsa] = useState<Set<string>>(new Set())
  const [statusEfetivo, setStatusEfetivo] = useState<Record<string, string>>({})

  async function load() {
    setLoading(true)
    const { data: planosData } = await supabase.from('planos').select('*').order('valor')
    setPlanos(planosData || [])

    const { data: avulsasData } = await supabase.from('creditos_avulsos').select('aluno_id').in('status', ['disponivel', 'agendado'])
    setComAvulsa(new Set((avulsasData || []).map(a => a.aluno_id)))

    let query = supabase.from('alunos').select('*, planos(*)').order('nome')
    const { data } = await query
    const ids = (data || []).map(a => a.id)
    const { data: periodosData } = ids.length > 0
      ? await supabase.from('planos_periodos').select('aluno_id, data_inicio, data_fim, status').in('aluno_id', ids)
      : { data: [] }
    const periodosPorAluno = new Map<string, { data_inicio: string; data_fim: string; status: string }[]>()
    for (const periodo of periodosData || []) {
      const lista = periodosPorAluno.get(periodo.aluno_id) || []
      lista.push(periodo)
      periodosPorAluno.set(periodo.aluno_id, lista)
    }
    const efetivos: Record<string, string> = {}
    for (const aluno of data || []) {
      const periodos = periodosPorAluno.get(aluno.id) || []
      const atual = periodoAtualHoje(periodos)
      const vencido = periodos.some(p => statusPeriodoHoje(p) === 'vencido')
      // Só reclassifica como "vencido" quem está com matrícula ativa vencendo.
      // Um aluno pausado ou já cancelado não deve voltar a aparecer como
      // vencido só porque tem um período antigo com data_fim no passado.
      efetivos[aluno.id] = atual ? 'ativo' : (vencido && aluno.status_plano === 'ativo') ? 'vencido' : aluno.status_plano
    }
    setStatusEfetivo(efetivos)
    setAlunos((data || []).filter(a => statusFiltro === 'todos' || efetivos[a.id] === statusFiltro))
    setLoading(false)
  }

  useEffect(() => { load() }, [statusFiltro])

  const filtrados = alunos.filter(a =>
    a.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (a.cpf || '').includes(busca) ||
    (a.telefone || '').includes(busca)
  ).sort((a, b) => {
    if (ordenacao === 'nome_az') return a.nome.localeCompare(b.nome)
    if (ordenacao === 'nome_za') return b.nome.localeCompare(a.nome)
    if (ordenacao === 'recentes') return (b.data_matricula || '').localeCompare(a.data_matricula || '')
    if (ordenacao === 'antigos') return (a.data_matricula || '').localeCompare(b.data_matricula || '')
    if (ordenacao === 'vencimento') return (a.dia_vencimento || 99) - (b.dia_vencimento || 99)
    return 0
  })

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
        <select value={ordenacao} onChange={e => setOrdenacao(e.target.value)} style={{
          background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6,
          padding: '10px 12px', color: 'var(--text)', fontSize: 14, outline: 'none',
        }}>
          <option value="nome_az">Nome (A-Z)</option>
          <option value="nome_za">Nome (Z-A)</option>
          <option value="recentes">Mais recentes</option>
          <option value="antigos">Mais antigos</option>
          <option value="vencimento">Vencimento mais próximo</option>
        </select>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text2)' }}>Carregando...</p>
      ) : filtrados.length === 0 ? (
        <p style={{ color: 'var(--text2)' }}>Nenhum aluno encontrado.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
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
                  {statusEfetivo[a.id] === 'ativo' && a.dia_vencimento && (
                    <span style={{ color: 'var(--text3)' }}> · vence dia {a.dia_vencimento}</span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {comAvulsa.has(a.id) && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 4,
                    color: '#f0a500', border: '1px solid #f0a500',
                    textTransform: 'uppercase', letterSpacing: '0.5px',
                  }}>
                    🎫 Avulsa
                  </span>
                )}
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 4,
                    color: STATUS_COLOR[statusEfetivo[a.id] || a.status_plano], border: `1px solid ${STATUS_COLOR[statusEfetivo[a.id] || a.status_plano]}`,
                  textTransform: 'uppercase', letterSpacing: '0.5px',
                }}>
                  {STATUS_LABEL[statusEfetivo[a.id] || a.status_plano]}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {novoOpen && <NovoAlunoModal planos={planos} onClose={() => setNovoOpen(false)} onSaved={() => { setNovoOpen(false); load() }} />}
    </div>
  )
}

import { normalizarTelefone } from '@/lib/phone'

function NovoAlunoModal({ planos, onClose, onSaved }: { planos: Plano[]; onClose: () => void; onSaved: () => void }) {
  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [telefone, setTelefone] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [planoId, setPlanoId] = useState('')
  const [status, setStatus] = useState('ativo')
  const [saving, setSaving] = useState(false)

  const [possivelDuplicata, setPossivelDuplicata] = useState<{ id: string; nome: string; telefone: string } | null>(null)
  const [checando, setChecando] = useState(false)
  const [forcarCriacao, setForcarCriacao] = useState(false)

  useEffect(() => {
    const telNormalizado = normalizarTelefone(telefone)
    setForcarCriacao(false)
    if (telNormalizado.length < 12) {
      setPossivelDuplicata(null)
      return
    }
    setChecando(true)
    const timeout = setTimeout(async () => {
      const { data } = await supabase.from('alunos').select('id, nome, telefone').eq('telefone', telNormalizado).limit(1)
      setPossivelDuplicata(data && data.length > 0 ? data[0] : null)
      setChecando(false)
    }, 500)
    return () => clearTimeout(timeout)
  }, [telefone])

  async function salvar() {
    if (!nome.trim()) return
    if (possivelDuplicata && !forcarCriacao) return
    setSaving(true)
    await fetch('/api/admin-alunos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: nome.trim(),
        cpf: cpf.trim() || null,
        telefone: normalizarTelefone(telefone) || null,
        dataNascimento,
        planoId: planoId || null,
        status,
      }),
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6,
              padding: '10px 12px', color: 'var(--text2)', fontSize: 14, fontWeight: 700, flexShrink: 0,
            }}>
              +55
            </span>
            <input
              value={telefone}
              onChange={e => setTelefone(e.target.value)}
              style={inputStyle}
              placeholder="21 98765-4321"
              inputMode="numeric"
            />
          </div>
          {checando && <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>Checando se já existe cadastro com esse número...</p>}
          {possivelDuplicata && (
            <div style={{ background: 'var(--danger)22', border: '1px solid var(--danger)', borderRadius: 6, padding: '10px 12px', marginTop: 8 }}>
              <p style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 700, marginBottom: 6 }}>
                ⚠️ Já existe um aluno com esse telefone: {possivelDuplicata.nome}
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <a href={`/admin/alunos/${possivelDuplicata.id}`} style={{
                  fontSize: 12, color: 'var(--accent)', fontWeight: 700, textDecoration: 'underline',
                }}>
                  Ver cadastro existente
                </a>
                <button onClick={() => setForcarCriacao(true)} style={{
                  fontSize: 12, background: 'transparent', border: 'none', color: 'var(--text2)',
                  textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  Não, é pessoa diferente — criar mesmo assim
                </button>
              </div>
            </div>
          )}
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
          <button onClick={salvar} disabled={saving || !nome.trim() || (!!possivelDuplicata && !forcarCriacao)} style={{ ...btnStyle, background: 'var(--accent2)', color: '#fff', opacity: (saving || !nome.trim() || (!!possivelDuplicata && !forcarCriacao)) ? 0.6 : 1 }}>
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
