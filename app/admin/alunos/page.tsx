'use client'
import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseAdmin'
import { Aluno, Plano } from '@/lib/supabase'
import { periodoAtualHoje, statusPeriodoHoje } from '@/lib/periodos'

// Mesmo grupo de status que o card "Leads / em negociação" do Início conta.
// Mantido igual em app/admin/page.tsx -- se mudar um, muda o outro.
const STATUS_LEADS = ['lead', 'experimental', 'experimental_oferecida', 'experimental_agendada', 'experimental_realizada', 'em_negociacao']

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
    setAlunos((data || []).filter(a => {
      if (statusFiltro === 'todos') return true
      if (statusFiltro === 'leads') return STATUS_LEADS.includes(efetivos[a.id])
      return efetivos[a.id] === statusFiltro
    }))
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
      <Cabecalho
        titulo="Matrículas"
        subtitulo="Cadastro e dados de cada aluno. Clique no aluno pra ver o perfil, gerar contrato e termo."
        acoes={
          <button onClick={() => setNovoOpen(true)} className="btn btn-primary">
            + Novo aluno
          </button>
        }
      />

      <div className="barra-filtros">
        <input
          className="busca"
          placeholder="Buscar por nome, CPF ou telefone..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
        <select value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)}>
          <option value="todos">Todos os status</option>
          <option value="leads">Leads / em negociação</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={ordenacao} onChange={e => setOrdenacao(e.target.value)}>
          <option value="nome_az">Nome (A-Z)</option>
          <option value="nome_za">Nome (Z-A)</option>
          <option value="recentes">Mais recentes</option>
          <option value="antigos">Mais antigos</option>
          <option value="vencimento">Vencimento mais próximo</option>
        </select>
      </div>

      {loading ? (
        <p className="vazio">Carregando...</p>
      ) : filtrados.length === 0 ? (
        <p className="vazio">Nenhum aluno encontrado.</p>
      ) : (
        <div className="lista">
          {filtrados.map(a => (
            <Link key={a.id} href={`/admin/alunos/${a.id}`} className="card card-hover item-lista">
              <div>
                <div className="item-titulo">{a.nome}</div>
                <div className="item-sub">
                  {a.telefone || 'sem telefone'} {a.planos ? `· ${a.planos.nome}` : ''}
                  {statusEfetivo[a.id] === 'ativo' && a.dia_vencimento && (
                    <span style={{ color: 'var(--text3)' }}> · vence dia {a.dia_vencimento}</span>
                  )}
                </div>
              </div>
              <div className="item-acoes">
                {comAvulsa.has(a.id) && (
                  <span className="etiqueta" style={{ color: '#f0a500' }}>
                    🎫 Avulsa
                  </span>
                )}
                <span className="etiqueta" style={{ color: STATUS_COLOR[statusEfetivo[a.id] || a.status_plano] }}>
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
import { Cabecalho } from '@/components/ui/Cabecalho'

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
          <input className="campo" value={nome} onChange={e => setNome(e.target.value)} autoFocus />
        </Campo>
        <Campo label="CPF">
          <input className="campo" value={cpf} onChange={e => setCpf(e.target.value)} placeholder="opcional" />
        </Campo>
        <Campo label="Telefone">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6,
              padding: '10px 12px', color: 'var(--text2)', fontSize: 14, fontWeight: 700, flexShrink: 0,
            }}>
              +55
            </span>
            <input className="campo"
              value={telefone}
              onChange={e => setTelefone(e.target.value)}
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
                <button onClick={() => setForcarCriacao(true)} className="btn btn-ghost btn-sm" style={{ textDecoration: 'underline' }}>
                  Não, é pessoa diferente — criar mesmo assim
                </button>
              </div>
            </div>
          )}
        </Campo>
        <Campo label="Data de nascimento">
          <input className="campo" type="date" value={dataNascimento} onChange={e => setDataNascimento(e.target.value)} />
        </Campo>
        <Campo label="Plano">
          <select className="campo" value={planoId} onChange={e => setPlanoId(e.target.value)}>
            <option value="">Sem plano</option>
            {planos.map(p => <option key={p.id} value={p.id}>{p.nome} — R$ {p.valor.toFixed(2)}</option>)}
          </select>
        </Campo>
        <Campo label="Status">
          <select className="campo" value={status} onChange={e => setStatus(e.target.value)}>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Campo>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={onClose} className="btn btn-neutral" style={{ flex: 1 }}>
            Cancelar
          </button>
          <button onClick={salvar} disabled={saving || !nome.trim() || (!!possivelDuplicata && !forcarCriacao)} className="btn btn-primary" style={{ flex: 1 }}>
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
      <label className="rotulo">{label}</label>
      {children}
    </div>
  )
}


export default function AlunosPage() {
  return <Suspense><AlunosContent /></Suspense>
}
