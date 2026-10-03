'use client'
import Link from 'next/link'
import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabaseAdmin'
import { Cabecalho } from '@/components/ui/Cabecalho'
import { idDoEndereco, rolarAteCard } from '@/components/ui/focarCard'

type Servico = {
  id: string
  nome: string
  valor: number
  quantidade_usos: number
  tem_agenda: boolean
  ativo: boolean
  created_at: string
  chave_pix: string | null
  chave_pix_valor_fixo: boolean
  link_cartao: string | null
  link_cartao_valor_fixo: boolean
  valor_atualizado_em: string
  pix_atualizado_em: string | null
  categoria_id: string | null
  agenda_tipo_id: string | null
}

type TipoAgenda = { id: string; nome: string }

type Categoria = {
  id: string
  nome: string
  ativo: boolean
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


function pixDesatualizado(s: Servico) {
  if (!s.pix_atualizado_em) return true
  return new Date(s.valor_atualizado_em).getTime() > new Date(s.pix_atualizado_em).getTime()
}

const sectionBox: React.CSSProperties = {
  background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 10,
}
const sectionTitle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6,
}

function badgeStyle(tone: 'ok' | 'warn' | 'bad' | 'neutral'): React.CSSProperties {
  const colors = {
    ok: { bg: 'rgba(34,197,94,0.15)', fg: '#22c55e' },
    warn: { bg: 'rgba(224,160,32,0.18)', fg: '#e0a020' },
    bad: { bg: 'rgba(239,68,68,0.15)', fg: '#ef4444' },
    neutral: { bg: 'rgba(148,163,184,0.15)', fg: 'var(--text2)' },
  }[tone]
  return {
    display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600,
    padding: '3px 9px', borderRadius: 999, background: colors.bg, color: colors.fg,
  }
}

function SegmentedToggle({ value, onChange, trueLabel, falseLabel }: {
  value: boolean; onChange: (v: boolean) => void; trueLabel: string; falseLabel: string
}) {
  const btnBase: React.CSSProperties = {
    flex: 1, padding: '8px 10px', fontSize: 12, textAlign: 'center', cursor: 'pointer',
    border: '1px solid var(--border)', fontFamily: 'inherit', userSelect: 'none',
  }
  return (
    <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden' }}>
      <div onClick={() => onChange(true)} style={{
        ...btnBase, borderRadius: '6px 0 0 6px',
        background: value ? 'var(--accent2)' : 'var(--bg)',
        color: value ? '#fff' : 'var(--text2)', fontWeight: value ? 700 : 400,
      }}>{trueLabel}</div>
      <div onClick={() => onChange(false)} style={{
        ...btnBase, borderRadius: '0 6px 6px 0', borderLeft: 'none',
        background: !value ? 'var(--accent2)' : 'var(--bg)',
        color: !value ? '#fff' : 'var(--text2)', fontWeight: !value ? 700 : 400,
      }}>{falseLabel}</div>
    </div>
  )
}

function ServicosContent() {
  const [servicos, setServicos] = useState<Servico[]>([])
  const [horarios, setHorarios] = useState<ServicoHorario[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [servicoExpandido, setServicoExpandido] = useState<string | null>(null)
  const [nomeExpandidoId, setNomeExpandidoId] = useState<string | null>(null)

  const [nome, setNome] = useState('')
  const [valor, setValor] = useState('')
  const [quantidadeUsos, setQuantidadeUsos] = useState('1')
  const [temAgenda, setTemAgenda] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [categoriaId, setCategoriaId] = useState('')

  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [editCategoriaId, setEditCategoriaId] = useState('')
  const [editAgendaTipoId, setEditAgendaTipoId] = useState('')
  const [agendaTipoId, setAgendaTipoId] = useState('')
  const [tiposAgenda, setTiposAgenda] = useState<TipoAgenda[]>([])
  const [horariosPorTipo, setHorariosPorTipo] = useState<Record<string, number>>({})

  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editNome, setEditNome] = useState('')
  const [editValor, setEditValor] = useState('')
  const [editQuantidadeUsos, setEditQuantidadeUsos] = useState('')
  const [editTemAgenda, setEditTemAgenda] = useState(false)
  const [editChavePix, setEditChavePix] = useState('')
  const [editChaveValorFixo, setEditChaveValorFixo] = useState(true)
  const [editLinkCartao, setEditLinkCartao] = useState('')
  const [editLinkValorFixo, setEditLinkValorFixo] = useState(true)

  const [novoDia, setNovoDia] = useState('1')
  const [novoHorario, setNovoHorario] = useState('')
  const [novaCapacidade, setNovaCapacidade] = useState('1')

  async function carregar() {
    setLoading(true)
    const { data } = await supabase.from('servicos').select('*').order('nome')
    setServicos((data as Servico[]) || [])
    focarDoEndereco((data as Servico[]) || [])
    const { data: horariosData } = await supabase.from('servicos_horarios').select('*').order('dia_semana').order('horario')
    setHorarios((horariosData as ServicoHorario[]) || [])
    const { data: categoriasData } = await supabase.from('servicos_categorias').select('*').order('nome')
    setCategorias((categoriasData as Categoria[]) || [])
    const { data: tiposData } = await supabase.from('tipos_agenda').select('id, nome').eq('ativo', true).order('created_at')
    setTiposAgenda((tiposData as TipoAgenda[]) || [])
    const { data: horEstudio } = await supabase.from('horarios').select('tipo_agenda_id').eq('ativo', true)
    const contagem: Record<string, number> = {}
    for (const h of (horEstudio as { tipo_agenda_id: string | null }[]) || []) if (h.tipo_agenda_id) contagem[h.tipo_agenda_id] = (contagem[h.tipo_agenda_id] || 0) + 1
    setHorariosPorTipo(contagem)
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])


  async function criar() {
    if (!nome.trim() || !valor) return
    setSalvando(true)
    const { error } = await supabase.from('servicos').insert({
      nome: nome.trim(),
      valor: Number(valor),
      quantidade_usos: Number(quantidadeUsos) || 1,
      tem_agenda: temAgenda,
      ativo: true,
      categoria_id: categoriaId || null,
      agenda_tipo_id: temAgenda && agendaTipoId ? agendaTipoId : null,
    })
    setSalvando(false)
    if (error) { alert('Não consegui criar o serviço: ' + error.message); return }
    setNome(''); setValor(''); setQuantidadeUsos('1'); setTemAgenda(false); setCategoriaId(''); setAgendaTipoId(''); setMostrarForm(false)
    carregar()
  }

  function abrirEdicao(s: Servico) {
    setEditandoId(s.id)
    setEditNome(s.nome)
    setEditValor(String(s.valor))
    setEditQuantidadeUsos(String(s.quantidade_usos))
    setEditTemAgenda(s.tem_agenda)
    setEditChavePix(s.chave_pix || '')
    setEditChaveValorFixo(s.chave_pix_valor_fixo)
    setEditLinkCartao(s.link_cartao || '')
    setEditLinkValorFixo(s.link_cartao_valor_fixo)
    setEditCategoriaId(s.categoria_id || '')
    setEditAgendaTipoId(s.agenda_tipo_id || '')
  }
  // Clicou no item pelo menu (#id no endereço): abre a edição dele e rola até o card.
  function focarDoEndereco(lista: Servico[]) {
    const id = idDoEndereco()
    const alvo = lista.find(x => x.id === id)
    if (!alvo) return
    abrirEdicao(alvo)
    rolarAteCard(id)
  }
  useEffect(() => {
    const ouvir = () => focarDoEndereco(servicos)
    window.addEventListener('hashchange', ouvir)
    return () => window.removeEventListener('hashchange', ouvir)
  })


  async function salvarEdicao(id: string) {
    const servicoAtual = servicos.find(s => s.id === id)
    const corpo: Record<string, unknown> = {
      nome: editNome.trim(),
      valor: Number(editValor),
      quantidade_usos: Number(editQuantidadeUsos) || 1,
      tem_agenda: editTemAgenda,
      chave_pix_valor_fixo: editChaveValorFixo,
      link_cartao_valor_fixo: editLinkValorFixo,
      categoria_id: editCategoriaId || null,
      agenda_tipo_id: editTemAgenda && editAgendaTipoId ? editAgendaTipoId : null,
    }
    // Só marca a chave Pix como "atualizada agora" se o texto dela realmente mudou.
    if (servicoAtual && editChavePix.trim() !== (servicoAtual.chave_pix || '')) {
      corpo.chave_pix = editChavePix.trim() || null
    }
    corpo.link_cartao = editLinkCartao.trim() || null
    const { error } = await supabase.from('servicos').update(corpo).eq('id', id)
    if (error) { alert('Não consegui salvar: ' + error.message); return }
    setEditandoId(null)
    setNomeExpandidoId(null)
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

  function nomeTipoAgenda(id: string | null) {
    if (!id) return null
    return tiposAgenda.find(t => t.id === id)?.nome || null
  }

  function selectSincronia(value: string, onChange: (v: string) => void) {
    return (
      <div style={{ marginTop: 8 }}>
        <label className="rotulo">Horários do serviço</label>
        <select className="campo" value={value} onChange={e => onChange(e.target.value)}>
          <option value="">Horários próprios (cadastro aqui no serviço)</option>
          {tiposAgenda.map(t => (
            <option key={t.id} value={t.id}>Sincronizar com a agenda: {t.nome} ({horariosPorTipo[t.id] || 0} horários)</option>
          ))}
        </select>
        <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
          Sincronizado: o serviço fica disponível nos mesmos dias e horários desse tipo de agenda do estúdio (tela Professores). Se abrir ou fechar horário lá, muda aqui sozinho.
        </p>
      </div>
    )
  }

  function nomeCategoria(id: string | null) {
    if (!id) return null
    return categorias.find(c => c.id === id)?.nome || null
  }

  function selectCategoria(value: string, onChange: (v: string) => void, atualId?: string | null) {
    return (
      <select className="campo" value={value} onChange={e => onChange(e.target.value)}>
        <option value="">Sem categoria</option>
        {categorias.filter(c => c.ativo || c.id === atualId).map(c => (
          <option key={c.id} value={c.id}>{c.nome}{!c.ativo ? ' (desativada)' : ''}</option>
        ))}
      </select>
    )
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
      <Cabecalho
        titulo="Serviços"
        subtitulo={<>
          Crie, edite, ative/desative ou apague os serviços oferecidos (aula avulsa, avaliação física, ou qualquer serviço novo).
          Cada serviço define seu próprio valor, quantidade de usos e se tem agenda própria — separada da agenda de aula.
          Cadastre aqui também a chave Pix (já com o valor certo) e o link de cartão — é isso que a Elen vai mandar pro aluno.
        </>}
      />

      <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
        🏷️ As categorias dos serviços (criar, renomear, desativar) ficam em <Link href="/admin/configuracoes#categorias" style={{ color: '#4a90d9' }}>Configurações → Categorias de serviços</Link>.
      </p>

      {loading ? (
        <p className="vazio">Carregando...</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginBottom: 20 }}>
          {servicos.map(s => {
            const desatualizado = !!s.chave_pix && pixDesatualizado(s)
            return (
            <div key={s.id} id={`item-${s.id}`} className="card card-hover" style={{
              scrollMarginTop: 80,
              borderColor: !s.ativo ? 'var(--danger)' : (desatualizado ? '#e0a020' : 'var(--border)'),
              padding: '16px 18px', opacity: s.ativo ? 1 : 0.55,
            }}>
              {editandoId === s.id ? (
                <div>
                  <div style={sectionBox}>
                    <div style={sectionTitle}>📋 Dados do serviço</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                      <input className="campo" value={editNome} onChange={e => setEditNome(e.target.value)} style={{ flex: '2 1 160px' }} placeholder="Nome do serviço" />
                      <input className="campo" type="number" step="0.01" value={editValor} onChange={e => setEditValor(e.target.value)} style={{ flex: '1 1 100px' }} placeholder="Valor (R$)" />
                      <input className="campo" type="number" min={1} value={editQuantidadeUsos} onChange={e => setEditQuantidadeUsos(e.target.value)} style={{ flex: '1 1 100px' }} placeholder="Qtd. usos" />
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <label className="rotulo">Categoria</label>
                      {selectCategoria(editCategoriaId, setEditCategoriaId, s.categoria_id)}
                    </div>
                    <label style={{ fontSize: 12, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="checkbox" checked={editTemAgenda} onChange={e => setEditTemAgenda(e.target.checked)} />
                      Tem agenda (precisa marcar dia/horário)
                    </label>
                    {editTemAgenda && selectSincronia(editAgendaTipoId, setEditAgendaTipoId)}
                  </div>

                  <div style={sectionBox}>
                    <div style={sectionTitle}>🔑 Pagamento via Pix</div>
                    <textarea className="campo" value={editChavePix} onChange={e => setEditChavePix(e.target.value)} style={{ minHeight: 60, resize: 'vertical', marginBottom: 10 }} placeholder="Cole aqui o código Pix copia-e-cola, ou uma chave Pix simples (já com o valor certo desse serviço)" />
                    <SegmentedToggle value={editChaveValorFixo} onChange={setEditChaveValorFixo} trueLabel="Valor fixo (só copia e cola)" falseLabel="Chave aberta (aluno digita)" />
                  </div>

                  <div style={sectionBox}>
                    <div style={sectionTitle}>💳 Pagamento no cartão</div>
                    <input className="campo" value={editLinkCartao} onChange={e => setEditLinkCartao(e.target.value)} style={{ marginBottom: 10 }} placeholder="Cole aqui o link de pagamento no cartão deste serviço" />
                    <SegmentedToggle value={editLinkValorFixo} onChange={setEditLinkValorFixo} trueLabel="Valor fixo (só clica e paga)" falseLabel="Link aberto (aluno digita)" />
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => salvarEdicao(s.id)} className="btn btn-primary btn-sm">Salvar</button>
                    <button onClick={() => setEditandoId(null)} className="btn btn-neutral btn-sm">Cancelar</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div
                    onClick={() => setNomeExpandidoId(nomeExpandidoId === s.id ? null : s.id)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                  >
                    <span style={{ fontWeight: 700, fontSize: 14 }}>
                      {s.nome}
                      {nomeCategoria(s.categoria_id)
                        ? <span style={{ ...badgeStyle('neutral'), marginLeft: 8 }}>🏷️ {nomeCategoria(s.categoria_id)}</span>
                        : <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 8, fontWeight: 400 }}>(sem categoria)</span>}
                      {!s.ativo && <span style={{ fontSize: 11, color: 'var(--danger)', marginLeft: 8, fontWeight: 400 }}>(desativado)</span>}
                    </span>
                    <span style={{
                      fontSize: 12, color: 'var(--text3)', display: 'inline-block',
                      transform: nomeExpandidoId === s.id ? 'rotate(90deg)' : 'none', transition: 'transform .15s ease',
                    }}>▸</span>
                  </div>

                  {nomeExpandidoId === s.id && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>
                        R$ {Number(s.valor).toFixed(2)} · {s.quantidade_usos}x uso{s.quantidade_usos > 1 ? 's' : ''} · {s.tem_agenda ? (s.agenda_tipo_id ? `agenda sincronizada com ${nomeTipoAgenda(s.agenda_tipo_id) || 'tipo removido'} (${horariosPorTipo[s.agenda_tipo_id] || 0} horários)` : 'com agenda própria') : 'sem agenda'}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                        {s.chave_pix
                          ? <span style={badgeStyle('ok')}>✅ Pix · {s.chave_pix_valor_fixo ? 'valor fixo' : 'aluno digita'}</span>
                          : <span style={badgeStyle('warn')}>⚠️ Sem Pix</span>}
                        {s.link_cartao
                          ? <span style={badgeStyle('ok')}>✅ Cartão · {s.link_cartao_valor_fixo ? 'valor fixo' : 'aluno digita'}</span>
                          : <span style={badgeStyle('neutral')}>Sem link de cartão</span>}
                        {desatualizado && <span style={badgeStyle('warn')}>⚠️ preço mudou depois do Pix</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {s.tem_agenda && !s.agenda_tipo_id && (
                          <button onClick={() => setServicoExpandido(servicoExpandido === s.id ? null : s.id)} className="btn btn-ghost btn-sm">
                            📅 Agenda ({horarios.filter(h => h.servico_id === s.id && h.ativo).length})
                          </button>
                        )}
                        <button onClick={() => abrirEdicao(s)} className="btn btn-ghost btn-sm">✏️ Editar</button>
                        <button onClick={() => toggleAtivo(s)} className={`btn btn-sm ${s.ativo ? 'btn-ghost' : 'btn-outline-success'}`}>
                          {s.ativo ? 'Desativar' : 'Ativar'}
                        </button>
                        <button onClick={() => excluirServico(s)} className="btn btn-outline-danger btn-sm">Apagar</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {servicoExpandido === s.id && s.tem_agenda && !s.agenda_tipo_id && (
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
                    <select className="campo" value={novoDia} onChange={e => setNovoDia(e.target.value)} style={{ flex: '1 1 130px' }}>
                      {DIAS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                    <input className="campo" type="time" value={novoHorario} onChange={e => setNovoHorario(e.target.value)} style={{ flex: '1 1 100px' }} />
                    <input className="campo" type="number" min={1} value={novaCapacidade} onChange={e => setNovaCapacidade(e.target.value)} placeholder="Vagas" style={{ flex: '1 1 80px' }} />
                    <button onClick={() => criarHorario(s.id)} disabled={!novoHorario} className="btn btn-primary btn-sm">+ Add</button>
                  </div>
                </div>
              )}
            </div>
            )
          })}
          {!servicos.length && <p style={{ color: 'var(--text2)', fontSize: 13 }}>Nenhum serviço cadastrado ainda.</p>}
        </div>
      )}

      {!mostrarForm ? (
        <button onClick={() => setMostrarForm(true)} className="btn btn-primary">
          + Criar novo serviço
        </button>
      ) : (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
          <h3 style={{ fontSize: 14, marginBottom: 12 }}>Novo serviço</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label className="rotulo">Nome</label>
              <input className="campo" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Massagem, Pacote 5 Avaliações..." />
            </div>
            <div>
              <label className="rotulo">Categoria</label>
              {selectCategoria(categoriaId, setCategoriaId)}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label className="rotulo">Valor (R$)</label>
                <input className="campo" type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} placeholder="Ex: 50.00" />
              </div>
              <div style={{ flex: 1 }}>
                <label className="rotulo">Quantidade de usos</label>
                <input className="campo" type="number" min={1} value={quantidadeUsos} onChange={e => setQuantidadeUsos(e.target.value)} />
              </div>
            </div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={temAgenda} onChange={e => setTemAgenda(e.target.checked)} />
              Tem agenda (precisa marcar dia/horário)
            </label>
            {temAgenda && selectSincronia(agendaTipoId, setAgendaTipoId)}
            <p style={{ fontSize: 11, color: 'var(--text3)' }}>
              Depois de criar, edite o serviço pra cadastrar a chave Pix e o link de cartão.
            </p>
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

export default function ServicosPage() {
  return <Suspense><ServicosContent /></Suspense>
}
