'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase, Aluno, Plano } from '@/lib/supabase'
import { waLink } from '@/lib/whatsapp'

const STATUS_OPTIONS = [
  { value: 'lead', label: 'Lead (novo)' },
  { value: 'experimental_oferecida', label: 'Experimental oferecida' },
  { value: 'experimental_agendada', label: 'Experimental agendada' },
  { value: 'experimental_realizada', label: 'Experimental realizada' },
  { value: 'faltou_experimental', label: 'Faltou experimental' },
  { value: 'em_negociacao', label: 'Em negociação' },
  { value: 'perdido', label: 'Perdido' },
  { value: 'ativo', label: 'Ativo' },
  { value: 'vencido', label: 'Vencido' },
  { value: 'cancelado', label: 'Cancelado' },
]

export default function AlunoPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [aluno, setAluno] = useState<Aluno | null>(null)
  const [planos, setPlanos] = useState<Plano[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [msgTexto, setMsgTexto] = useState('')

  useEffect(() => {
    async function load() {
      const [{ data: alunoData }, { data: planosData }] = await Promise.all([
        supabase.from('alunos').select('*').eq('id', id).single(),
        supabase.from('planos').select('*').order('valor'),
      ])
      setAluno(alunoData)
      setPlanos(planosData || [])
      setLoading(false)
    }
    load()
  }, [id])

  function update<K extends keyof Aluno>(field: K, value: Aluno[K]) {
    setAluno(prev => prev ? { ...prev, [field]: value } : prev)
  }

  async function salvar() {
    if (!aluno) return
    setSaving(true)
    const { error } = await supabase.from('alunos').update({
      nome: aluno.nome,
      cpf: aluno.cpf,
      telefone: aluno.telefone,
      data_nascimento: aluno.data_nascimento,
      plano_id: aluno.plano_id || null,
      status_plano: aluno.status_plano,
      observacoes: aluno.observacoes,
      dia_vencimento: aluno.dia_vencimento || null,
    }).eq('id', id)
    setSaving(false)
    if (!error) {
      setToast('Alterações salvas')
      setTimeout(() => setToast(''), 2500)
    }
  }

  async function excluir() {
    if (!confirm('Excluir este aluno? Essa ação não pode ser desfeita.')) return
    await supabase.from('alunos').delete().eq('id', id)
    router.push('/admin/alunos')
  }

  if (loading) return <p style={{ color: 'var(--text2)' }}>Carregando...</p>
  if (!aluno) return <p style={{ color: 'var(--text2)' }}>Aluno não encontrado.</p>

  return (
    <div style={{ maxWidth: 560 }}>
      <Link href="/admin/alunos" style={{ fontSize: 12, color: 'var(--text2)', textDecoration: 'none' }}>← Alunos</Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '8px 0 20px' }}>
        {aluno.foto_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={aluno.foto_url} alt={aluno.nome} style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }} />
        ) : (
          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: 'var(--card)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: 'var(--text2)',
          }}>
            {aluno.nome.charAt(0).toUpperCase()}
          </div>
        )}
        <h1 style={{ fontSize: 28, margin: 0 }}>{aluno.nome}</h1>
      </div>

      <Secao titulo="Dados pessoais">
        <Campo label="Nome">
          <input value={aluno.nome} onChange={e => update('nome', e.target.value)} style={inputStyle} />
        </Campo>
        <Campo label="CPF">
          <input value={aluno.cpf || ''} onChange={e => update('cpf', e.target.value)} style={inputStyle} />
        </Campo>
        <Campo label="Telefone">
          <input value={aluno.telefone || ''} onChange={e => update('telefone', e.target.value)} style={inputStyle} placeholder="(21) 9XXXX-XXXX" />
        </Campo>
        <Campo label="Data de nascimento">
          <input type="date" value={aluno.data_nascimento || ''} onChange={e => update('data_nascimento', e.target.value)} style={inputStyle} />
        </Campo>
      </Secao>

      <Secao titulo="Plano e status">
        <Campo label="Plano">
          <select value={aluno.plano_id || ''} onChange={e => update('plano_id', e.target.value)} style={inputStyle}>
            <option value="">Sem plano</option>
            {planos.map(p => <option key={p.id} value={p.id}>{p.nome} — R$ {p.valor.toFixed(2)}</option>)}
          </select>
        </Campo>
        <Campo label="Status">
          <select value={aluno.status_plano} onChange={e => update('status_plano', e.target.value as Aluno['status_plano'])} style={inputStyle}>
            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Campo>
        <Campo label="Dia do vencimento (1-31)">
          <input
            type="number" min={1} max={31}
            value={aluno.dia_vencimento ?? ''}
            onChange={e => update('dia_vencimento', e.target.value ? Number(e.target.value) : null)}
            style={inputStyle}
            placeholder="Ex: 5 (cobrança automática todo dia 5)"
          />
        </Campo>
        <Campo label="Observações">
          <textarea value={aluno.observacoes || ''} onChange={e => update('observacoes', e.target.value)} style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} />
        </Campo>
      </Secao>

      {aluno.telefone && (
        <Secao titulo="Mensagem via Eleniria (WhatsApp)">
          <Campo label="Mensagem">
            <textarea
              value={msgTexto}
              onChange={e => setMsgTexto(e.target.value)}
              placeholder={`Olá ${aluno.nome.split(' ')[0]}, ...`}
              style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
            />
          </Campo>
          <a
            href={waLink(msgTexto || `Olá ${aluno.nome.split(' ')[0]}!`).replace(/5521979582450/, (aluno.telefone || '').replace(/\D/g, ''))}
            target="_blank" rel="noopener noreferrer"
            style={{ ...btnStyle, display: 'inline-block', textAlign: 'center', textDecoration: 'none', background: 'var(--whatsapp)', color: '#fff' }}
          >
            Enviar no WhatsApp
          </a>
        </Secao>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button onClick={salvar} disabled={saving} style={{ ...btnStyle, background: 'var(--accent2)', color: '#fff', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>
        <button onClick={excluir} style={{ ...btnStyle, background: 'transparent', border: '1px solid var(--border2)', color: 'var(--text2)' }}>
          Excluir aluno
        </button>
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--card)', border: '1px solid #3fb950', borderRadius: 6,
          padding: '10px 20px', fontSize: 13, color: '#3fb950',
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, padding: '1.25rem', marginBottom: 14 }}>
      <h3 style={{ fontSize: 13, color: 'var(--text2)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 14 }}>{titulo}</h3>
      {children}
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
  border: 'none', borderRadius: 6, padding: '11px 18px', fontSize: 13, fontWeight: 700,
  cursor: 'pointer', fontFamily: 'inherit',
}
