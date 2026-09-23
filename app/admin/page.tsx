'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseAdmin'
import { periodoAtualHoje, periodoFuturoHoje, statusPeriodoHoje } from '@/lib/periodos'

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
  vencido: { label: 'Vencido', cor: 'var(--danger)', bg: 'var(--danger)15' },
  agendado: { label: 'Agendado', cor: '#5b9bd5', bg: '#5b9bd515' },
  sem_periodo: { label: 'Sem período registrado', cor: 'var(--text3)', bg: 'var(--bg)' },
}

export default function MensalidadesPage() {
  const router = useRouter()
  const [alunos, setAlunos] = useState<AlunoComPeriodo[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'todos' | 'vencido' | 'ativo' | 'sem_periodo'>('todos')
  const [busca, setBusca] = useState('')

  async function carregar() {
    setLoading(true)
    const { data: alunosData } = await supabase
      .from('alunos')
      .select('id, nome, telefone, status_plano')
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
// Um período vencido só conta como "período atual" pra quem ainda está
            // cobrável (ativo ou já marcado vencido -- status_plano vira 'vencido'
            // assim que o período para de cobrir hoje, sem carência de acesso).
            // Aluno pausado/cancelado não deve reaparecer aqui como vencido só
            // por ter um período antigo vencido.
            const atual = periodoAtualHoje(periodos) || (['ativo', 'vencido'].includes(a.status_plano) ? periodos.find(p => statusPeriodoHoje(p) === 'vencido') || null : null)
      const futuro = periodoFuturoHoje(periodos)
      return { ...a, periodoAtual: atual, periodoFuturo: futuro }
                                                          }).filter(a => a.status_plano !== 'cancelado' && (a.periodoAtual || a.periodoFuturo || ['ativo', 'vencido'].includes(a.status_plano)))

    resultado.sort((a, b) => {
      const ordem = { vencido: 0, ativo: 1, sem_periodo: 2 }
      const statusA = a.periodoAtual ? statusPeriodoHoje(a.periodoAtual) : 'sem_periodo'
      const statusB = b.periodoAtual ? statusPeriodoHoje(b.periodoAtual) : 'sem_periodo'
      return (ordem[statusA as keyof typeof ordem] ?? 3) - (ordem[statusB as keyof typeof ordem] ?? 3)
    })

    setAlunos(resultado)
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  const filtrados = alunos.filter(a => {
    const statusAtual = a.periodoAtual ? statusPeriodoHoje(a.periodoAtual) : 'sem_periodo'
    if (filtro !== 'todos' && statusAtual !== filtro) return false
    if (busca && !a.nome.toLowerCase().includes(busca.toLowerCase())) return false
    return true
  })

  const contagens = {
    vencido: alunos.filter(a => a.periodoAtual && statusPeriodoHoje(a.periodoAtual) === 'vencido').length,
    ativo: alunos.filter(a => a.periodoAtual && statusPeriodoHoje(a.periodoAtual) === 'ativo').length,
    sem_periodo: alunos.filter(a => !a.periodoAtual).length,
  }

  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 4 }}>Planos</h1>
      <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>
        Quem está em dia, quem venceu, e quem já renovou pro próximo período. Pra confirmar um
        pagamento ou registrar um novo, use a tela de <Link href="/admin/pagamentos" style={{ color: 'var(--accent2)' }}>Pagamentos</Link> —
        assim que um pagamento é confirmado por lá, a mensalidade do aluno é liberada aqui automaticamente.
      </p>

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
            const statusAtual = a.periodoAtual ? statusPeriodoHoje(a.periodoAtual) : 'sem_periodo'
            const info = STATUS_INFO[statusAtual]
            return (
              <div
                key={a.id}
                onClick={() => router.push(`/admin/mensalidades/${a.id}`)}
                className="card card-hover"
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                  padding: '12px 14px', flexWrap: 'wrap', cursor: 'pointer',
                  borderColor: statusAtual === 'vencido' ? info.cor : 'var(--border)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{a.nome}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                    {a.periodoAtual
                      ? `${statusAtual === 'vencido' ? 'Venceu' : 'Vale até'} ${new Date(a.periodoAtual.data_fim + 'T00:00:00').toLocaleDateString('pt-BR')}`
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
