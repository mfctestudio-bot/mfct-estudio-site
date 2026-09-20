'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseAdmin'
import { Aluno, Plano } from '@/lib/supabase'
import { statusPeriodoHoje } from '@/lib/periodos'

const STATUS_LABEL: Record<string, { label: string; cor: string; bg: string }> = {
  ativo: { label: 'Em dia', cor: '#3fb950', bg: '#3fb95015' },
  vencido: { label: 'Vencido', cor: 'var(--danger)', bg: 'var(--danger)15' },
  agendado: { label: 'Agendado', cor: '#5b9bd5', bg: '#5b9bd515' },
}

type Periodo = {
  id: string
  aluno_id: string
  pagamento_id: string | null
  data_inicio: string
  data_fim: string
  status: string
}

type Pagamento = {
  id: string
  valor: number
  valor_original: number | null
  desconto: number | null
  status: string
  data_pagamento: string | null
  metodo_pagamento: string | null
  observacao: string | null
}

export default function MensalidadeAlunoPage() {
  const params = useParams()
  const id = params.id as string

  const [aluno, setAluno] = useState<Aluno | null>(null)
  const [planos, setPlanos] = useState<Plano[]>([])
  const [periodos, setPeriodos] = useState<Periodo[]>([])
  const [pagamentos, setPagamentos] = useState<Record<string, Pagamento>>({})
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  const [modalPlano, setModalPlano] = useState<Plano | null>(null)
  const [modalValor, setModalValor] = useState('')
  const [modalDesconto, setModalDesconto] = useState('')
  const [modalDescontoTipo, setModalDescontoTipo] = useState<'valor' | 'percentual'>('valor')
  const [modalData, setModalData] = useState(() => new Date().toISOString().slice(0, 10))
  const [modalSaving, setModalSaving] = useState(false)
  const [modalTrocaInfo, setModalTrocaInfo] = useState<{ planoAtualNome: string; planoAtualValor: number; diferenca: number } | null>(null)

  const [editandoPeriodoId, setEditandoPeriodoId] = useState<string | null>(null)
  const [novaDataInicio, setNovaDataInicio] = useState('')
  const [salvandoData, setSalvandoData] = useState(false)

  async function carregar() {
    const [{ data: alunoData }, { data: planosData }, { data: periodosData }] = await Promise.all([
      supabase.from('alunos').select('*').eq('id', id).single(),
      supabase.from('planos').select('*').order('valor'),
      supabase.from('planos_periodos').select('id, aluno_id, pagamento_id, data_inicio, data_fim, status').eq('aluno_id', id).order('data_fim', { ascending: false }),
    ])
    setAluno(alunoData)
    setPlanos(planosData || [])
    const listaPeriodos = periodosData || []
    setPeriodos(listaPeriodos)

    const pagamentoIds = listaPeriodos.map(p => p.pagamento_id).filter((v): v is string => !!v)
    if (pagamentoIds.length) {
      const { data: pagamentosData } = await supabase
        .from('pagamentos')
        .select('id, valor, valor_original, desconto, status, data_pagamento, metodo_pagamento, observacao')
        .in('id', pagamentoIds)
      const mapa: Record<string, Pagamento> = {}
      for (const p of pagamentosData || []) mapa[p.id] = p
      setPagamentos(mapa)
    }
    setLoading(false)
  }

  useEffect(() => { carregar() }, [id])

  function avisar(msg: string, ms = 3000) {
    setToast(msg)
    setTimeout(() => setToast(''), ms)
  }

  const periodoAtual = periodos.find(p => statusPeriodoHoje(p) === 'ativo') || null
  const periodoFuturo = periodos.find(p => statusPeriodoHoje(p) === 'agendado') || null
  // "vencido" nunca fica gravado em status_plano -- enquanto dentro da carência
  // (verificarVencimentos) o aluno continua com status_plano 'ativo', só que
  // sem período vigente cobrindo hoje. É esse o sinal de que já venceu.
  const estaVencido = aluno?.status_plano === 'ativo' && !periodoAtual

  function abrirModalAtivacao(planoId?: string) {
    if (!aluno) return
    const plano = planos.find(p => p.id === (planoId || aluno.plano_id)) || planos[0]
    if (!plano) { avisar('Cadastre um plano antes de ativar.'); return }

    const ehTrocaRealDePlano = !!planoId && aluno.plano_id && planoId !== aluno.plano_id && !!periodoAtual
    if (ehTrocaRealDePlano) {
      const planoAtualObj = planos.find(p => p.id === aluno.plano_id)
      if (planoAtualObj) {
        const diferenca = Math.max(0, Number(plano.valor) - Number(planoAtualObj.valor))
        setModalPlano(plano)
        setModalValor(String(diferenca))
        setModalDesconto('0')
        setModalData(new Date().toISOString().slice(0, 10))
        setModalTrocaInfo({ planoAtualNome: planoAtualObj.nome, planoAtualValor: Number(planoAtualObj.valor), diferenca })
        return
      }
    }

    setModalTrocaInfo(null)
    setModalPlano(plano)
    setModalValor(String(plano.valor))
    setModalDesconto('0')
    setModalData(new Date().toISOString().slice(0, 10))
  }

  async function confirmarAtivacao() {
    if (!aluno || !modalPlano) return
    setModalSaving(true)
    const valorOriginal = Number(modalPlano.valor)
    const desconto = modalDescontoTipo === 'percentual'
      ? Math.round(valorOriginal * (Number(modalDesconto || 0) / 100) * 100) / 100
      : Number(modalDesconto || 0)
    const valorFinal = Number(modalValor || 0)

    const resposta = await fetch('/api/admin-ativar-plano', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alunoId: id,
        planoId: modalPlano.id,
        valor: valorFinal,
        valorOriginal,
        desconto,
        dataPagamento: modalData,
      }),
    })
    if (!resposta.ok) {
      const erro = await resposta.json().catch(() => null)
      setModalSaving(false)
      avisar(erro?.error || 'Não foi possível ativar o plano.', 3500)
      return
    }

    try {
      await fetch('/api/confirmar-pagamento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alunoId: id })
      })
    } catch {}

    setModalSaving(false)
    setModalPlano(null)
    setModalTrocaInfo(null)
    avisar('Plano ativado e pagamento registrado! Aluno notificado.')
    carregar()
  }

  async function cancelarPlano() {
    if (!aluno || !confirm('Cancelar o plano deste aluno? Isso encerra a relação — se for algo temporário, use "Pausar" em vez disso.')) return
    const resp = await fetch('/api/admin-aluno-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alunoId: id, status: 'cancelado' }) })
    const dados = await resp.json().catch(() => null)
    const extra = dados?.agendamentos_futuros_liberados ? ` ${dados.agendamentos_futuros_liberados} aula(s) futura(s) liberada(s) da agenda.` : ''
    avisar('Plano cancelado.' + extra, 3500)
    carregar()
  }

  async function pausarPlano() {
    if (!aluno || !confirm('Pausar o plano deste aluno? Ele fica temporariamente suspenso, sem cancelar de vez. As aulas futuras já marcadas serão liberadas da agenda enquanto ele estiver pausado.')) return
    const resp = await fetch('/api/admin-aluno-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alunoId: id, status: 'pausado' }) })
    const dados = await resp.json().catch(() => null)
    const extra = dados?.agendamentos_futuros_liberados ? ` ${dados.agendamentos_futuros_liberados} aula(s) futura(s) liberada(s) da agenda.` : ''
    avisar('Plano pausado.' + extra + ' Ao reativar, será preciso remarcar os horários fixos.', 4000)
    carregar()
  }

  async function continuarPlanoHandler() {
    if (!aluno) return
    const resp = await fetch('/api/admin-continuar-plano', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alunoId: id }),
    })
    const dados = await resp.json().catch(() => null)
    if (!resp.ok) {
      avisar(dados?.error || 'Não foi possível continuar o plano.', 4500)
      return
    }
    avisar(`Plano reativado sem cobrança. Novo vencimento: ${new Date(dados.dataFimNova + 'T00:00:00').toLocaleDateString('pt-BR')}.`, 4500)
    carregar()
  }

  async function notificarVencimentoHandler() {
    if (!aluno) return
    const resp = await fetch('/api/admin-notificar-vencimento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alunoId: id }),
    })
    const dados = await resp.json().catch(() => null)
    if (!resp.ok) {
      avisar(dados?.error || 'Não foi possível enviar a cobrança.', 4500)
      return
    }
    avisar(`Cobrança enviada pelo WhatsApp (${dados.diasVencido} dia(s) de atraso).`, 4000)
  }

  async function alterarVencimento(dia: number) {
    if (!aluno) return
    await supabase.from('alunos').update({ dia_vencimento: dia }).eq('id', id)
    setAluno(prev => prev ? { ...prev, dia_vencimento: dia } : prev)
    avisar('Vencimento alterado.', 2500)
  }

  function abrirEdicaoData(periodo: Periodo) {
    setEditandoPeriodoId(periodo.id)
    setNovaDataInicio(periodo.data_inicio)
  }

  async function salvarNovaData(periodoId: string) {
    if (!novaDataInicio) return
    setSalvandoData(true)
    const resposta = await fetch('/api/admin-editar-periodo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ periodoId, novaDataInicio }),
    })
    setSalvandoData(false)
    if (!resposta.ok) {
      const erro = await resposta.json().catch(() => null)
      avisar(erro?.error || 'Não foi possível corrigir a data.', 4000)
      return
    }
    setEditandoPeriodoId(null)
    avisar('Data corrigida. O período foi recalculado (30 dias a partir dessa data).')
    carregar()
  }

  if (loading) return <p style={{ color: 'var(--text2)' }}>Carregando...</p>
  if (!aluno) return <p style={{ color: 'var(--text2)' }}>Aluno não encontrado.</p>

  return (
    <div>
      <Link href={`/admin/alunos/${id}`} style={{ fontSize: 12, color: 'var(--text2)', textDecoration: 'none' }}>← {aluno.nome}</Link>
      <h1 style={{ fontSize: 24, margin: '8px 0 4px' }}>Mensalidade de {aluno.nome}</h1>
      <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>
        Plano, pagamentos e histórico de períodos desse aluno.
      </p>

      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              {planos.find(p => p.id === aluno.plano_id)?.nome || 'Sem plano definido'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
              {periodoAtual
                ? `Vale de ${new Date(periodoAtual.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR')} até ${new Date(periodoAtual.data_fim + 'T00:00:00').toLocaleDateString('pt-BR')}`
                : 'Nenhum período vigente no momento'}
              {periodoFuturo && ` · Renovado até ${new Date(periodoFuturo.data_fim + 'T00:00:00').toLocaleDateString('pt-BR')}`}
            </div>
          </div>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 4,
            color: aluno.status_plano === 'ativo' ? '#3fb950' : aluno.status_plano === 'pausado' ? '#5b9bd5' : 'var(--danger)',
            background: aluno.status_plano === 'ativo' ? '#3fb95015' : aluno.status_plano === 'pausado' ? '#5b9bd515' : 'var(--danger)15',
          }}>
            {aluno.status_plano}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {aluno.status_plano === 'cancelado' && (
            <button onClick={() => abrirModalAtivacao()} style={{ ...btnStyle, background: '#3fb950', color: '#fff' }}>
              🔄 Reativar
            </button>
          )}
          {aluno.status_plano === 'pausado' && (
            <button onClick={continuarPlanoHandler} style={{ ...btnStyle, background: '#3fb950', color: '#fff' }}>
              ▶️ Continuar
            </button>
          )}
          {estaVencido && (
            <button onClick={() => abrirModalAtivacao(aluno.plano_id || undefined)} style={{ ...btnStyle, background: '#3fb950', color: '#fff' }}>
              🔄 Renovar
            </button>
          )}
          {estaVencido && (
            <button onClick={notificarVencimentoHandler} style={{ ...btnStyle, background: 'transparent', border: '1.5px solid var(--whatsapp)', color: 'var(--whatsapp)' }}>
              💬 Notificar vencimento
            </button>
          )}
          {aluno.status_plano === 'ativo' && !estaVencido && (
            <button onClick={pausarPlano} style={{ ...btnStyle, background: 'transparent', border: '1.5px solid #f0a500', color: '#f0a500' }}>
              ⏸️ Pausar
            </button>
          )}
          {aluno.status_plano !== 'cancelado' && (
            <button onClick={cancelarPlano} style={{ ...btnStyle, background: 'transparent', border: '1.5px solid var(--danger)', color: 'var(--danger)' }}>
              ❌ Cancelar
            </button>
          )}
        </div>

        <div style={{ paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <SubLabel>Trocar tipo de plano</SubLabel>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {planos.filter(p => p.vezes_semana > 1).map(p => (
              <button key={p.id} onClick={() => abrirModalAtivacao(p.id)} style={{
                background: aluno.plano_id === p.id ? '#3fb95022' : 'var(--bg)',
                border: `1.5px solid ${aluno.plano_id === p.id ? '#3fb950' : 'var(--border)'}`,
                color: aluno.plano_id === p.id ? '#3fb950' : 'var(--text)',
                borderRadius: 6, padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {p.nome} — R$ {Number(p.valor).toFixed(2).replace('.', ',')}
              </button>
            ))}
          </div>
          <SubLabel>Dia de vencimento</SubLabel>
          <select
            value={aluno.dia_vencimento || ''}
            onChange={e => alterarVencimento(Number(e.target.value))}
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 6, padding: '6px 10px', fontSize: 13, fontFamily: 'inherit' }}
          >
            <option value="">-- selecionar --</option>
            {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
              <option key={d} value={d}>Dia {d}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
          Histórico de mensalidades
        </div>
        {!periodos.length && (
          <p style={{ color: 'var(--text3)', fontSize: 13 }}>Nenhum período registrado ainda.</p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {periodos.map(periodo => {
            const status = statusPeriodoHoje(periodo)
            const info = STATUS_LABEL[status]
            const pagamento = periodo.pagamento_id ? pagamentos[periodo.pagamento_id] : null
            const editando = editandoPeriodoId === periodo.id
            return (
              <div key={periodo.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ fontSize: 13 }}>
                    {new Date(periodo.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR')} até {new Date(periodo.data_fim + 'T00:00:00').toLocaleDateString('pt-BR')}
                    {pagamento && (
                      <span style={{ color: 'var(--text3)' }}>
                        {' · R$ '}{Number(pagamento.valor).toFixed(2).replace('.', ',')}
                        {pagamento.desconto ? ` (desconto de R$ ${Number(pagamento.desconto).toFixed(2).replace('.', ',')})` : ''}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 4, color: info.cor, background: info.bg }}>
                      {info.label}
                    </span>
                    {!editando && (
                      <button onClick={() => abrirEdicaoData(periodo)} style={{
                        background: 'transparent', border: '1px solid var(--border2)', color: 'var(--text2)',
                        borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                      }}>
                        ✏️ Corrigir data
                      </button>
                    )}
                  </div>
                </div>
                {editando && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>Nova data de início:</span>
                    <input
                      type="date"
                      value={novaDataInicio}
                      onChange={e => setNovaDataInicio(e.target.value)}
                      style={{ ...inputStyle, width: 'auto' }}
                    />
                    <button onClick={() => salvarNovaData(periodo.id)} disabled={salvandoData} style={{ ...btnStyle, padding: '8px 14px', background: '#3fb950', color: '#fff', opacity: salvandoData ? 0.6 : 1 }}>
                      {salvandoData ? 'Salvando...' : 'Salvar'}
                    </button>
                    <button onClick={() => setEditandoPeriodoId(null)} disabled={salvandoData} style={{ ...btnStyle, padding: '8px 14px', background: 'transparent', border: '1px solid var(--border2)', color: 'var(--text2)' }}>
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
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

      {modalPlano && (
        <div
          onClick={() => !modalSaving && (setModalPlano(null), setModalTrocaInfo(null))}
          style={{ position: 'fixed', inset: 0, background: '#000c', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}
        >
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8,
            padding: '20px', width: '100%', maxWidth: 380,
          }}>
            <h3 style={{ fontSize: 16, marginBottom: 4 }}>{modalTrocaInfo ? 'Troca de plano' : 'Ativar plano — registrar pagamento'}</h3>
            <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: modalTrocaInfo ? 6 : 16 }}>
              {modalPlano.nome} · valor de tabela R$ {Number(modalPlano.valor).toFixed(2).replace('.', ',')}
            </p>
            {modalTrocaInfo && (
              <p style={{ fontSize: 12, color: '#5b9bd5', marginBottom: 16, background: '#5b9bd515', padding: '8px 10px', borderRadius: 6 }}>
                Trocando de <strong>{modalTrocaInfo.planoAtualNome}</strong> (R$ {modalTrocaInfo.planoAtualValor.toFixed(2).replace('.', ',')}) pra <strong>{modalPlano.nome}</strong>.
                Cobrando só a diferença: <strong>R$ {modalTrocaInfo.diferenca.toFixed(2).replace('.', ',')}</strong> (não o valor cheio do plano novo).
              </p>
            )}

            <Campo label="Valor cobrado (R$)">
              <input type="number" step="0.01" value={modalValor} onChange={e => setModalValor(e.target.value)} style={inputStyle} />
            </Campo>
            <Campo label="Desconto aplicado">
              <div style={{ display: 'flex', gap: 8 }}>
                {modalDescontoTipo === 'percentual' ? (
                  <select
                    value={modalDesconto}
                    onChange={e => {
                      const novoDesconto = e.target.value
                      setModalDesconto(novoDesconto)
                      const valorOriginal = Number(modalPlano.valor)
                      const descontoReais = valorOriginal * (Number(novoDesconto || 0) / 100)
                      setModalValor(String(Math.max(0, Math.round((valorOriginal - descontoReais) * 100) / 100)))
                    }}
                    style={{ ...inputStyle, flex: 1 }}
                  >
                    <option value="0">Sem desconto</option>
                    {[5, 10, 15, 20, 25, 30, 40, 50].map(p => <option key={p} value={p}>{p}%</option>)}
                  </select>
                ) : (
                  <input
                    type="number" step="0.01" value={modalDesconto}
                    onChange={e => {
                      const novoDesconto = e.target.value
                      setModalDesconto(novoDesconto)
                      const valorOriginal = Number(modalPlano.valor)
                      setModalValor(String(Math.max(0, Math.round((valorOriginal - Number(novoDesconto || 0)) * 100) / 100)))
                    }}
                    style={{ ...inputStyle, flex: 1 }} placeholder="0"
                  />
                )}
                <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                  {(['valor', 'percentual'] as const).map(t => (
                    <button key={t} type="button" onClick={() => { setModalDescontoTipo(t); setModalDesconto('0'); setModalValor(String(modalPlano.valor)) }} style={{
                      background: modalDescontoTipo === t ? '#3fb95022' : 'transparent',
                      color: modalDescontoTipo === t ? '#3fb950' : 'var(--text2)',
                      border: 'none', padding: '0 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                      {t === 'valor' ? 'R$' : '%'}
                    </button>
                  ))}
                </div>
              </div>
            </Campo>
            <Campo label="Data do pagamento">
              <input type="date" value={modalData} onChange={e => setModalData(e.target.value)} style={inputStyle} />
            </Campo>

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button onClick={confirmarAtivacao} disabled={modalSaving} style={{ ...btnStyle, flex: 1, background: '#3fb950', color: '#fff', opacity: modalSaving ? 0.6 : 1 }}>
                {modalSaving ? 'Registrando...' : '✅ Confirmar'}
              </button>
              <button onClick={() => { setModalPlano(null); setModalTrocaInfo(null) }} disabled={modalSaving} style={{ ...btnStyle, background: 'transparent', border: '1px solid var(--border2)', color: 'var(--text2)' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8 }}>
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
  border: 'none', borderRadius: 6, padding: '9px 16px', fontSize: 13, fontWeight: 700,
  cursor: 'pointer', fontFamily: 'inherit',
}
