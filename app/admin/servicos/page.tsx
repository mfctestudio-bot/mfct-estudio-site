'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseAdmin'

type Servico = {
  id: string
  nome: string
  valor: number
  quantidade_usos: number
  tem_agenda: boolean
  ativo: boolean
  created_at: string
}

type ServicoHorario = {
  id: string
  servico_id: string
  dia_semana: number
  horario: string
  capacidade: number
  ativo: boolean
}

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6,
  padding: '9px 12px', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit',
}

export default function ServicosPage() {
  const [servicos, setServicos] = useState<Servico[]>([])
  const [horarios, setHorarios] = useState<ServicoHorario[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [servicoExpandido, setServicoExpandido] = useState<string | null>(null)

  const [nome, setNome] = useState('')
  const [valor, setValor] = useState('')
  const [quantidadeUsos, setQuantidadeUsos] = useState('1')
  const [temAgenda, setTemAgenda] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editNome, setEditNome] = useState('')
  const [editValor, setEditValor] = useState('')
  const [editQuantidadeUsos, setEditQuantidadeUsos] = useState('')
  const [editTemAgenda, setEditTemAgenda] = useState(false)

  const [novoDia, setNovoDia] = useState('1')
  const [novoHorario, setNovoHorario] = useState('')
  const [novaCapacidade, setNovaCapacidade] = useState('1')

  async function carregar() {
    setLoading(true)
    const { data } = await supabase.from('servicos').select('*').order('nome')
    setServicos((data as Servico[]) || [])
    const { data: horariosData } = await supabase.from('servicos_horarios').select('*').order('dia_semana').order('horario')
    setHorarios((horariosData as ServicoHorario[]) || [])
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  async function criar() {
    if (!nome.trim() || !valor) return
    setSalvando(true)
    await supabase.from('servicos').insert({
      nome: nome.trim(),
      valor: Number(valor),
      quantidade_usos: Number(quantidadeUsos) || 1,
      tem_agenda: temAgenda,
      ativo: true,
    })
    setSalvando(false)
    setNome(''); setValor(''); setQuantidadeUsos('1'); setTemAgenda(false); setMostrarForm(false)
    carregar()
  }

  function abrirEdicao(s: Servico) {
    setEditandoId(s.id)
    setEditNome(s.nome)
    setEditValor(String(s.valor))
    setEditQuantidadeUsos(String(s.quantidade_usos))
    setEditTemAgenda(s.tem_agenda)
  }

  async function salvarEdicao(id: string) {
    await supabase.from('servicos').update({
      nome: editNome.trim(),
      valor: Number(editValor),
      quantidade_usos: Number(editQuantidadeUsos) || 1,
      tem_agenda: editTemAgenda,
    }).eq('id', id)
    setEditandoId(null)
    carregar()
  }

  async function toggleAtivo(s: Servico) {
    await supabase.from('servicos').update({ ativo: !s.ativo }).eq('id', s.id)
    setServicos(prev => prev.map(x => x.id === s.id ? { ...x, ativo: !x.ativo } : x))
  }

  async function excluirServico(s: Servico) {
    if (!confirm(`Apagar o serviço "${s.nome}" de vez? Isso remove também os horários de agenda dele. Se preferir só tirar da lista de oferecer, use "Desativar" em vez de apagar.`)) return
    await supabase.from('servicos').delete().eq('id', s.id)
    carregar()
  }

  async function criarHorario(servicoId: string) {
    if (!novoHorario) return
    await supabase.from('servicos_horarios').insert({
      servico_id: servicoId,
      dia_semana: Number(novoDia),
      horario: novoHorario,
      capacidade: Number(novaCapacidade) || 1,
      ativo: true,
    })
    setNovoHorario(''); setNovaCapacidade('1')
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
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Serviços</h1>
      <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>
        Crie, edite, ative/desative ou apague os serviços oferecidos (aula avulsa, avaliação física, ou qualquer serviço novo).
        Cada serviço define seu próprio valor, quantidade de usos e se tem agenda própria — separada da agenda de aula.
      </p>

      {loading ? (
        <p style={{ color: 'var(--text2)' }}>Carregando...</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginBottom: 20 }}>
          {servicos.map(s => (
            <div key={s.id} className="card card-hover" style={{
              borderColor: s.ativo ? 'var(--border)' : 'var(--danger)',
              padding: '14px 16px', opacity: s.ativo ? 1 : 0.55,
            }}>
              {editandoId === s.id ? (
                <div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                    <input value={editNome} onChange={e => setEditNome(e.target.value)} style={{ ...inputStyle, flex: '2 1 160px' }} placeholder="Nome do serviço" />
                    <input type="number" step="0.01" value={editValor} onChange={e => setEditValor(e.target.value)} style={{ ...inputStyle, flex: '1 1 100px' }} placeholder="Valor (R$)" />
                    <input type="number" min={1} value={editQuantidadeUsos} onChange={e => setEditQuantidadeUsos(e.target.value)} style={{ ...inputStyle, flex: '1 1 100px' }} placeholder="Qtd. usos" />
                  </div>
                  <label style={{ fontSize: 12, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <input type="checkbox" checked={editTemAgenda} onChange={e => setEditTemAgenda(e.target.checked)} />
                    Tem agenda própria (precisa marcar dia/horário)
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => salvarEdicao(s.id)} className="btn btn-primary btn-sm">Salvar</button>
                    <button onClick={() => setEditandoId(null)} className="btn btn-neutral btn-sm">Cancelar</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{s.nome}</span>
                    <span style={{ fontSize: 12, color: 'var(--text2)', marginLeft: 8 }}>
                      R$ {Number(s.valor).toFixed(2)} · {s.quantidade_usos}x uso{s.quantidade_usos > 1 ? 's' : ''} · {s.tem_agenda ? 'com agenda' : 'sem agenda'}
                    </span>
                    {!s.ativo && <span style={{ fontSize: 11, color: 'var(--danger)', marginLeft: 8 }}>(desativado)</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {s.tem_agenda && (
                      <button onClick={() => setServicoExpandido(servicoExpandido === s.id ? null : s.id)} className="btn btn-ghost btn-sm">
                        📅 Agenda ({horarios.filter(h => h.servico_id === s.id && h.ativo).length})
                      </button>
                    )}
                    <button onClick={() => abrirEdicao(s)} className="btn btn-ghost btn-sm">✏️ Editar</button>
                    <button onClick={() => toggleAtivo(s)} style={{
                      background: 'transparent', border: `1px solid ${s.ativo ? 'var(--border)' : 'var(--danger)'}`,
                      color: s.ativo ? 'var(--text2)' : 'var(--danger)', borderRadius: 4, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                      {s.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                    <button onClick={() => excluirServico(s)} className="btn btn-outline-danger btn-sm">Apagar</button>
                  </div>
                </div>
              )}

              {servicoExpandido === s.id && s.tem_agenda && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>
                    Horários liberados só pra esse serviço — não usam nem afetam a agenda de aula.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                    {horarios.filter(h => h.servico_id === s.id).map(h => (
                      <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: 6, background: 'var(--bg)', opacity: h.ativo ? 1 : 0.5 }}>
                        <span style={{ fontSize: 12 }}>
                          {DIAS[h.dia_semana]} às {h.horario.slice(0, 5)} — {h.capacidade} vaga{h.capacidade > 1 ? 's' : ''}{!h.ativo && ' (desativado)'}
                        </span>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => toggleHorarioAtivo(h)} className="btn btn-ghost btn-sm">
                            {h.ativo ? 'Desativar' : 'Ativar'}
                          </button>
                          <button onClick={() => excluirHorario(h.id)} className="btn btn-outline-danger btn-sm">Apagar</button>
                        </div>
                      </div>
                    ))}
                    {!horarios.filter(h => h.servico_id === s.id).length && (
                      <p style={{ fontSize: 12, color: 'var(--text3)' }}>Nenhum horário configurado ainda pra esse serviço.</p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <select value={novoDia} onChange={e => setNovoDia(e.target.value)} style={{ ...inputStyle, flex: '1 1 130px' }}>
                      {DIAS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                    <input type="time" value={novoHorario} onChange={e => setNovoHorario(e.target.value)} style={{ ...inputStyle, flex: '1 1 100px' }} />
                    <input type="number" min={1} value={novaCapacidade} onChange={e => setNovaCapacidade(e.target.value)} placeholder="Vagas" style={{ ...inputStyle, flex: '1 1 80px' }} />
                    <button onClick={() => criarHorario(s.id)} disabled={!novoHorario} className="btn btn-primary btn-sm">+ Add</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {!servicos.length && <p style={{ color: 'var(--text2)', fontSize: 13 }}>Nenhum serviço cadastrado ainda.</p>}
        </div>
      )}

      {!mostrarForm ? (
        <button onClick={() => setMostrarForm(true)} style={{
          background: 'transparent', border: '1px solid var(--accent)', color: 'var(--accent)',
          borderRadius: 6, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          + Criar novo serviço
        </button>
      ) : (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
          <h3 style={{ fontSize: 14, marginBottom: 12 }}>Novo serviço</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, marginBottom: 6, display: 'block' }}>Nome</label>
              <input value={nome} onChange={e => setNome(e.target.value)} style={inputStyle} placeholder="Ex: Massagem, Pacote 5 Avaliações..." />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, marginBottom: 6, display: 'block' }}>Valor (R$)</label>
                <input type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} style={inputStyle} placeholder="Ex: 50.00" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, marginBottom: 6, display: 'block' }}>Quantidade de usos</label>
                <input type="number" min={1} value={quantidadeUsos} onChange={e => setQuantidadeUsos(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={temAgenda} onChange={e => setTemAgenda(e.target.checked)} />
              Tem agenda própria (precisa marcar dia/horário)
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={criar} disabled={salvando || !nome.trim() || !valor} className="btn btn-primary">
              {salvando ? 'Criando...' : '✅ Criar serviço'}
            </button>
            <button onClick={() => setMostrarForm(false)} disabled={salvando} className="btn btn-neutral">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
