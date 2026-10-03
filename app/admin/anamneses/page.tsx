'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseAdmin'
import { periodoAtualHoje } from '@/lib/periodos'
import { Cabecalho } from '@/components/ui/Cabecalho'
import { TODAS_PERGUNTAS, alertasDe, respondidas, type Respostas } from '@/lib/anamnese'

// Anamneses (03/10/2026): lista de todos os alunos e a situação da ficha de cada um.
// A Elen preenche pela conversa no WhatsApp; aqui você vê, corrige, baixa o PDF e manda pro aluno.

type Aluno = { id: string; nome: string; telefone: string | null }
type Ficha = { aluno_id: string; status: string; origem: string; respostas: Respostas; atualizado_em: string }
type Filtro = 'pendentes' | 'completas' | 'todas'

export default function AnamnesesPage() {
  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [fichas, setFichas] = useState<Record<string, Ficha>>({})
  const [ativos, setAtivos] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('pendentes')
  const [soAtivos, setSoAtivos] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('alunos').select('id, nome, telefone').order('nome'),
      supabase.from('anamneses').select('aluno_id, status, origem, respostas, atualizado_em').order('atualizado_em', { ascending: false }),
      supabase.from('planos_periodos').select('aluno_id, data_inicio, data_fim, status'),
    ]).then(([{ data: al }, { data: fi }, { data: pe }]) => {
      setAlunos((al as Aluno[]) || [])
      const mapa: Record<string, Ficha> = {}
      for (const f of (fi as Ficha[]) || []) if (!mapa[f.aluno_id]) mapa[f.aluno_id] = f
      setFichas(mapa)
      const porAluno = new Map<string, { data_inicio: string; data_fim: string; status: string }[]>()
      for (const p of (pe as { aluno_id: string; data_inicio: string; data_fim: string; status: string }[]) || []) {
        if (!porAluno.has(p.aluno_id)) porAluno.set(p.aluno_id, [])
        porAluno.get(p.aluno_id)!.push(p)
      }
      setAtivos(new Set([...porAluno.entries()].filter(([, ps]) => periodoAtualHoje(ps as never)).map(([id]) => id)))
      setLoading(false)
    })
  }, [])

  const situacao = (id: string) => (fichas[id]?.status === 'completa' ? 'completa' : fichas[id] ? 'parcial' : 'nenhuma')
  const base = alunos.filter(a => (!soAtivos || ativos.has(a.id)) && a.nome.toLowerCase().includes(busca.toLowerCase()))
  const contagem = {
    pendentes: base.filter(a => situacao(a.id) !== 'completa').length,
    completas: base.filter(a => situacao(a.id) === 'completa').length,
    todas: base.length,
  }
  const lista = base.filter(a => filtro === 'todas' ? true : filtro === 'completas' ? situacao(a.id) === 'completa' : situacao(a.id) !== 'completa')

  return (
    <div>
      <Cabecalho
        titulo="Anamneses"
        subtitulo="A ficha de saúde e hábitos de cada aluno. A Elen preenche conversando no WhatsApp; aqui você confere, corrige, baixa o PDF e manda pro aluno."
      />

      <div className="barra-filtros">
        <input className="busca" placeholder="Buscar aluno..." value={busca} onChange={e => setBusca(e.target.value)} />
        <select value={soAtivos ? 'ativos' : 'todos'} onChange={e => setSoAtivos(e.target.value === 'ativos')} style={{ flex: '0 1 240px' }}>
          <option value="ativos">Só alunos com plano em dia</option>
          <option value="todos">Todos os alunos</option>
        </select>
      </div>
      <div className="chips">
        <button onClick={() => setFiltro('pendentes')} className={`chip${filtro === 'pendentes' ? ' ativo' : ''}`}>Pendentes ({contagem.pendentes})</button>
        <button onClick={() => setFiltro('completas')} className={`chip${filtro === 'completas' ? ' ativo' : ''}`}>Completas ({contagem.completas})</button>
        <button onClick={() => setFiltro('todas')} className={`chip${filtro === 'todas' ? ' ativo' : ''}`}>Todas ({contagem.todas})</button>
      </div>

      {loading ? <p className="vazio">Carregando...</p> : !lista.length ? (
        <p className="vazio">Ninguém nesse filtro.</p>
      ) : (
        <div className="lista">
          {lista.map(a => {
            const f = fichas[a.id]
            const sit = situacao(a.id)
            const alertas = f ? alertasDe(f.respostas || {}).length : 0
            return (
              <Link key={a.id} href={`/admin/anamneses/${a.id}`} className="card card-hover item-lista">
                <div>
                  <div className="item-titulo">{a.nome}</div>
                  <div className="item-sub">
                    {f
                      ? `${respondidas(f.respostas || {})} de ${TODAS_PERGUNTAS.length} respostas · ${f.origem === 'elen' ? 'pela Elen' : 'pelo admin'} · ${new Date(f.atualizado_em).toLocaleDateString('pt-BR')}`
                      : 'Ainda não começou'}
                  </div>
                </div>
                <div className="item-acoes">
                  {alertas > 0 && <span className="etiqueta" style={{ color: 'var(--danger)' }}>⚠️ {alertas} ponto{alertas > 1 ? 's' : ''} de atenção</span>}
                  <span className="etiqueta" style={{ color: sit === 'completa' ? '#3fb950' : sit === 'parcial' ? '#e0a020' : 'var(--text3)' }}>
                    {sit === 'completa' ? 'Completa' : sit === 'parcial' ? 'Em preenchimento' : 'Não preenchida'}
                  </span>
                  <span style={{ color: 'var(--text3)', fontSize: 16 }}>›</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
