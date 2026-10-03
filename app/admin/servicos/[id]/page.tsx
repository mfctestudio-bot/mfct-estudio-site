'use client'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseAdmin'
import { Cabecalho } from '@/components/ui/Cabecalho'
import { Segmento } from '@/components/ui/Segmento'
import { useAbaDaUrl } from '@/components/ui/useAbaDaUrl'
import { HorariosServico } from '@/components/admin/servicos/HorariosServico'

// Página própria de cada serviço (02/10/2026, pedido do Matheus): em vez de abrir o card
// espremido na lista, cada serviço tem sua página com abas — Dados, Pagamento e Agenda.
// O que é gravado é exatamente o mesmo que a edição na lista gravava.

type Servico = {
  id: string; nome: string; valor: number; quantidade_usos: number; tem_agenda: boolean; ativo: boolean
  chave_pix: string | null; chave_pix_valor_fixo: boolean; link_cartao: string | null; link_cartao_valor_fixo: boolean
  valor_atualizado_em: string; pix_atualizado_em: string | null; categoria_id: string | null; agenda_tipo_id: string | null
}
type Opcao = { id: string; nome: string; ativo?: boolean }
type Aba = 'dados' | 'pagamento' | 'agenda'

const brl = (v: number) => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',')

export default function ServicoPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [s, setS] = useState<Servico | null>(null)
  const [naoAchou, setNaoAchou] = useState(false)
  const [categorias, setCategorias] = useState<Opcao[]>([])
  const [tipos, setTipos] = useState<Opcao[]>([])
  const [horariosPorTipo, setHorariosPorTipo] = useState<Record<string, number>>({})
  const [aba, setAba] = useState<Aba>('dados')
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState('')

  // campos editáveis
  const [nome, setNome] = useState('')
  const [valor, setValor] = useState('')
  const [usos, setUsos] = useState('1')
  const [categoriaId, setCategoriaId] = useState('')
  const [temAgenda, setTemAgenda] = useState(false)
  const [agendaTipoId, setAgendaTipoId] = useState('')
  const [chavePix, setChavePix] = useState('')
  const [chaveFixa, setChaveFixa] = useState(true)
  const [linkCartao, setLinkCartao] = useState('')
  const [linkFixo, setLinkFixo] = useState(true)

  useAbaDaUrl(['dados', 'pagamento', 'agenda'] as const, setAba)
  function escolherAba(a: Aba) { setAba(a); history.replaceState(null, '', `#${a}`) }

  const preencher = useCallback((x: Servico) => {
    setS(x)
    setNome(x.nome); setValor(String(x.valor)); setUsos(String(x.quantidade_usos))
    setCategoriaId(x.categoria_id || ''); setTemAgenda(x.tem_agenda); setAgendaTipoId(x.agenda_tipo_id || '')
    setChavePix(x.chave_pix || ''); setChaveFixa(x.chave_pix_valor_fixo)
    setLinkCartao(x.link_cartao || ''); setLinkFixo(x.link_cartao_valor_fixo)
  }, [])

  const carregar = useCallback(async () => {
    const [{ data }, { data: cats }, { data: tps }, { data: hor }] = await Promise.all([
      supabase.from('servicos').select('*').eq('id', id).maybeSingle(),
      supabase.from('servicos_categorias').select('id, nome, ativo').order('nome'),
      supabase.from('tipos_agenda').select('id, nome').eq('ativo', true).order('created_at'),
      supabase.from('horarios').select('tipo_agenda_id').eq('ativo', true),
    ])
    if (!data) { setNaoAchou(true); return }
    preencher(data as Servico)
    setCategorias((cats as Opcao[]) || [])
    setTipos((tps as Opcao[]) || [])
    const contagem: Record<string, number> = {}
    for (const h of (hor as { tipo_agenda_id: string | null }[]) || []) if (h.tipo_agenda_id) contagem[h.tipo_agenda_id] = (contagem[h.tipo_agenda_id] || 0) + 1
    setHorariosPorTipo(contagem)
  }, [id, preencher])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar() }, [carregar])

  function mostrarAviso(t: string) { setAviso(t); setTimeout(() => setAviso(''), 2500) }

  async function salvar() {
    if (!s) return
    setSalvando(true)
    const corpo: Record<string, unknown> = {
      nome: nome.trim(),
      valor: Number(valor),
      quantidade_usos: Number(usos) || 1,
      tem_agenda: temAgenda,
      chave_pix_valor_fixo: chaveFixa,
      link_cartao_valor_fixo: linkFixo,
      categoria_id: categoriaId || null,
      agenda_tipo_id: temAgenda && agendaTipoId ? agendaTipoId : null,
    }
    // Só marca a chave Pix como "atualizada agora" se o texto dela realmente mudou.
    if (chavePix.trim() !== (s.chave_pix || '')) corpo.chave_pix = chavePix.trim() || null
    corpo.link_cartao = linkCartao.trim() || null
    const { error } = await supabase.from('servicos').update(corpo).eq('id', s.id)
    setSalvando(false)
    if (error) { alert('Não consegui salvar: ' + error.message); return }
    mostrarAviso('✅ Salvo')
    carregar()
  }

  async function alternarAtivo() {
    if (!s) return
    await supabase.from('servicos').update({ ativo: !s.ativo }).eq('id', s.id)
    carregar()
  }

  async function apagar() {
    if (!s) return
    if (!confirm(`Apagar o serviço "${s.nome}" de vez? Isso remove também os horários de agenda dele. Se preferir só tirar da lista de oferecer, use "Desativar" em vez de apagar.`)) return
    await supabase.from('servicos').delete().eq('id', s.id)
    router.push('/admin/servicos')
  }

  if (naoAchou) return <p className="vazio">Serviço não encontrado. <Link href="/admin/servicos">Voltar pra Serviços</Link></p>
  if (!s) return <p className="vazio">Carregando...</p>

  const categoria = categorias.find(c => c.id === s.categoria_id)?.nome
  const pixAntigo = !!s.chave_pix && (!s.pix_atualizado_em || new Date(s.valor_atualizado_em).getTime() > new Date(s.pix_atualizado_em).getTime())
  const proprios = s.tem_agenda && !s.agenda_tipo_id

  const ABAS: { id: Aba; label: string }[] = [
    { id: 'dados', label: '📋 Dados' },
    { id: 'pagamento', label: '💳 Pagamento' },
    { id: 'agenda', label: '📅 Agenda' },
  ]

  return (
    <div>
      <Cabecalho
        voltar={{ href: '/admin/servicos', label: 'Serviços' }}
        titulo={s.nome}
        subtitulo={<>{brl(s.valor)} · {s.quantidade_usos}x uso{s.quantidade_usos > 1 ? 's' : ''}{categoria ? ` · ${categoria}` : ''}</>}
        acoes={<>
          {aviso && <span className="etiqueta" style={{ color: '#3fb950' }}>{aviso}</span>}
          <span className="etiqueta" style={{ color: s.ativo ? '#3fb950' : 'var(--danger)' }}>{s.ativo ? 'Ativo' : 'Desativado'}</span>
          <button onClick={alternarAtivo} className={`btn btn-sm ${s.ativo ? 'btn-ghost' : 'btn-outline-success'}`}>{s.ativo ? 'Desativar' : 'Ativar'}</button>
          <button onClick={apagar} className="btn btn-outline-danger btn-sm">Apagar</button>
        </>}
      />

      <div className="abas">
        {ABAS.map(a => (
          <button key={a.id} onClick={() => escolherAba(a.id)} className={`aba${aba === a.id ? ' ativa' : ''}`}>{a.label}</button>
        ))}
      </div>

      {aba === 'dados' && (
        <div className="card bloco">
          <div className="secao-titulo">Dados do serviço</div>
          <div className="form-grade">
            <div>
              <label className="rotulo">Nome</label>
              <input className="campo" value={nome} onChange={e => setNome(e.target.value)} />
            </div>
            <div>
              <label className="rotulo">Categoria</label>
              <select className="campo" value={categoriaId} onChange={e => setCategoriaId(e.target.value)}>
                <option value="">Sem categoria</option>
                {categorias.filter(c => c.ativo || c.id === s.categoria_id).map(c => (
                  <option key={c.id} value={c.id}>{c.nome}{!c.ativo ? ' (desativada)' : ''}</option>
                ))}
              </select>
              <p className="ajuda" style={{ marginTop: 6 }}>As categorias se criam em <Link href="/admin/configuracoes#categorias">Configurações → Categorias</Link>.</p>
            </div>
            <div>
              <label className="rotulo">Valor (R$)</label>
              <input className="campo" type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} />
            </div>
            <div>
              <label className="rotulo">Quantidade de usos</label>
              <input className="campo" type="number" min={1} value={usos} onChange={e => setUsos(e.target.value)} />
            </div>
          </div>
          <div className="form-acoes">
            <button onClick={salvar} disabled={salvando || !nome.trim() || !valor} className="btn btn-primary">{salvando ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </div>
      )}

      {aba === 'pagamento' && (
        <div className="pilha">
          {pixAntigo && <div className="aviso aviso-atencao" style={{ marginBottom: 0 }}>⚠️ O preço mudou depois que a chave Pix foi cadastrada. Confira se o Pix ainda está com o valor certo.</div>}
          <div className="lado-a-lado">
          <div className="card bloco">
            <div className="secao-titulo">🔑 Pagamento via Pix</div>
            <textarea className="campo" value={chavePix} onChange={e => setChavePix(e.target.value)} rows={2} style={{ marginBottom: 10 }}
              placeholder="Cole aqui o código Pix copia-e-cola, ou uma chave Pix simples (já com o valor certo desse serviço)" />
            <Segmento value={chaveFixa} onChange={setChaveFixa} trueLabel="Valor fixo (só copia e cola)" falseLabel="Chave aberta (aluno digita)" />
            <p className="ajuda" style={{ marginTop: 8 }}>Sem chave aqui, a Elen usa a chave Pix padrão de <Link href="/admin/configuracoes#pagamentos">Configurações</Link>.</p>
          </div>
          <div className="card bloco">
            <div className="secao-titulo">💳 Pagamento no cartão</div>
            <input className="campo" value={linkCartao} onChange={e => setLinkCartao(e.target.value)} style={{ marginBottom: 10 }}
              placeholder="Cole aqui o link de pagamento no cartão deste serviço" />
            <Segmento value={linkFixo} onChange={setLinkFixo} trueLabel="Valor fixo (só clica e paga)" falseLabel="Link aberto (aluno digita)" />
          </div>
          </div>
          <div><button onClick={salvar} disabled={salvando} className="btn btn-primary">{salvando ? 'Salvando...' : 'Salvar'}</button></div>
        </div>
      )}

      {aba === 'agenda' && (
        <div className="lado-a-lado" style={!proprios ? { gridTemplateColumns: '1fr' } : undefined}>
          <div className="card bloco">
            <div className="secao-titulo">Como funciona a agenda desse serviço</div>
            <div className="segmento" style={{ marginBottom: 12 }}>
              <button type="button" className={!temAgenda ? 'ativo' : ''} onClick={() => setTemAgenda(false)}>Sem agenda</button>
              <button type="button" className={temAgenda && !agendaTipoId ? 'ativo' : ''} onClick={() => { setTemAgenda(true); setAgendaTipoId('') }}>Horários próprios</button>
              <button type="button" className={temAgenda && !!agendaTipoId ? 'ativo' : ''} onClick={() => { setTemAgenda(true); setAgendaTipoId(agendaTipoId || tipos[0]?.id || '') }} disabled={!tipos.length}>Igual à agenda do estúdio</button>
            </div>
            {temAgenda && !!agendaTipoId && (
              <div style={{ marginBottom: 12 }}>
                <label className="rotulo">Usar os horários deste tipo de aula</label>
                <select className="campo" value={agendaTipoId} onChange={e => setAgendaTipoId(e.target.value)}>
                  {tipos.map(t => <option key={t.id} value={t.id}>{t.nome} ({horariosPorTipo[t.id] || 0} horários)</option>)}
                </select>
              </div>
            )}
            <p className="ajuda" style={{ marginBottom: 12 }}>
              {!temAgenda && 'O aluno compra e usa sem marcar dia e horário.'}
              {temAgenda && !agendaTipoId && 'O serviço tem dias e horários só dele (cadastrados abaixo). Não usa nem afeta a agenda de aula.'}
              {temAgenda && !!agendaTipoId && 'O serviço fica disponível nos mesmos dias e horários desse tipo de aula. Abriu ou fechou horário na grade, muda aqui sozinho.'}
            </p>
            <button onClick={salvar} disabled={salvando} className="btn btn-primary">{salvando ? 'Salvando...' : 'Salvar'}</button>
          </div>

          {proprios && (
            <div className="card bloco">
              <div className="secao-titulo">Horários do serviço</div>
              <HorariosServico servicoId={s.id} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
