'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseAdmin'

type PeriodoRow = {
  id: string
  aluno_id: string
  data_inicio: string
  data_fim: string
  status: 'agendado' | 'ativo' | 'vencido'
}

type AlunoComPeriodo = {
  id: string
  nome: string
  telefone: string | null
  status_plano: string
  periodoAtual: PeriodoRow | null
  periodoFuturo: PeriodoRow | null
}

const STATUS_INFO: Record<string, { label: string; cor: string; bg: string }> = {
  ativo: { label: 'Em dia', cor: '#3fb950', bg: '#3fb95015' },
  vencido: { label: 'Vencido', cor: 'var(--accent2)', bg: 'var(--accent2)15' },
  agendado: { label: 'Agendado', cor: '#5b9bd5', bg: '#5b9bd515' },
  sem_periodo: { label: 'Sem período registrado', cor: 'var(--text3)', bg: 'var(--bg)' },
}

type PagamentoPendente = {
  id: string
  aluno_id: string
  valor: number
  comprovante_url: string | null
  created_at: string
  alunos: { nome: string; telefone: string } | null
}

const PLANO_3X = '904a1d47-3748-4ddc-980f-cab5979be18e'

export default function MensalidadesPage() {
  const [alunos, setAlunos] = useState<AlunoComPeriodo[]>([])
  const [pendentes, setPendentes] = useState<PagamentoPendente[]>([])
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'todos' | 'vencido' | 'ativo' | 'sem_periodo'>('todos')
  const [busca, setBusca] = useState('')

  async function carregar() {
    setLoading(true)
    const { data: pendentesData } = await supabase
      .from('pagamentos')
      .select('id, aluno_id, valor, comprovante_url, created_at, alunos(nome, telefone)')
      .eq('status', 'aguardando_confirmacao')
      .order('created_at', { ascending: false })
    setPendentes((pendentesData as unknown as PagamentoPendente[]) || [])

    const { data: alunosData } = await supabase
      .from('alunos')
      .select('id, nome, telefone, status_plano')
      .in('status_plano', ['ativo', 'vencido'])
      .order('nome')

    const { data: periodosData } = await supabase
      .from('planos_periodos')
      .select('id, aluno_id, data_inicio, data_fim, status')
      .order('data_fim', { ascending: false })

    const periodosPorAluno = new Map<string, PeriodoRow[]>()
    for (const p of (periodosData as PeriodoRow[] | null) || []) {
      if (!periodosPorAluno.has(p.aluno_id)) periodosPorAluno.set(p.aluno_id, [])
      periodosPorAluno.get(p.aluno_id)!.push(p)
    }

    const resultado: AlunoComPeriodo[] = ((alunosData as { id: string; nome: string; telefone: string | null; status_plano: string }[] | null) || []).map(a => {
      const periodos = periodosPorAluno.get(a.id) || []
      const atual = periodos.find(p => p.status === 'ativo' || p.status === 'vencido') || null
      const futuro = periodos.find(p => p.status === 'agendado') || null
      return { ...a, periodoAtual: atual, periodoFuturo: futuro }
    })

    resultado.sort((a, b) => {
      const ordem = { vencido: 0, ativo: 1, sem_periodo: 2 }
      const statusA = a.periodoAtual?.status || 'sem_periodo'
      const statusB = b.periodoAtual?.status || 'sem_periodo'
      return (ordem[statusA as keyof typeof ordem] ?? 3) - (ordem[statusB as keyof typeof ordem] ?? 3)
    })

    setAlunos(resultado)
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  async function confirmarPagamento(pag: PagamentoPendente) {
    setConfirmando(pag.id)
    const agora = new Date()
    const hojeStr = agora.toISOString().slice(0, 10)

    await supabase.from('pagamentos').update({
      status: 'pago', confirmado_em: agora.toISOString(), confirmado_por: 'admin', data_pagamento: agora.toISOString(),
    }).eq('id', pag.id)

    // Empilha o periodo de 30 dias corretamente, igual a Elen faz
    const { data: ultimoPeriodo } = await supabase
      .from('planos_periodos')
      .select('data_fim')
      .eq('aluno_id', pag.aluno_id)
      .order('data_fim', { ascending: false })
      .limit(1)
      .maybeSingle()

    let dataInicio = hojeStr
    if (ultimoPeriodo) {
      const fimUltimo = new Date(ultimoPeriodo.data_fim + 'T00:00:00')
      if (fimUltimo >= agora) {
        fimUltimo.setDate(fimUltimo.getDate() + 1)
        dataInicio = fimUltimo.toISOString().slice(0, 10)
      }
    }
    const dataFim = new Date(dataInicio + 'T00:00:00')
    dataFim.setDate(dataFim.getDate() + 30)
    const statusPeriodo = dataInicio <= hojeStr ? 'ativo' : 'agendado'

    await supabase.from('planos_periodos').insert({
      aluno_id: pag.aluno_id, pagamento_id: pag.id,
      data_inicio: dataInicio, data_fim: dataFim.toISOString().slice(0, 10), status: statusPeriodo,
    })

    await supabase.from('alunos').update({ status_plano: 'ativo' }).eq('id', pag.aluno_id)

    if (pag.alunos?.telefone) {
      try {
        await fetch('/api/confirmar-pagamento', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: pag.alunos.telefone, nomeAluno: pag.alunos.nome }),
        })
      } catch (e) {}
    }

    setConfirmando(null)
    carregar()
  }

  const filtrados = alunos.filter(a => {
    const statusAtual = a.periodoAtual?.status || 'sem_periodo'
    if (filtro !== 'todos' && statusAtual !== filtro) return false
    if (busca && !a.nome.toLowerCase().includes(busca.toLowerCase())) return false
    return true
  })

  const contagens = {
    vencido: alunos.filter(a => a.periodoAtual?.status === 'vencido').length,
    ativo: alunos.filter(a => a.periodoAtual?.status === 'ativo').length,
    sem_periodo: alunos.filter(a => !a.periodoAtual).length,
  }

  return (
    <div style={{ padding: '20px 16px', maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Planos</h1>
      <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>
        Quem está em dia, quem venceu, e quem já renovou pro próximo período.
      </p>

      {!!pendentes.length && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 800, marginBottom: 8, color: '#f0a500' }}>
            ⏳ Aguardando confirmação ({pendentes.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendentes.map(p => (
              <div key={p.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                padding: '12px 14px', borderRadius: 8, background: 'var(--card)', border: '1px solid #f0a500',
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{p.alunos?.nome || p.alunos?.telefone}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                    R$ {Number(p.valor).toFixed(2)}
                    {p.comprovante_url && (
                      <> · <a href={p.comprovante_url} target="_blank" rel="noreferrer" style={{ color: '#5b9bd5' }}>ver comprovante</a></>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => confirmarPagamento(p)}
                  disabled={confirmando === p.id}
                  style={{
                    padding: '8px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    border: '1px solid #3fb950', background: '#3fb95015', color: '#3fb950',
                  }}
                >
                  {confirmando === p.id ? 'Confirmando...' : '✅ Confirmar pagamento'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {([
          ['todos', `Todos (${alunos.length})`],
          ['vencido', `Vencidos (${contagens.vencido})`],
          ['ativo', `Em dia (${contagens.ativo})`],
          ['sem_periodo', `Sem registro (${contagens.sem_periodo})`],
        ] as const).map(([valor, label]) => (
          <button
            key={valor}
            onClick={() => setFiltro(valor)}
            style={{
              padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: `1px solid ${filtro === valor ? 'var(--accent2)' : 'var(--border)'}`,
              background: filtro === valor ? 'var(--accent2)15' : 'var(--card)',
              color: filtro === valor ? 'var(--accent2)' : 'var(--text2)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <input
        placeholder="Buscar aluno..."
        value={busca}
        onChange={e => setBusca(e.target.value)}
        style={{
          width: '100%', padding: '10px 12px', borderRadius: 6, marginBottom: 16, boxSizing: 'border-box',
          background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13,
        }}
      />

      {loading ? (
        <p style={{ color: 'var(--text3)', fontSize: 13 }}>Carregando...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtrados.map(a => {
            const statusAtual = a.periodoAtual?.status || 'sem_periodo'
            const info = STATUS_INFO[statusAtual]
            return (
              <div
                key={a.id}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                  padding: '12px 14px', borderRadius: 8, flexWrap: 'wrap',
                  background: 'var(--card)', border: `1px solid ${statusAtual === 'vencido' ? info.cor : 'var(--border)'}`,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{a.nome}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                    {a.periodoAtual
                      ? `${a.periodoAtual.status === 'vencido' ? 'Venceu' : 'Vale até'} ${new Date(a.periodoAtual.data_fim + 'T00:00:00').toLocaleDateString('pt-BR')}`
                      : 'Nenhum período registrado ainda'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {a.periodoFuturo && (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 4, color: STATUS_INFO.agendado.cor, background: STATUS_INFO.agendado.bg }}>
                      Renovado até {new Date(a.periodoFuturo.data_fim + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </span>
                  )}
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 4, color: info.cor, background: info.bg }}>
                    {info.label}
                  </span>
                </div>
              </div>
            )
          })}
          {!filtrados.length && (
            <p style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: 20 }}>Ninguém encontrado com esse filtro.</p>
          )}
        </div>
      )}
    </div>
  )
}
