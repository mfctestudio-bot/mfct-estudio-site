'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseAdmin'
import { periodoAtualHoje, periodoFuturoHoje, statusPeriodoHoje } from '@/lib/periodos'
import { Cabecalho } from '@/components/ui/Cabecalho'

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
      <Cabecalho
        titulo="Mensalidades"
        subtitulo={<>
          Quem está em dia, quem venceu, e quem já renovou pro próximo período. Pra renovar, trocar de
          plano, pausar ou cancelar, clique no aluno. Pra confirmar um pagamento pendente ou estornar,
          use a tela de <Link href="/admin/pagamentos">Pagamentos</Link> —
          assim que um pagamento é confirmado por lá, a mensalidade do aluno é liberada aqui automaticamente.
        </>}
      />

      <div className="barra-filtros">
        <input
          className="busca"
          placeholder="Buscar aluno..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>

      <div className="chips">
        {([
          ['todos', `Todos (${alunos.length})`],
          ['vencido', `Vencidos (${contagens.vencido})`],
          ['ativo', `Em dia (${contagens.ativo})`],
          ['sem_periodo', `Sem registro (${contagens.sem_periodo})`],
        ] as const).map(([valor, label]) => (
          <button key={valor} onClick={() => setFiltro(valor)} className={`chip${filtro === valor ? ' ativo' : ''}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="vazio">Carregando...</p>
      ) : (
        <div className="lista">
          {filtrados.map(a => {
            const statusAtual = a.periodoAtual ? statusPeriodoHoje(a.periodoAtual) : 'sem_periodo'
            const info = STATUS_INFO[statusAtual]
            return (
              <div
                key={a.id}
                onClick={() => router.push(`/admin/mensalidades/${a.id}`)}
                className="card card-hover item-lista clicavel"
                style={{ borderColor: statusAtual === 'vencido' ? info.cor : 'var(--border)' }}
              >
                <div>
                  <div className="item-titulo">{a.nome}</div>
                  <div className="item-sub">
                    {a.periodoAtual
                      ? `${statusAtual === 'vencido' ? 'Venceu' : 'Vale até'} ${new Date(a.periodoAtual.data_fim + 'T00:00:00').toLocaleDateString('pt-BR')}`
                      : 'Nenhum período registrado ainda'}
                  </div>
                </div>
                <div className="item-acoes">
                  {a.periodoFuturo && (
                    <span className="etiqueta" style={{ color: STATUS_INFO.agendado.cor }}>
                      Renovado até {new Date(a.periodoFuturo.data_fim + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </span>
                  )}
                  <span className="etiqueta" style={{ color: info.cor }}>
                    {info.label}
                  </span>
                </div>
              </div>
            )
          })}
          {!filtrados.length && (
            <p className="vazio">Ninguém encontrado com esse filtro.</p>
          )}
        </div>
      )}
    </div>
  )
}
