'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseAdmin'

// Horários próprios de UM serviço (tabela servicos_horarios). Mesmas operações que
// existiam no card do serviço — só virou um pedaço reaproveitável (02/10/2026).
type ServicoHorario = { id: string; servico_id: string; dia_semana: number; horario: string; capacidade: number; ativo: boolean }
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export function HorariosServico({ servicoId, onMudou }: { servicoId: string; onMudou?: (ativos: number) => void }) {
  const [horarios, setHorarios] = useState<ServicoHorario[] | null>(null)
  const [dia, setDia] = useState('1')
  const [horario, setHorario] = useState('')
  const [vagas, setVagas] = useState('1')

  const carregar = useCallback(async () => {
    const { data } = await supabase.from('servicos_horarios').select('*').eq('servico_id', servicoId).order('dia_semana').order('horario')
    const lista = (data as ServicoHorario[]) || []
    setHorarios(lista)
    onMudou?.(lista.filter(h => h.ativo).length)
  }, [servicoId, onMudou])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar() }, [carregar])

  async function criar() {
    if (!horario) return
    await supabase.from('servicos_horarios').insert({
      servico_id: servicoId, dia_semana: Number(dia), horario, capacidade: Number(vagas) || 1, ativo: true,
    })
    setHorario(''); setVagas('1')
    carregar()
  }

  async function alternar(h: ServicoHorario) {
    await supabase.from('servicos_horarios').update({ ativo: !h.ativo }).eq('id', h.id)
    carregar()
  }

  async function apagar(id: string) {
    if (!confirm('Apagar esse horário de agenda do serviço?')) return
    await supabase.from('servicos_horarios').delete().eq('id', id)
    carregar()
  }

  if (horarios == null) return <p className="vazio">Carregando...</p>

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        {horarios.map(h => (
          <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 10px', borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)', opacity: h.ativo ? 1 : 0.5 }}>
            <span style={{ fontSize: 13 }}>
              <b>{DIAS[h.dia_semana]}</b> às {h.horario.slice(0, 5)} — {h.capacidade} vaga{h.capacidade > 1 ? 's' : ''}{!h.ativo && ' (desativado)'}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => alternar(h)} className="btn btn-ghost btn-sm">{h.ativo ? 'Desativar' : 'Ativar'}</button>
              <button onClick={() => apagar(h.id)} className="btn btn-outline-danger btn-sm">Apagar</button>
            </div>
          </div>
        ))}
        {!horarios.length && <p className="ajuda">Nenhum horário ainda. Adicione o primeiro abaixo.</p>}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 140px' }}>
          <label className="rotulo">Dia</label>
          <select className="campo" value={dia} onChange={e => setDia(e.target.value)}>
            {DIAS.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
        </div>
        <div style={{ flex: '1 1 110px' }}>
          <label className="rotulo">Horário</label>
          <input className="campo" type="time" value={horario} onChange={e => setHorario(e.target.value)} />
        </div>
        <div style={{ flex: '1 1 80px' }}>
          <label className="rotulo">Vagas</label>
          <input className="campo" type="number" min={1} value={vagas} onChange={e => setVagas(e.target.value)} />
        </div>
        <button onClick={criar} disabled={!horario} className="btn btn-primary">+ Adicionar horário</button>
      </div>
    </div>
  )
}
