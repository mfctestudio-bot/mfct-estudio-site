'use client'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseAdmin'
import { Cabecalho } from '@/components/ui/Cabecalho'
import { HorariosServico } from '@/components/admin/servicos/HorariosServico'

// Agenda dos serviços (02/10/2026): os dias e horários de cada serviço que tem agenda.
// Separado em: com horários próprios / igual à agenda do estúdio / marcado "tem agenda" mas sem horário.
// Usa as mesmas tabelas de antes (servicos.tem_agenda/agenda_tipo_id e servicos_horarios).

type Servico = { id: string; nome: string; tem_agenda: boolean; ativo: boolean; agenda_tipo_id: string | null }
type TipoAgenda = { id: string; nome: string }

export default function AgendaServicosPage() {
  const router = useRouter()
  const [servicos, setServicos] = useState<Servico[]>([])
  const [contagem, setContagem] = useState<Record<string, number>>({})
  const [tipos, setTipos] = useState<TipoAgenda[]>([])
  const [loading, setLoading] = useState(true)
  const [aberto, setAberto] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    const [{ data: s }, { data: h }, { data: t }] = await Promise.all([
      supabase.from('servicos').select('id, nome, tem_agenda, ativo, agenda_tipo_id').order('nome'),
      supabase.from('servicos_horarios').select('servico_id, ativo'),
      supabase.from('tipos_agenda').select('id, nome'),
    ])
    const c: Record<string, number> = {}
    for (const x of (h as { servico_id: string; ativo: boolean }[]) || []) if (x.ativo) c[x.servico_id] = (c[x.servico_id] || 0) + 1
    setServicos((s as Servico[]) || [])
    setContagem(c)
    setTipos((t as TipoAgenda[]) || [])
    setLoading(false)
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar() }, [carregar])
  useEffect(() => {
    const ler = () => { const id = window.location.hash.slice(1); if (id) setAberto(id) }
    ler()
    window.addEventListener('hashchange', ler)
    return () => window.removeEventListener('hashchange', ler)
  }, [])

  async function tirarDaAgenda(s: Servico) {
    if (!confirm(`Tirar "${s.nome}" da agenda? O serviço continua existindo e sendo vendido, só deixa de ter dia e horário pra marcar. Dá pra voltar na página do serviço → Agenda.`)) return
    await supabase.from('servicos').update({ tem_agenda: false, agenda_tipo_id: null }).eq('id', s.id)
    carregar()
  }

  const comAgenda = servicos.filter(s => s.tem_agenda)
  const proprios = comAgenda.filter(s => !s.agenda_tipo_id && (contagem[s.id] || 0) > 0)
  const iguais = comAgenda.filter(s => !!s.agenda_tipo_id)
  const semHorario = comAgenda.filter(s => !s.agenda_tipo_id && !(contagem[s.id] || 0))
  const semAgenda = servicos.filter(s => !s.tem_agenda && s.ativo)

  function linha(s: Servico, sub: React.ReactNode, extra?: React.ReactNode) {
    const estaAberto = aberto === s.id
    return (
      <div key={s.id} className="card" style={{ opacity: s.ativo ? 1 : 0.6 }}>
        <div className="item-lista clicavel" onClick={() => setAberto(estaAberto ? null : s.id)}>
          <div>
            <div className="item-titulo">{s.nome}</div>
            <div className="item-sub">{sub}</div>
          </div>
          <div className="item-acoes" onClick={e => e.stopPropagation()}>
            {!s.ativo && <span className="etiqueta" style={{ color: 'var(--danger)' }}>Serviço desativado</span>}
            {extra}
            <button onClick={() => setAberto(estaAberto ? null : s.id)} className="btn btn-ghost btn-sm">{estaAberto ? 'Fechar' : 'Ver horários'}</button>
          </div>
        </div>
        {estaAberto && (
          <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            {s.agenda_tipo_id ? (
              <p className="ajuda">
                Usa os mesmos dias e horários da aula “{tipos.find(t => t.id === s.agenda_tipo_id)?.nome || 'tipo de aula'}”. Pra abrir ou fechar horário,
                use a <Link href="/admin/agenda#grade">Grade de horário geral</Link> ou a <Link href="/admin/agenda-professores">Grade dos professores</Link>.
              </p>
            ) : (
              <HorariosServico servicoId={s.id} onMudou={() => { /* contagem atualiza ao reabrir */ }} />
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <Cabecalho
        titulo="Agenda dos serviços"
        subtitulo={<>Dias e horários dos serviços que precisam ser marcados (ex.: Personal). Não mexe na agenda de aula. Preço, Pix e cartão ficam na página de cada serviço, em <Link href="/admin/servicos">Serviços</Link>.</>}
        acoes={semAgenda.length > 0 && (
          <select className="campo" style={{ width: 'auto' }} value="" onChange={e => e.target.value && router.push(`/admin/servicos/${e.target.value}#agenda`)}>
            <option value="">+ Colocar serviço na agenda…</option>
            {semAgenda.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        )}
      />

      {loading ? <p className="vazio">Carregando...</p> : (
        <div style={{ display: 'grid', gap: 22 }}>
          <section>
            <div className="secao-titulo">Com horários próprios</div>
            {proprios.length ? <div className="lista">{proprios.map(s => linha(s, `${contagem[s.id]} horário(s) ativo(s)`))}</div>
              : <p className="vazio">Nenhum serviço com horários próprios ainda.</p>}
          </section>

          {iguais.length > 0 && (
            <section>
              <div className="secao-titulo">Iguais à agenda do estúdio</div>
              <div className="lista">{iguais.map(s => linha(s, <>Mesmos horários da aula “{tipos.find(t => t.id === s.agenda_tipo_id)?.nome || '—'}”</>))}</div>
            </section>
          )}

          {semHorario.length > 0 && (
            <section>
              <div className="secao-titulo">Marcados com agenda, mas sem nenhum horário</div>
              <p className="ajuda" style={{ marginBottom: 10 }}>
                Esses serviços estão marcados como “tem agenda”, mas ninguém cadastrou horário. Adicione horários ou tire da agenda.
              </p>
              <div className="lista">
                {semHorario.map(s => linha(s, 'Nenhum horário cadastrado', (
                  <button onClick={() => tirarDaAgenda(s)} className="btn btn-outline-danger btn-sm">Tirar da agenda</button>
                )))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
