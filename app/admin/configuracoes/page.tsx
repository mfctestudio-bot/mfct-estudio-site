'use client'
import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseAdmin'
import { CAMPOS_CONTRATO, MODELO_CONTRATO_PADRAO } from '@/lib/contrato'
import { Cabecalho } from '@/components/ui/Cabecalho'

const card: React.CSSProperties = { padding: '16px 18px', marginBottom: 14 }
const titulo: React.CSSProperties = { fontWeight: 700, fontSize: 14, marginBottom: 4 }
const ajuda: React.CSSProperties = { fontSize: 12, color: 'var(--text3)', marginBottom: 10 }

const SECOES = [
  { id: 'pagamentos', label: '💳 Pagamentos', desc: 'Chaves Pix gerais' },
  { id: 'contrato', label: '📄 Contrato', desc: 'Texto do contrato + termo' },
  { id: 'categorias', label: '🏷️ Categorias', desc: 'Tipos de serviço' },
  { id: 'elen', label: '🤖 Elen', desc: 'Números bloqueados' },
  { id: 'limpeza', label: '🧹 Limpeza', desc: 'Dados antigos' },
]

// Lê/grava uma linha da tabela configuracoes (chave → valor)
async function lerConfig(chave: string) {
  const { data } = await supabase.from('configuracoes').select('valor').eq('chave', chave).maybeSingle()
  return { existe: !!data, valor: (data as { valor: string | null } | null)?.valor || '' }
}
async function gravarConfig(chave: string, valor: string, existe: boolean) {
  const corpo = { valor: valor.trim() || null, atualizado_em: new Date().toISOString() }
  return existe
    ? supabase.from('configuracoes').update(corpo).eq('chave', chave)
    : supabase.from('configuracoes').insert({ chave, ...corpo })
}

function CampoConfig({ chave, rotulo, descricao, placeholder, multilinha, normalizar }: { chave: string; rotulo: string; descricao: string; placeholder?: string; multilinha?: boolean; normalizar?: (v: string) => string }) {
  const [valor, setValor] = useState('')
  const [salvo, setSalvo] = useState('')
  const [existe, setExiste] = useState(false)
  const [salvando, setSalvando] = useState(false)
  useEffect(() => { lerConfig(chave).then(r => { setValor(r.valor); setSalvo(r.valor); setExiste(r.existe) }) }, [chave])
  async function salvar() {
    setSalvando(true)
    const final = normalizar ? normalizar(valor) : valor
    const { error } = await gravarConfig(chave, final, existe)
    setSalvando(false)
    if (error) { alert('Não consegui salvar: ' + error.message); return }
    setExiste(true); setValor(final); setSalvo(final)
  }
  return (
    <div className="card" style={card}>
      <div style={titulo}>{rotulo}</div>
      <p style={ajuda}>{descricao}</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {multilinha
          ? <textarea className="campo" value={valor} onChange={e => setValor(e.target.value)} placeholder={placeholder} style={{ flex: '1 1 260px', minHeight: 70, resize: 'vertical' }} />
          : <input className="campo" value={valor} onChange={e => setValor(e.target.value)} placeholder={placeholder} style={{ flex: '1 1 260px', width: 'auto' }} />}
        <button onClick={salvar} disabled={salvando || valor === salvo} className="btn btn-primary btn-sm">{salvando ? 'Salvando...' : 'Salvar'}</button>
      </div>
    </div>
  )
}

function ModeloContrato() {
  const [modelo, setModelo] = useState('')
  const [salvo, setSalvo] = useState('')
  const [existe, setExiste] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [aberto, setAberto] = useState(false)
  useEffect(() => { lerConfig('modelo_contrato').then(r => { setExiste(r.existe); setModelo(r.valor || MODELO_CONTRATO_PADRAO); setSalvo(r.valor) }) }, [])
  async function salvar() {
    setSalvando(true)
    const { error } = await gravarConfig('modelo_contrato', modelo, existe)
    setSalvando(false)
    if (error) { alert('Não consegui salvar o modelo: ' + error.message); return }
    setExiste(true); setSalvo(modelo)
  }
  const pendentes = (modelo.match(/\[AJUSTAR[^\]]*\]/g) || []).length
  const alterado = modelo !== (salvo || MODELO_CONTRATO_PADRAO)
  function inserirCampo(chave: string) {
    const el = document.getElementById('editor-contrato') as HTMLTextAreaElement | null
    const tag = `{{${chave}}}`
    if (!el) { setModelo(m => m + tag); return }
    const ini = el.selectionStart, fim = el.selectionEnd
    setModelo(m => m.slice(0, ini) + tag + m.slice(fim))
    setTimeout(() => { el.focus(); el.selectionStart = el.selectionEnd = ini + tag.length }, 0)
  }
  return (
    <div className="card" style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={titulo}>Modelo do contrato + termo de responsabilidade</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            {existe ? '✅ Modelo próprio salvo' : '⚠️ Usando o modelo padrão (ainda não salvo)'}
            {pendentes > 0 && <span style={{ color: '#e0a020' }}> · {pendentes} trecho{pendentes > 1 ? 's' : ''} [AJUSTAR] pra revisar</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Link href="/admin/contratos" className="btn btn-ghost btn-sm">📄 Gerar pra um aluno</Link>
          <button onClick={() => setAberto(!aberto)} className="btn btn-primary btn-sm">{aberto ? 'Fechar editor' : '✏️ Editar texto'}</button>
        </div>
      </div>
      {aberto && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Clique num campo pra inserir onde está o cursor (é trocado pelo dado do aluno na hora de gerar):</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {CAMPOS_CONTRATO.map(c => (
              <button key={c.chave} onClick={() => inserirCampo(c.chave)} title={`{{${c.chave}}}`} className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>+ {c.descricao}</button>
            ))}
          </div>
          <textarea className="campo" id="editor-contrato" value={modelo} onChange={e => setModelo(e.target.value)} style={{ minHeight: 360 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>Folha nova na impressão: uma linha com <code>==== QUEBRA DE PÁGINA ====</code></span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => { if (confirm('Voltar o texto para o modelo padrão? O que você editou e não salvou se perde.')) setModelo(MODELO_CONTRATO_PADRAO) }} className="btn btn-ghost btn-sm">Restaurar padrão</button>
              <button onClick={salvar} disabled={salvando || (!alterado && existe)} className="btn btn-success btn-sm">{salvando ? 'Salvando...' : '💾 Salvar modelo'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

type Categoria = { id: string; nome: string; ativo: boolean }

function CategoriasServicos() {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [uso, setUso] = useState<Record<string, number>>({})
  const [nova, setNova] = useState('')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editNome, setEditNome] = useState('')

  async function carregar() {
    const [{ data: cats }, { data: servs }] = await Promise.all([
      supabase.from('servicos_categorias').select('id, nome, ativo').order('nome'),
      supabase.from('servicos').select('categoria_id'),
    ])
    setCategorias((cats as Categoria[]) || [])
    const c: Record<string, number> = {}
    for (const s of (servs as { categoria_id: string | null }[]) || []) if (s.categoria_id) c[s.categoria_id] = (c[s.categoria_id] || 0) + 1
    setUso(c)
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar() }, [])

  async function criar() {
    const n = nova.trim()
    if (!n) return
    const { error } = await supabase.from('servicos_categorias').insert({ nome: n, ativo: true })
    if (error) { alert(error.code === '23505' ? 'Já existe uma categoria com esse nome.' : 'Não consegui criar: ' + error.message); return }
    setNova(''); carregar()
  }
  async function salvar(id: string) {
    const n = editNome.trim()
    if (!n) return
    const { error } = await supabase.from('servicos_categorias').update({ nome: n }).eq('id', id)
    if (error) { alert(error.code === '23505' ? 'Já existe uma categoria com esse nome.' : 'Não consegui salvar: ' + error.message); return }
    setEditandoId(null); carregar()
  }
  async function alternar(c: Categoria) {
    const { error } = await supabase.from('servicos_categorias').update({ ativo: !c.ativo }).eq('id', c.id)
    if (error) { alert('Não consegui alterar: ' + error.message); return }
    carregar()
  }
  async function apagar(c: Categoria) {
    const n = uso[c.id] || 0
    if (!confirm(n ? `A categoria "${c.nome}" está em ${n} serviço(s). Se apagar, esses serviços ficam sem categoria. Apagar mesmo?` : `Apagar a categoria "${c.nome}"?`)) return
    const { error } = await supabase.from('servicos_categorias').delete().eq('id', c.id)
    if (error) { alert('Não consegui apagar: ' + error.message); return }
    carregar()
  }

  const ordenadas = [...categorias].sort((a, b) => (Number(b.ativo) - Number(a.ativo)) || ((uso[b.id] || 0) > 0 ? 1 : 0) - ((uso[a.id] || 0) > 0 ? 1 : 0) || a.nome.localeCompare(b.nome))
  const iconBtn: React.CSSProperties = { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, padding: '2px 4px', color: 'var(--text2)' }
  return (
    <div className="card" style={card}>
      <div style={titulo}>Categorias de serviços</div>
      <p style={ajuda}>Organizam os serviços e ajudam a Elen a entender o que cada um é. A categoria de cada serviço se escolhe em <Link href="/admin/servicos" style={{ color: '#4a90d9' }}>Serviços</Link>.</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input className="campo" value={nova} onChange={e => setNova(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') criar() }} style={{ flex: 1, width: 'auto' }} placeholder="Nova categoria (ex: Pilates)" />
        <button onClick={criar} disabled={!nova.trim()} className="btn btn-primary btn-sm">+ Adicionar</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 8 }}>
        {ordenadas.map(c => {
          const n = uso[c.id] || 0
          return (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, padding: '8px 10px', borderRadius: 8, background: 'var(--bg)', border: `1px solid ${n ? 'var(--border2, var(--border))' : 'var(--border)'}`, opacity: c.ativo ? 1 : 0.45 }}>
              {editandoId === c.id ? (
                <>
                  <input className="campo" autoFocus value={editNome} onChange={e => setEditNome(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') salvar(c.id); if (e.key === 'Escape') setEditandoId(null) }} style={{ flex: 1, width: 'auto' }} />
                  <button onClick={() => salvar(c.id)} style={iconBtn} title="Salvar">✅</button>
                  <button onClick={() => setEditandoId(null)} style={iconBtn} title="Cancelar">✕</button>
                </>
              ) : (
                <>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</div>
                    <div style={{ fontSize: 10, color: n ? '#3fb950' : 'var(--text3)' }}>{!c.ativo ? 'desativada' : n ? `${n} serviço${n > 1 ? 's' : ''}` : 'sem serviço'}</div>
                  </div>
                  <div style={{ display: 'flex', flexShrink: 0 }}>
                    <button onClick={() => { setEditandoId(c.id); setEditNome(c.nome) }} style={iconBtn} title="Renomear">✏️</button>
                    <button onClick={() => alternar(c)} style={iconBtn} title={c.ativo ? 'Desativar' : 'Ativar'}>{c.ativo ? '⏸️' : '▶️'}</button>
                    <button onClick={() => apagar(c)} style={iconBtn} title="Apagar">🗑️</button>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
      {!categorias.length && <p style={{ fontSize: 12, color: 'var(--text3)' }}>Nenhuma categoria ainda.</p>}
      <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 10 }}>✏️ renomear · ⏸️ desativar (some da lista de escolha, quem já usa continua) · 🗑️ apagar</p>
    </div>
  )
}

function Limpeza() {
  const [contagens, setContagens] = useState<{ notificacoesLidas: number; conversasAntigas: number } | null>(null)
  const [dias, setDias] = useState(60)
  const [carregando, setCarregando] = useState(false)
  const [mensagem, setMensagem] = useState<string | null>(null)

  function corte() {
    const d = new Date()
    d.setDate(d.getDate() - dias)
    return d.toISOString()
  }
  async function carregarContagens() {
    setCarregando(true)
    const [notifs, conversas] = await Promise.all([
      supabase.from('notificacoes').select('id', { count: 'exact', head: true }).eq('lida', true),
      supabase.from('bot_historico_conversas').select('id', { count: 'exact', head: true }).lt('created_at', corte()),
    ])
    setContagens({ notificacoesLidas: notifs.count || 0, conversasAntigas: conversas.count || 0 })
    setCarregando(false)
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { carregarContagens() }, [dias])

  async function limparNotificacoesLidas() {
    if (!confirm('Apagar todas as notificações já lidas do sininho? Isso não pode ser desfeito.')) return
    setCarregando(true); setMensagem(null)
    const { error } = await supabase.from('notificacoes').delete().eq('lida', true)
    setMensagem(error ? `Erro: ${error.message}` : '✅ Notificações lidas apagadas.')
    await carregarContagens()
  }
  async function limparConversasAntigas() {
    if (!confirm(`Apagar o histórico de conversas da Elen com mais de ${dias} dias? Isso não pode ser desfeito.`)) return
    setCarregando(true); setMensagem(null)
    const { error } = await supabase.from('bot_historico_conversas').delete().lt('created_at', corte())
    setMensagem(error ? `Erro: ${error.message}` : '✅ Histórico antigo de conversas apagado.')
    await carregarContagens()
  }

  return (
    <>
      <p style={{ ...ajuda, marginBottom: 12 }}>Apaga só histórico e notificações já vistas. Não mexe em alunos, planos, agendamentos ou pagamentos.</p>
      {mensagem && <div className="card" style={{ ...card, padding: 12, fontSize: 13, color: mensagem.startsWith('✅') ? 'var(--text)' : 'var(--danger)' }}>{mensagem}</div>}
      <div className="card" style={card}>
        <div style={titulo}>Notificações já lidas</div>
        <p style={ajuda}>Notificações do sininho que você já viu.{contagens && <> Atualmente: <strong>{contagens.notificacoesLidas}</strong> pra apagar.</>}</p>
        <button onClick={limparNotificacoesLidas} disabled={carregando} className="btn btn-outline-danger btn-sm">Limpar notificações lidas</button>
      </div>
      <div className="card" style={card}>
        <div style={titulo}>Histórico de conversas da Elen</div>
        <p style={ajuda}>
          Mensagens antigas trocadas com a Elen. As recentes continuam guardadas — a Elen usa elas pra lembrar o contexto.
          {contagens && <> Atualmente: <strong>{contagens.conversasAntigas}</strong> mensagens com mais de {dias} dias.</>}
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--text2)' }}>Apagar mensagens com mais de</span>
          <input className="campo" type="number" value={dias} min={7} onChange={e => setDias(Math.max(7, Number(e.target.value) || 60))} style={{ width: 70 }} />
          <span style={{ fontSize: 13, color: 'var(--text2)' }}>dias</span>
        </div>
        <button onClick={limparConversasAntigas} disabled={carregando} className="btn btn-outline-danger btn-sm">Limpar histórico antigo</button>
      </div>
    </>
  )
}

function NumerosBloqueados() {
  const [lista, setLista] = useState<string[]>([])
  const [existe, setExiste] = useState(false)
  const [novo, setNovo] = useState('')
  useEffect(() => { lerConfig('numeros_bloqueados').then(r => { setExiste(r.existe); setLista(r.valor.split(',').map(x => x.trim()).filter(Boolean)) }) }, [])
  async function gravar(nova: string[]) {
    const { error } = await gravarConfig('numeros_bloqueados', nova.join(','), existe)
    if (error) { alert('Não consegui salvar: ' + error.message); return }
    setExiste(true); setLista(nova)
  }
  function adicionar() {
    let d = novo.replace(/\D/g, '')
    if (d.length === 10 || d.length === 11) d = '55' + d
    if (d.length < 10) { alert('Número incompleto. Coloque com DDD, ex: 21 99999-8888'); return }
    if (lista.includes(d)) { setNovo(''); return }
    gravar([...lista, d]); setNovo('')
  }
  function remover(n: string) {
    if (!confirm(`Desbloquear ${fmt(n)}? A Elen volta a responder esse número.`)) return
    gravar(lista.filter(x => x !== n))
  }
  function fmt(n: string) {
    const d = n.replace(/^55/, '')
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
    return n
  }
  return (
    <div className="card" style={card}>
      <div style={titulo}>Números bloqueados</div>
      <p style={ajuda}>A Elen ignora mensagens desses números (robôs de operadora, propaganda, golpes).</p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {lista.map(n => (
          <span key={n} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 6px 5px 10px', borderRadius: 999, background: 'var(--bg)', border: '1px solid var(--border)', fontSize: 12 }}>
            🚫 {fmt(n)}
            <button onClick={() => remover(n)} title="Desbloquear" className="btn btn-ghost btn-sm">✕</button>
          </span>
        ))}
        {!lista.length && <span style={{ fontSize: 12, color: 'var(--text3)' }}>Nenhum número bloqueado.</span>}
      </div>
      <div style={{ display: 'flex', gap: 8, maxWidth: 420 }}>
        <input className="campo" value={novo} onChange={e => setNovo(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') adicionar() }} placeholder="Ex: 21 99999-8888" style={{ flex: 1, width: 'auto' }} />
        <button onClick={adicionar} disabled={!novo.trim()} className="btn btn-primary btn-sm">+ Bloquear</button>
      </div>
    </div>
  )
}

function ConfiguracoesContent() {
  const [aba, setAba] = useState('pagamentos')
  useEffect(() => {
    const ler = () => { const h = window.location.hash.slice(1); if (SECOES.some(s => s.id === h)) setAba(h) }
    ler()
    window.addEventListener('hashchange', ler)
    return () => window.removeEventListener('hashchange', ler)
  }, [])
  function escolher(id: string) {
    setAba(id)
    history.replaceState(null, '', `#${id}`)
  }
  const atual = SECOES.find(s => s.id === aba)!
  return (
    <div>
      <style>{`
        .cfg-wrap { display: grid; grid-template-columns: 210px 1fr; gap: 20px; align-items: start; }
        .cfg-nav { display: flex; flex-direction: column; gap: 4px; position: sticky; top: 70px; }
        .cfg-tab { text-align: left; background: transparent; border: 1px solid transparent; border-radius: 8px; padding: 9px 12px; cursor: pointer; color: var(--text2); font-family: inherit; }
        .cfg-tab:hover { background: var(--card); }
        .cfg-tab.ativo { background: var(--card); border-color: var(--border); color: var(--text); }
        .cfg-tab small { display: block; font-size: 10px; color: var(--text3); margin-top: 2px; }
        @media (max-width: 760px) {
          .cfg-wrap { grid-template-columns: 1fr; gap: 12px; }
          .cfg-nav { flex-direction: row; overflow-x: auto; position: static; padding-bottom: 4px; }
          .cfg-tab { white-space: nowrap; padding: 7px 12px; }
          .cfg-tab small { display: none; }
        }
      `}</style>
      <Cabecalho
        titulo="Configurações"
        subtitulo={<>
          Ajustes gerais do sistema e da Elen.
        </>}
      />
      <div className="cfg-wrap">
        <nav className="cfg-nav">
          {SECOES.map(s => (
            <button key={s.id} onClick={() => escolher(s.id)} className={`cfg-tab${aba === s.id ? ' ativo' : ''}`}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{s.label}</span>
              <small>{s.desc}</small>
            </button>
          ))}
        </nav>
        <div>
          <h2 style={{ fontSize: 13, color: 'var(--text2)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>{atual.label}</h2>
          {aba === 'pagamentos' && (
            <>
              <CampoConfig chave="chave_pix_padrao" rotulo="Chave Pix padrão"
                descricao="Usada quando um plano ou serviço não tem chave Pix própria. A Elen manda essa chave e informa o valor pro aluno digitar."
                placeholder="Ex: (21) 98103-7108" />
              <CampoConfig chave="chave_pix_desconto" rotulo="Chave Pix de desconto"
                descricao="Sem valor travado, usada só quando o aluno tem desconto. A Elen manda essa chave e informa o valor já com desconto."
                placeholder="Ex: (21) 98103-7108 ou um copia-e-cola sem valor" />
              <p style={ajuda}>A chave Pix e o link de cartão de cada plano ficam em <Link href="/admin/planos" style={{ color: '#4a90d9' }}>Planos</Link>; os de cada serviço, em <Link href="/admin/servicos" style={{ color: '#4a90d9' }}>Serviços</Link>.</p>
            </>
          )}
          {aba === 'contrato' && <ModeloContrato />}
          {aba === 'categorias' && <CategoriasServicos />}
          {aba === 'elen' && <NumerosBloqueados />}
          {aba === 'limpeza' && <Limpeza />}
        </div>
      </div>
    </div>
  )
}

export default function ConfiguracoesPage() {
  return <Suspense><ConfiguracoesContent /></Suspense>
}
