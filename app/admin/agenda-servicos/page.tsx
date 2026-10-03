'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseAdmin'
import { Cabecalho } from '@/components/ui/Cabecalho'
import { idDoEndereco, rolarAteCard } from '@/components/ui/focarCard'

// Agenda dos serviços (02/10/2026): os horários de cada serviço que tem agenda própria.
// Saiu de dentro do card do serviço (tela Serviços) pra ficar junto das outras agendas.
// Mesma tabela (servicos_horarios) e mesmas operações de antes — só mudou de lugar.

type Servico = { id: string; nome: string; tem_agenda: boolean; ativo: boolean; agenda_tipo_id: string | null }
type ServicoHorario = { id: string; servico_id: string; dia_semana: number; horario: string; capacidade: number; ativo: boolean }
type TipoAgenda = { id: string; nome: string }

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export default function AgendaServicosPage() {
  const [servicos, setServicos] = useState<Servico[]>([])
  const [horarios, setHorarios] = useState<ServicoHorario[]>([])
  const [tipos, setTipos] = useState<TipoAgenda[]>([])
  const [loading, setLoading] = useState(true)
  const [novo, setNovo] = useState<Record<string, { dia: string; horario: string; vagas: string }>>({})

  async function carregar() {
    const [{ data: s }, { data: h }, { data: t }] = await Promise.all([
      supabase.from('servicos').select('id, nome, tem_agenda, ativo, agenda_tipo_id').eq('tem_agenda', true).order('nome'),
      supabase.from('servicos_horarios').select('*').order('dia_semana').order('horario'),
      supabase.from('tipos_agenda').select('id, nome'),
    ])
    setServicos((s as Servico[]) || [])
    setHorarios((h as ServicoHorario[]) || [])
    setTipos((t as TipoAgenda[]) || [])
    setLoading(false)
    const id = idDoEndereco()
    if (id && ((s as Servico[]) || []).some(x => x.id === id)) rolarAteCard(id)
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar() }, [])
  useEffect(() => {
    const ouvir = () => { const id = idDoEndereco(); if (id) rolarAteCard(id) }
    window.addEventListener('hashchange', ouvir)
    return () => window.removeEventListener('hashchange', ouvir)
  }, [])

  const form = (id: string) => novo[id] || { dia: '1', horario: '', vagas: '1' }
  const mudar = (id: string, campo: 'dia' | 'horario' | 'vagas', valor: string) =>
    setNovo(prev => ({ ...prev, [id]: { ...form(id), [campo]: valor } }))

  async function criarHorario(servicoId: string) {
    const f = form(servicoId)
    if (!f.horario) return
    await supabase.from('servicos_horarios').insert({
      servico_id: servicoId,
      dia_semana: Number(f.dia),
      horario: f.horario,
      capacidade: Number(f.vagas) || 1,
      ativo: true,
    })
    setNovo(prev => ({ ...prev, [servicoId]: { dia: f.dia, horario: '', vagas: '1' } }))
    carregar()
  }

  async function toggleHorarioAtivo(h: ServicoHorario) {
    await supabase.from('servicos_horarios').update({ ativo: !h.ativo }).eq('id', h.id)
    setHorarios(prev => prev.map(x => x.id === h.id ? { ...x, ativo: !x.ativo } : x))
  }

  async function excluirHorario(id: string) {
    if (!confirm('Apagar esse horário de agenda do serviço?')) return
    await supabase.from('servicos_horarios').delete().eq('id', id)
    carregar()
  }

  return (
    <div>
      <Cabecalho
        titulo="Agenda dos serviços"
        subtitulo={<>
          Dias e horários de cada serviço que tem agenda própria (ex.: Personal, Aula avulsa em dia isolado). Esses horários
          não usam nem afetam a agenda de aula. Pra criar um serviço ou mudar preço, vá em <Link href="/admin/servicos">Serviços</Link>.
        </>}
      />

      {loading ? <p className="vazio">Carregando...</p> : !servicos.length ? (
        <p className="vazio">Nenhum serviço com agenda. Em <Link href="/admin/servicos">Serviços</Link>, marque “Tem agenda” no serviço.</p>
      ) : (
        <div className="lista">
          {servicos.map(s => {
            const doServico = horarios.filter(h => h.servico_id === s.id)
            const f = form(s.id)
            const tipo = tipos.find(t => t.id === s.agenda_tipo_id)
            return (
              <div key={s.id} id={`item-${s.id}`} className="card" style={{ padding: '16px 18px', scrollMarginTop: 80, opacity: s.ativo ? 1 : 0.6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                  <div>
                    <div className="item-titulo">{s.nome}</div>
                    <div className="item-sub">
                      {s.agenda_tipo_id
                        ? <>Sincronizado com a agenda do estúdio: <b>{tipo?.nome || 'tipo de agenda'}</b></>
                        : <>{doServico.filter(h => h.ativo).length} horário(s) ativo(s)</>}
                    </div>
                  </div>
                  {!s.ativo && <span className="etiqueta" style={{ color: 'var(--danger)' }}>Serviço desativado</span>}
                </div>

                {s.agenda_tipo_id ? (
                  <p className="ajuda">
                    Esse serviço usa os mesmos dias e horários da agenda do estúdio desse tipo. Pra abrir ou fechar horário,
                    use a <Link href="/admin/agenda#grade">Grade de horário geral</Link> ou a <Link href="/admin/agenda-professores">grade de cada professor</Link>.
                  </p>
                ) : (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                      {doServico.map(h => (
                        <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 10px', borderRadius: 6, background: 'var(--bg)', opacity: h.ativo ? 1 : 0.5 }}>
                          <span style={{ fontSize: 13 }}>
                            {DIAS[h.dia_semana]} às {h.horario.slice(0, 5)} — {h.capacidade} vaga{h.capacidade > 1 ? 's' : ''}{!h.ativo && ' (desativado)'}
                          </span>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => toggleHorarioAtivo(h)} className="btn btn-ghost btn-sm">{h.ativo ? 'Desativar' : 'Ativar'}</button>
                            <button onClick={() => excluirHorario(h.id)} className="btn btn-outline-danger btn-sm">Apagar</button>
                          </div>
                        </div>
                      ))}
                      {!doServico.length && <p className="ajuda">Nenhum horário configurado ainda pra esse serviço.</p>}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <select value={f.dia} onChange={e => mudar(s.id, 'dia', e.target.value)} style={{ flex: '1 1 130px' }}>
                        {DIAS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                      </select>
                      <input type="time" value={f.horario} onChange={e => mudar(s.id, 'horario', e.target.value)} style={{ flex: '1 1 100px' }} />
                      <input type="number" min={1} value={f.vagas} onChange={e => mudar(s.id, 'vagas', e.target.value)} placeholder="Vagas" style={{ flex: '1 1 80px' }} />
                      <button onClick={() => criarHorario(s.id)} disabled={!f.horario} className="btn btn-primary btn-sm">+ Adicionar horário</button>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
