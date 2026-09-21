'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseAdmin'
import { Professor, Horario } from '@/lib/supabase'

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export default function ProfessoresPage() {
  const [professores, setProfessores] = useState<Professor[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  const [mostrarForm, setMostrarForm] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novoValor, setNovoValor] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erroForm, setErroForm] = useState('')

  const [editandoValor, setEditandoValor] = useState<string | null>(null)
  const [valorTemp, setValorTemp] = useState('')

  const [expandidoId, setExpandidoId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('professores').select('*').order('created_at')
    setProfessores((data as Professor[]) || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function toggleAtivo(p: Professor) {
    setUpdating(p.id)
    await supabase.from('professores').update({ ativo: !p.ativo }).eq('id', p.id)
    setProfessores(prev => prev.map(x => x.id === p.id ? { ...x, ativo: !x.ativo } : x))
    setUpdating(null)
  }

  function abrirEdicaoValor(p: Professor) {
    setEditandoValor(p.id)
    setValorTemp(String(p.valor_por_aula))
  }

  async function salvarValor(p: Professor) {
    const novo = Number(valorTemp)
    if (isNaN(novo) || novo < 0) return
    await supabase.from('professores').update({ valor_por_aula: novo }).eq('id', p.id)
    setProfessores(prev => prev.map(x => x.id === p.id ? { ...x, valor_por_aula: novo } : x))
    setEditandoValor(null)
  }

  async function apagar(p: Professor) {
    const { count } = await supabase
      .from('horarios')
      .select('*', { count: 'exact', head: true })
      .eq('professor_id', p.id)

    const aviso = count && count > 0
      ? `Apagar "${p.nome}"? ${count} horário(s) da grade estão com esse professor e ficarão sem professor atribuído. Isso não pode ser desfeito.`
      : `Apagar "${p.nome}"? Isso não pode ser desfeito.`

    if (!confirm(aviso)) return
    setUpdating(p.id)
    await supabase.from('professores').delete().eq('id', p.id)
    setProfessores(prev => prev.filter(x => x.id !== p.id))
    setUpdating(null)
  }

  async function adicionarProfessor() {
    setErroForm('')
    if (!novoNome.trim()) { setErroForm('Digite o nome do professor.'); return }
    const valor = Number(novoValor) || 0

    setSalvando(true)
    const { data: inserido } = await supabase.from('professores').insert({
      nome: novoNome.trim(),
      valor_por_aula: valor,
      ativo: true,
    }).select('*').single()

    if (inserido) setProfessores(prev => [...prev, inserido as Professor])
    setSalvando(false)
    setMostrarForm(false)
    setNovoNome('')
    setNovoValor('')
  }

  if (loading) return <p style={{ color: 'var(--text2)' }}>Carregando...</p>

  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Professores</h1>
      <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>
        Cadastre os professores e o valor pago por aula de cada um. Depois, atribua cada professor aos horários da grade em Agenda → Grade de horários. O valor por aula é usado no cálculo de horas trabalhadas, na aba Horas trabalhadas do Financeiro.
      </p>

      <RegrasPagamentoCancelamento />

      {professores.length === 0 ? (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, padding: '1.5rem', color: 'var(--text2)', fontSize: 13, marginBottom: 16 }}>
          Nenhum professor cadastrado ainda.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginBottom: 16 }}>
          {professores.map(p => (
            <div key={p.id} className="card card-hover" style={{
              borderColor: p.ativo ? 'var(--border)' : 'var(--danger)',
              padding: '12px 16px', opacity: p.ativo ? 1 : 0.55,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, textDecoration: p.ativo ? 'none' : 'line-through' }}>
                    {p.nome}
                  </span>
                  {!p.ativo && <span style={{ fontSize: 11, color: 'var(--danger)' }}>(inativo)</span>}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {editandoValor === p.id ? (
                    <>
                      <span style={{ fontSize: 12, color: 'var(--text2)' }}>R$</span>
                      <input
                        type="number" min={0} step="0.01" value={valorTemp}
                        onChange={e => setValorTemp(e.target.value)}
                        style={{ width: 80, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 6px', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit' }}
                      />
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>/aula</span>
                      <button onClick={() => salvarValor(p)} className="btn btn-success btn-sm">OK</button>
                    </>
                  ) : (
                    <span
                      onClick={() => abrirEdicaoValor(p)}
                      title="Clique pra editar"
                      style={{
                        fontSize: 12, fontWeight: 700, color: 'var(--text2)', background: 'var(--bg)',
                        border: '1px solid var(--border)', borderRadius: 4, padding: '4px 10px', cursor: 'pointer',
                      }}
                    >
                      R$ {Number(p.valor_por_aula).toFixed(2)}/aula ✏️
                    </span>
                  )}

                  <button
                    onClick={() => setExpandidoId(expandidoId === p.id ? null : p.id)}
                    style={{
                      background: expandidoId === p.id ? '#3fb95022' : 'transparent',
                      border: `1px solid ${expandidoId === p.id ? '#3fb950' : 'var(--border)'}`,
                      color: expandidoId === p.id ? '#3fb950' : 'var(--text2)', borderRadius: 4, padding: '6px 12px',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    📅 {expandidoId === p.id ? 'Fechar agenda' : 'Ver agenda'}
                  </button>

                  <button
                    onClick={() => toggleAtivo(p)}
                    disabled={updating === p.id}
                    style={{
                      background: 'transparent', border: `1px solid ${p.ativo ? 'var(--border)' : 'var(--danger)'}`,
                      color: p.ativo ? 'var(--text2)' : 'var(--danger)', borderRadius: 4, padding: '6px 12px',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: updating === p.id ? 0.6 : 1,
                    }}
                  >
                    {p.ativo ? 'Desativar' : 'Ativar'}
                  </button>

                  <button
                    onClick={() => apagar(p)}
                    disabled={updating === p.id}
                    className="btn btn-outline-danger btn-sm"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {expandidoId === p.id && <AgendaDoProfessor professorId={p.id} />}
            </div>
          ))}
        </div>
      )}

      {!mostrarForm ? (
        <button onClick={() => setMostrarForm(true)} style={{
          background: 'transparent', border: '1px solid #3fb950', color: '#3fb950',
          borderRadius: 6, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          + Cadastrar professor
        </button>
      ) : (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
          <h4 style={{ fontSize: 14, marginBottom: 12 }}>Cadastrar professor</h4>

          <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, marginBottom: 6, display: 'block' }}>Nome</label>
              <input
                value={novoNome} onChange={e => setNovoNome(e.target.value)}
                style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, marginBottom: 6, display: 'block' }}>Valor por aula (R$)</label>
              <input
                type="number" min={0} step="0.01" placeholder="0,00" value={novoValor} onChange={e => setNovoValor(e.target.value)}
                style={{ width: 100, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit' }}
              />
            </div>
          </div>

          {erroForm && <p style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 10 }}>{erroForm}</p>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={adicionarProfessor} disabled={salvando} className="btn btn-success">
              {salvando ? 'Salvando...' : '✅ Cadastrar'}
            </button>
            <button onClick={() => { setMostrarForm(false); setErroForm(''); setNovoNome(''); setNovoValor('') }} disabled={salvando} className="btn btn-neutral">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function AgendaDoProfessor({ professorId }: { professorId: string }) {
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [tiposAgendaOpt, setTiposAgendaOpt] = useState<{ id: string; nome: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const [{ data: hData }, { data: tData }] = await Promise.all([
      supabase.from('horarios')
        .select('*, tipos_agenda(id, nome, permite_plano_mensal, permite_avulsa)')
        .eq('professor_id', professorId)
        .order('dia_semana').order('horario'),
      supabase.from('tipos_agenda').select('id, nome').eq('ativo', true).order('created_at'),
    ])
    setHorarios(hData || [])
    setTiposAgendaOpt(tData || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [professorId])

  async function toggle(h: Horario) {
    setUpdating(h.id)
    await supabase.from('horarios').update({ ativo: !h.ativo }).eq('id', h.id)
    setHorarios(prev => prev.map(x => x.id === h.id ? { ...x, ativo: !x.ativo } : x))
    setUpdating(null)
  }

  async function mudarTipoAgenda(h: Horario, tipoAgendaId: string) {
    setUpdating(h.id)
    await supabase.from('horarios').update({ tipo_agenda_id: tipoAgendaId || null }).eq('id', h.id)
    await load()
  }

  if (loading) return <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 12 }}>Carregando agenda...</p>

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
      <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>
        Dias e horários que esse professor está disposto a dar aula. Pra criar um horário novo pra ele, use Agenda → Grade de horários.
      </p>
      {horarios.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--text3)' }}>Esse professor ainda não está em nenhum horário da grade.</p>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {horarios.map(h => (
            <div key={h.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px',
              opacity: h.ativo ? 1 : 0.5,
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, minWidth: 90 }}>
                {DIAS[h.dia_semana]} · {h.horario.slice(0, 5)}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text2)' }}>{h.capacidade} vaga{h.capacidade === 1 ? '' : 's'}</span>
              <select
                value={h.tipo_agenda_id || ''}
                onChange={e => mudarTipoAgenda(h, e.target.value)}
                disabled={updating === h.id}
                style={{
                  background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4,
                  padding: '4px 6px', color: 'var(--text)', fontSize: 11, fontFamily: 'inherit',
                }}
              >
                <option value="">— sem tipo —</option>
                {tiposAgendaOpt.map(t => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </select>
              <button
                onClick={() => toggle(h)}
                disabled={updating === h.id}
                style={{
                  background: 'transparent', border: `1px solid ${h.ativo ? 'var(--border2)' : 'var(--danger)'}`,
                  color: h.ativo ? 'var(--text2)' : 'var(--danger)', borderRadius: 4, padding: '3px 8px',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginLeft: 'auto',
                }}
              >
                {h.ativo ? 'Desativar' : 'Ativar'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

type ConfigPagamento = {
  pagar_quando_aluno_cancela: boolean
  pagar_quando_estudio_cancela: boolean
}

function RegrasPagamentoCancelamento() {
  const [config, setConfig] = useState<ConfigPagamento | null>(null)
  const [salvando, setSalvando] = useState<string | null>(null)

  async function load() {
    const { data } = await supabase.from('config_pagamento_professores').select('*').eq('id', true).single()
    setConfig(data as ConfigPagamento)
  }

  useEffect(() => { load() }, [])

  async function atualizar(campo: keyof ConfigPagamento, valor: boolean) {
    if (!config) return
    setSalvando(campo)
    setConfig({ ...config, [campo]: valor })
    await supabase.from('config_pagamento_professores').update({ [campo]: valor }).eq('id', true)
    setSalvando(null)
  }

  if (!config) return null

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, padding: '1.25rem', marginBottom: 20 }}>
      <h3 style={{ fontSize: 13, color: 'var(--text2)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 6 }}>
        Regras de pagamento em cancelamento
      </h3>
      <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>
        Quando uma aula é cancelada, o professor recebe por ela mesmo assim? Depende de quem cancelou. Isso é usado no cálculo de Horas trabalhadas e no Controle de caixa.
      </p>

      <div style={{ display: 'grid', gap: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer' }}>
          <span style={{ fontSize: 13 }}>Aluno cancelou a aula</span>
          <ToggleSwitch
            checked={config.pagar_quando_aluno_cancela}
            disabled={salvando === 'pagar_quando_aluno_cancela'}
            onChange={v => atualizar('pagar_quando_aluno_cancela', v)}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer' }}>
          <span style={{ fontSize: 13 }}>Estúdio cancelou a aula (você cancelou)</span>
          <ToggleSwitch
            checked={config.pagar_quando_estudio_cancela}
            disabled={salvando === 'pagar_quando_estudio_cancela'}
            onChange={v => atualizar('pagar_quando_estudio_cancela', v)}
          />
        </label>
      </div>

      <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 12 }}>
        Cancelamentos feitos pela Elen no WhatsApp (fora do painel) contam como &quot;aluno cancelou&quot;. Independente dessas regras, você sempre pode marcar &quot;Professor faltou&quot; numa aula específica em Horas trabalhadas pra excluir só ela do pagamento.
      </p>
    </div>
  )
}

function ToggleSwitch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      disabled={disabled}
      style={{
        width: 42, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
        background: checked ? '#3fb950' : 'var(--border2)', position: 'relative', flexShrink: 0,
        opacity: disabled ? 0.6 : 1, transition: 'background 0.15s',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: checked ? 21 : 3, width: 18, height: 18, borderRadius: '50%',
        background: '#fff', transition: 'left 0.15s',
      }} />
    </button>
  )
}
