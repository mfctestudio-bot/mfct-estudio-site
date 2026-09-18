'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseAdmin'
import { Aluno, Plano } from '@/lib/supabase'
import { waLink } from '@/lib/whatsapp'
import { normalizarTelefone } from '@/lib/phone'
import { periodoAtualHoje, periodoFuturoHoje } from '@/lib/periodos'

const STATUS_OPTIONS = [
  { value: 'lead', label: 'Lead (novo)' },
  { value: 'experimental_oferecida', label: 'Experimental oferecida' },
  { value: 'experimental_agendada', label: 'Experimental agendada' },
  { value: 'experimental_realizada', label: 'Experimental realizada' },
  { value: 'faltou_experimental', label: 'Faltou experimental' },
  { value: 'em_negociacao', label: 'Em negociação' },
  { value: 'perdido', label: 'Perdido' },
  { value: 'ativo', label: 'Ativo' },
  { value: 'pausado', label: 'Pausado' },
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
  const [modalPlano, setModalPlano] = useState<Plano | null>(null)
  const [modalValor, setModalValor] = useState('')
  const [modalDesconto, setModalDesconto] = useState('')
  const [modalDescontoTipo, setModalDescontoTipo] = useState<'valor' | 'percentual'>('valor')
  const [modalData, setModalData] = useState(() => new Date().toISOString().slice(0, 10))
  const [periodoAtual, setPeriodoAtual] = useState<{ data_inicio: string; data_fim: string; status: string } | null>(null)
  const [periodoFuturo, setPeriodoFuturo] = useState<{ data_inicio: string; data_fim: string; status: string } | null>(null)
  const [modalSaving, setModalSaving] = useState(false)
  const [modalTrocaInfo, setModalTrocaInfo] = useState<{ planoAtualNome: string; planoAtualValor: number; diferenca: number } | null>(null)

  useEffect(() => {
    async function load() {
      const [{ data: alunoData }, { data: planosData }, { data: periodosData }] = await Promise.all([
        supabase.from('alunos').select('*').eq('id', id).single(),
        supabase.from('planos').select('*').order('valor'),
        supabase.from('planos_periodos').select('data_inicio, data_fim, status').eq('aluno_id', id).order('data_fim', { ascending: false }),
      ])
      setAluno(alunoData)
      setPlanos(planosData || [])
      setPeriodoAtual(periodoAtualHoje(periodosData || []) || (periodosData || []).find(p => p.data_fim < new Date().toISOString().slice(0, 10)) || null)
      setPeriodoFuturo(periodoFuturoHoje(periodosData || []))
      setLoading(false)
    }
    load()
  }, [id])

  function update<K extends keyof Aluno>(field: K, value: Aluno[K]) {
    setAluno(prev => prev ? { ...prev, [field]: value } : prev)
  }

  async function salvar() {
    if (!aluno) return
    const telNormalizado = normalizarTelefone(aluno.telefone || '')

    if (telNormalizado.length >= 12) {
      const { data: duplicata } = await supabase
        .from('alunos').select('id, nome').eq('telefone', telNormalizado).neq('id', id).limit(1)
      if (duplicata && duplicata.length > 0) {
        const seguir = confirm(`Já existe outro aluno com esse telefone: ${duplicata[0].nome}.\n\nTem certeza que quer salvar mesmo assim? (pode ser duplicidade — considere unificar os cadastros em vez disso)`)
        if (!seguir) return
      }
    }

    setSaving(true)
    const resposta = await fetch('/api/admin-alunos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        nome: aluno.nome,
        cpf: aluno.cpf,
        telefone: telNormalizado || null,
        dataNascimento: aluno.data_nascimento,
        observacoes: aluno.observacoes,
      }),
    })
    setSaving(false)
    if (resposta.ok) {
      setToast('Alterações salvas')
      setTimeout(() => setToast(''), 2500)
    }
  }

  async function excluir() {
    if (!confirm('Excluir este aluno? Essa ação não pode ser desfeita.')) return
    await supabase.from('alunos').delete().eq('id', id)
    router.push('/admin/alunos')
  }

  function abrirModalAtivacao(planoId?: string) {
    if (!aluno) return
    const plano = planos.find(p => p.id === (planoId || aluno.plano_id)) || planos[0]
    if (!plano) { setToast('Cadastre um plano antes de ativar.'); setTimeout(() => setToast(''), 2500); return }

    // TROCA DE PLANO: se já tem período vigente com OUTRO plano, sugere a diferença, não o valor cheio
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
      setToast(erro?.error || 'Não foi possível ativar o plano.')
      setTimeout(() => setToast(''), 3500)
      return
    }

    const diaVencimentoNovo = Number(modalData.split('-')[2])
    setAluno(prev => prev ? { ...prev, status_plano: 'ativo', plano_id: modalPlano.id, dia_vencimento: diaVencimentoNovo } : prev)

    // Notificar aluno
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
    setToast('Plano ativado e pagamento registrado! Aluno notificado.')
    setTimeout(() => setToast(''), 3000)
  }

  async function cancelarPlano() {
    if (!aluno || !confirm('Cancelar o plano deste aluno? Isso encerra a relação — se for algo temporário, use "Pausar" em vez disso.')) return
    const resp = await fetch('/api/admin-aluno-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alunoId: id, status: 'cancelado' }) })
    const dados = await resp.json().catch(() => null)
    setAluno(prev => prev ? { ...prev, status_plano: 'cancelado' } : prev)
    const extra = dados?.agendamentos_futuros_liberados ? ` ${dados.agendamentos_futuros_liberados} aula(s) futura(s) liberada(s) da agenda.` : ''
    setToast('Plano cancelado.' + extra)
    setTimeout(() => setToast(''), 3500)
  }

  async function pausarPlano() {
    if (!aluno || !confirm('Pausar o plano deste aluno? Ele fica temporariamente suspenso, sem cancelar de vez. As aulas futuras já marcadas serão liberadas da agenda enquanto ele estiver pausado.')) return
    const resp = await fetch('/api/admin-aluno-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alunoId: id, status: 'pausado' }) })
    const dados = await resp.json().catch(() => null)
    setAluno(prev => prev ? { ...prev, status_plano: 'pausado' } : prev)
    const extra = dados?.agendamentos_futuros_liberados ? ` ${dados.agendamentos_futuros_liberados} aula(s) futura(s) liberada(s) da agenda.` : ''
    setToast('Plano pausado.' + extra + ' Ao reativar, será preciso remarcar os horários fixos.')
    setTimeout(() => setToast(''), 4000)
  }

  async function alterarVencimento(dia: number) {
    if (!aluno) return
    await supabase.from('alunos').update({ dia_vencimento: dia }).eq('id', id)
    setAluno(prev => prev ? { ...prev, dia_vencimento: dia } : prev)
    setToast('Vencimento alterado.')
    setTimeout(() => setToast(''), 2500)
  }

  if (loading) return <p style={{ color: 'var(--text2)' }}>Carregando...</p>
  if (!aluno) return <p style={{ color: 'var(--text2)' }}>Aluno não encontrado.</p>

  return (
    <div>
      <Link href="/admin/alunos" style={{ fontSize: 12, color: 'var(--text2)', textDecoration: 'none' }}>← Alunos</Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '8px 0 20px' }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {aluno.foto_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={aluno.foto_url} alt={aluno.nome} style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }} />
          ) : (
            <div style={{
              width: 80, height: 80, borderRadius: '50%', background: 'var(--card)', border: '2px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, color: 'var(--text2)',
            }}>
              {aluno.nome.charAt(0).toUpperCase()}
            </div>
          )}
          <label style={{
            position: 'absolute', bottom: 0, right: 0, background: 'var(--accent)', border: 'none',
            borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 13,
          }} title="Trocar foto">
            📷
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => {
              const file = e.target.files?.[0]
              if (!file) return
              const ext = file.name.split('.').pop()
              const path = `${aluno.id}-${Date.now()}.${ext}`
              const { error } = await supabase.storage.from('aluno-fotos').upload(path, file, { upsert: true })
              if (!error) {
                const publicUrl = `https://tgpestsfhjrdahtzwodk.supabase.co/storage/v1/object/public/aluno-fotos/${path}`
                await supabase.from('alunos').update({ foto_url: publicUrl }).eq('id', aluno.id)
                update('foto_url', publicUrl)
                setToast('Foto atualizada!')
                setTimeout(() => setToast(''), 2500)
              }
            }} />
          </label>
        </div>
        <div>
          <h1 style={{ fontSize: 24, margin: 0 }}>{aluno.nome}</h1>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>{aluno.telefone}</div>
        </div>
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

      <Secao titulo="Outras informações">
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

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>Plano atual</div>
        <div
          onClick={() => router.push('/admin/mensalidades')}
          style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '16px', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>
                {planos.find(p => p.id === aluno.plano_id)?.nome || 'Sem plano definido'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
                {periodoAtual
                  ? `${periodoAtual.status === 'vencido' ? 'Venceu' : 'Vale'} de ${new Date(periodoAtual.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR')} até ${new Date(periodoAtual.data_fim + 'T00:00:00').toLocaleDateString('pt-BR')}`
                  : 'Nenhum período registrado ainda'}
                {periodoFuturo && ` · Renovado até ${new Date(periodoFuturo.data_fim + 'T00:00:00').toLocaleDateString('pt-BR')}`}
              </div>
            </div>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 4,
              color: aluno.status_plano === 'ativo' ? '#3fb950' : aluno.status_plano === 'pausado' ? '#5b9bd5' : 'var(--accent2)',
              background: aluno.status_plano === 'ativo' ? '#3fb95015' : aluno.status_plano === 'pausado' ? '#5b9bd515' : 'var(--accent2)15',
            }}>
              {STATUS_OPTIONS.find(s => s.value === aluno.status_plano)?.label || aluno.status_plano}
            </span>
          </div>

          <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {aluno.status_plano !== 'ativo' && aluno.status_plano !== 'pausado' && (
              <button onClick={() => abrirModalAtivacao()} style={{ background: '#3fb950', border: 'none', color: '#fff', borderRadius: 6, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                ✅ Ativar plano
              </button>
            )}
            {(aluno.status_plano === 'ativo' || aluno.status_plano === 'pausado') && (
              <button onClick={() => abrirModalAtivacao(aluno.plano_id || undefined)} style={{ background: '#3fb950', border: 'none', color: '#fff', borderRadius: 6, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                🔄 {aluno.status_plano === 'pausado' ? 'Reativar' : 'Renovar plano'}
              </button>
            )}
            {aluno.status_plano === 'ativo' && (
              <button onClick={pausarPlano} style={{ background: 'transparent', border: '1.5px solid #f0a500', color: '#f0a500', borderRadius: 6, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                ⏸️ Pausar
              </button>
            )}
            {aluno.status_plano !== 'cancelado' && (
              <button onClick={cancelarPlano} style={{ background: 'transparent', border: '1.5px solid var(--accent2)', color: 'var(--accent2)', borderRadius: 6, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                ❌ Cancelar
              </button>
            )}
          </div>

          <div onClick={e => e.stopPropagation()} style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
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

          <div style={{ marginTop: 14, fontSize: 12, color: '#5b9bd5' }}>Ver histórico completo de mensalidades →</div>
        </div>
      </div>

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
