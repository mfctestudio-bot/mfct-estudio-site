'use client'
import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseAdmin'
import { CAMPOS_CONTRATO, MODELO_CONTRATO_PADRAO } from '@/lib/contrato'

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6,
  padding: '9px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
}
const card: React.CSSProperties = { padding: '16px 18px', marginBottom: 14 }
const titulo: React.CSSProperties = { fontWeight: 700, fontSize: 14, marginBottom: 4 }
const ajuda: React.CSSProperties = { fontSize: 12, color: 'var(--text3)', marginBottom: 10 }

const SECOES = [
  { id: 'pagamentos', label: '💳 Pagamentos' },
  { id: 'contrato', label: '📄 Contrato' },
  { id: 'categorias', label: '🏷️ Categorias de serviços' },
  { id: 'elen', label: '🤖 Elen' },
  { id: 'atalhos', label: '🔗 Outros ajustes' },
  { id: 'limpeza', label: '🧹 Limpeza' },
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
          ? <textarea value={valor} onChange={e => setValor(e.target.value)} placeholder={placeholder} style={{ ...inputStyle, flex: '1 1 260px', minHeight: 70, resize: 'vertical' }} />
          : <input value={valor} onChange={e => setValor(e.target.value)} placeholder={placeholder} style={{ ...inputStyle, flex: '1 1 260px', width: 'auto' }} />}
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
  useEffect(() => { lerConfig('modelo_contrato').then(r => { setExiste(r.existe); setModelo(r.valor || MODELO_CONTRATO_PADRAO); setSalvo(r.valor) }) }, [])
  async function salvar() {
    setSalvando(true)
    const { error } = await gravarConfig('modelo_contrato', modelo, existe)
    setSalvando(false)
    if (error) { alert('Não consegui salvar o modelo: ' + error.message); return }
    setExiste(true); setSalvo(modelo)
  }
  return (
    <div className="card" style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <div style={titulo}>Modelo do contrato + termo de responsabilidade</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => { if (confirm('Voltar o texto para o modelo padrão? O que você editou e não salvou se perde.')) setModelo(MODELO_CONTRATO_PADRAO) }} className="btn btn-ghost btn-sm">Restaurar padrão</button>
          <button onClick={salvar} disabled={salvando || modelo === salvo} className="btn btn-primary btn-sm">{salvando ? 'Salvando...' : 'Salvar modelo'}</button>
        </div>
      </div>
      <p style={ajuda}>
        Pra gerar o contrato de um aluno, vá em <Link href="/admin/contratos" style={{ color: '#4a90d9' }}>Contratos</Link> (ou no cadastro do aluno).
      </p>
      {!existe && <p style={{ fontSize: 12, color: '#e0a020', marginBottom: 8 }}>Esse é o modelo padrão sugerido — revise os trechos marcados com [AJUSTAR] e clique em Salvar modelo.</p>}
      <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>
        Campos automáticos: {CAMPOS_CONTRATO.map(c => <code key={c.chave} title={c.descricao} style={{ marginRight: 6 }}>{`{{${c.chave}}}`}</code>)}
        · Pra começar uma folha nova na impressão, deixe uma linha com <code>==== QUEBRA DE PÁGINA ====</code>.
      </p>
      <textarea value={modelo} onChange={e => setModelo(e.target.value)} style={{ ...inputStyle, minHeight: 420, fontFamily: 'ui-monospace, monospace', fontSize: 12, lineHeight: 1.5 }} />
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

  return (
    <div className="card" style={card}>
      <div style={titulo}>Categorias de serviços</div>
      <p style={ajuda}>Organizam os serviços e ajudam a Elen a entender o que cada um é. Desativada some da lista de escolha, mas quem já usa continua com ela. A categoria de cada serviço se escolhe em <Link href="/admin/servicos" style={{ color: '#4a90d9' }}>Serviços</Link>.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        {categorias.map(c => (
          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6, background: 'var(--bg)', opacity: c.ativo ? 1 : 0.5, flexWrap: 'wrap' }}>
            {editandoId === c.id
              ? <input value={editNome} onChange={e => setEditNome(e.target.value)} style={{ ...inputStyle, flex: '1 1 160px', width: 'auto' }} />
              : <span style={{ fontSize: 13 }}>{c.nome}<span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 6 }}>{uso[c.id] ? `${uso[c.id]} serviço${uso[c.id] > 1 ? 's' : ''}` : 'sem serviço'}{!c.ativo && ' · desativada'}</span></span>}
            <div style={{ display: 'flex', gap: 6 }}>
              {editandoId === c.id ? (
                <>
                  <button onClick={() => salvar(c.id)} className="btn btn-primary btn-sm">Salvar</button>
                  <button onClick={() => setEditandoId(null)} className="btn btn-neutral btn-sm">Cancelar</button>
                </>
              ) : (
                <>
                  <button onClick={() => { setEditandoId(c.id); setEditNome(c.nome) }} className="btn btn-ghost btn-sm">✏️</button>
                  <button onClick={() => alternar(c)} className="btn btn-ghost btn-sm">{c.ativo ? 'Desativar' : 'Ativar'}</button>
                  <button onClick={() => apagar(c)} className="btn btn-outline-danger btn-sm">Apagar</button>
                </>
              )}
            </div>
          </div>
        ))}
        {!categorias.length && <p style={{ fontSize: 12, color: 'var(--text3)' }}>Nenhuma categoria ainda.</p>}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={nova} onChange={e => setNova(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') criar() }} style={{ ...inputStyle, flex: 1, width: 'auto' }} placeholder="Nova categoria (ex: Pilates)" />
        <button onClick={criar} disabled={!nova.trim()} className="btn btn-primary btn-sm">+ Add</button>
      </div>
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
          <input type="number" value={dias} min={7} onChange={e => setDias(Math.max(7, Number(e.target.value) || 60))} style={{ ...inputStyle, width: 70 }} />
          <span style={{ fontSize: 13, color: 'var(--text2)' }}>dias</span>
        </div>
        <button onClick={limparConversasAntigas} disabled={carregando} className="btn btn-outline-danger btn-sm">Limpar histórico antigo</button>
      </div>
    </>
  )
}

function Secao({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ scrollMarginTop: 70, marginBottom: 26 }}>
      <h2 style={{ fontSize: 13, color: 'var(--text2)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>{label}</h2>
      {children}
    </section>
  )
}

function ConfiguracoesContent() {
  return (
    <div>
      <h1 style={{ fontSize: 26, marginBottom: 4 }}>Configurações</h1>
      <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}>Todos os ajustes gerais do sistema e da Elen num lugar só.</p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 22 }}>
        {SECOES.map(s => <a key={s.id} href={`#${s.id}`} className="btn btn-ghost btn-sm">{s.label}</a>)}
      </div>

      <Secao id="pagamentos" label="💳 Pagamentos">
        <CampoConfig chave="chave_pix_padrao" rotulo="Chave Pix padrão"
          descricao="Usada quando um plano ou serviço não tem chave Pix própria. A Elen manda essa chave e informa o valor pro aluno digitar."
          placeholder="Ex: (21) 98103-7108" />
        <CampoConfig chave="chave_pix_desconto" rotulo="Chave Pix de desconto"
          descricao="Chave sem valor travado, usada só quando o aluno tem desconto. A Elen manda essa chave e informa o valor já com desconto."
          placeholder="Ex: (21) 98103-7108 ou um copia-e-cola sem valor" />
        <p style={ajuda}>A chave Pix e o link de cartão de cada plano ficam no próprio plano, em <Link href="/admin/planos" style={{ color: '#4a90d9' }}>Planos</Link>. Os de cada serviço, em <Link href="/admin/servicos" style={{ color: '#4a90d9' }}>Serviços</Link>.</p>
      </Secao>

      <Secao id="contrato" label="📄 Contrato">
        <ModeloContrato />
      </Secao>

      <Secao id="categorias" label="🏷️ Categorias de serviços">
        <CategoriasServicos />
      </Secao>

      <Secao id="elen" label="🤖 Elen (WhatsApp)">
        <CampoConfig chave="numeros_bloqueados" rotulo="Números bloqueados"
          descricao="A Elen ignora mensagens desses números (robôs de operadora, propaganda etc.). Coloque com DDI e DDD, só números, separados por vírgula. Ex: 5521999998888"
          placeholder="5521999998888, 5511988887777" multilinha
          normalizar={v => v.split(/[,;\s]+/).map(n => n.replace(/\D/g, '')).filter(Boolean).join(',')} />
      </Secao>

      <Secao id="atalhos" label="🔗 Outros ajustes">
        <div className="card" style={{ ...card, display: 'grid', gap: 8, fontSize: 13 }}>
          <Link href="/admin/servicos" style={{ color: 'var(--text)' }}>🧾 Serviços, valores e Pix de cada serviço → <span style={{ color: 'var(--text3)' }}>em Serviços</span></Link>
          <Link href="/admin/planos" style={{ color: 'var(--text)' }}>💰 Planos, valores e descontos → <span style={{ color: 'var(--text3)' }}>em Planos</span></Link>
          <Link href="/admin/professores" style={{ color: 'var(--text)' }}>🗓️ Horários e vagas da agenda → <span style={{ color: 'var(--text3)' }}>em Professores</span></Link>
        </div>
      </Secao>

      <Secao id="limpeza" label="🧹 Limpeza de dados antigos">
        <Limpeza />
      </Secao>
    </div>
  )
}

export default function ConfiguracoesPage() {
  return <Suspense><ConfiguracoesContent /></Suspense>
}
