'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseAdmin'
import { Cabecalho } from '@/components/ui/Cabecalho'
import { useAbaDaUrl } from '@/components/ui/useAbaDaUrl'
import { CHAVE_SITE, PADRAO, lerConteudo, type SiteConteudo, type Etapa } from '@/lib/siteConteudo'

// Personalização do site público (02/10/2026): textos, fotos e cores da página inicial.
// Salva tudo numa linha da tabela `configuracoes` (chave 'site_publico'). Nada de tabela nova.
// Fotos vão pra pasta pública de imagens que os Posts já usam (post-images/site/...).

type Aba = 'topo' | 'sobre' | 'metodo' | 'avaliacao' | 'secoes' | 'rodape' | 'cores'
const ABAS: { id: Aba; label: string }[] = [
  { id: 'topo', label: '🏠 Topo' },
  { id: 'sobre', label: '👤 Sobre' },
  { id: 'metodo', label: '🧭 Método' },
  { id: 'avaliacao', label: '📏 Avaliação' },
  { id: 'secoes', label: '📄 Outras seções' },
  { id: 'rodape', label: '📍 Contato e rodapé' },
  { id: 'cores', label: '🎨 Cores' },
]
const SUPA_PUBLICO = 'https://tgpestsfhjrdahtzwodk.supabase.co/storage/v1/object/public/post-images/'

export default function SitePage() {
  const [c, setC] = useState<SiteConteudo | null>(null)
  const [existe, setExiste] = useState(false)
  const [salvo, setSalvo] = useState('')
  const [aba, setAba] = useState<Aba>('topo')
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState('')

  useAbaDaUrl(ABAS.map(a => a.id), setAba)
  function escolherAba(a: Aba) { setAba(a); history.replaceState(null, '', `#${a}`) }

  useEffect(() => {
    supabase.from('configuracoes').select('valor').eq('chave', CHAVE_SITE).maybeSingle().then(({ data }) => {
      const valor = (data as { valor: string | null } | null)?.valor
      const conteudo = lerConteudo(valor)
      setC(conteudo); setExiste(!!data); setSalvo(JSON.stringify(conteudo))
    })
  }, [])

  // Atualiza um pedaço do conteúdo: mudar('topo', { titulo: 'x' })
  function mudar<K extends keyof SiteConteudo>(secao: K, valor: Partial<SiteConteudo[K]> | SiteConteudo[K]) {
    setC(prev => prev && ({ ...prev, [secao]: Array.isArray(valor) ? valor : { ...(prev[secao] as object), ...(valor as object) } }))
  }

  async function salvar() {
    if (!c) return
    setSalvando(true)
    const corpo = { valor: JSON.stringify(c), atualizado_em: new Date().toISOString() }
    const { error } = existe
      ? await supabase.from('configuracoes').update(corpo).eq('chave', CHAVE_SITE)
      : await supabase.from('configuracoes').insert({ chave: CHAVE_SITE, ...corpo })
    setSalvando(false)
    if (error) { alert('Não consegui salvar: ' + error.message); return }
    setExiste(true); setSalvo(JSON.stringify(c))
    setAviso('✅ Salvo — já está no site'); setTimeout(() => setAviso(''), 3000)
  }

  function restaurar() {
    if (!confirm('Voltar TODOS os textos, fotos e cores pro que era antes? (Só vale depois de clicar em Salvar.)')) return
    setC(PADRAO)
  }

  if (!c) return <p className="vazio">Carregando...</p>
  const mudou = JSON.stringify(c) !== salvo

  return (
    <div>
      <Cabecalho
        titulo="Personalização do site"
        subtitulo="Mude textos, fotos e cores da página do estúdio sem mexer em código. Edite, clique em Salvar e confira no site."
        acoes={<>
          {aviso && <span className="etiqueta" style={{ color: '#3fb950' }}>{aviso}</span>}
          {mudou && !aviso && <span className="etiqueta" style={{ color: '#e0a020' }}>Alterações não salvas</span>}
          <a href="/" target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">Ver site ↗</a>
          <button onClick={salvar} disabled={salvando || !mudou} className="btn btn-primary">{salvando ? 'Salvando...' : 'Salvar'}</button>
        </>}
      />

      <div className="abas">
        {ABAS.map(a => (
          <button key={a.id} onClick={() => escolherAba(a.id)} className={`aba${aba === a.id ? ' ativa' : ''}`}>{a.label}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 12, maxWidth: 760 }}>
        {aba === 'topo' && <>
          <Cartao titulo="Foto de fundo do topo">
            <Foto valor={c.topo.imagemFundo} onChange={v => mudar('topo', { imagemFundo: v })} largura={320} />
          </Cartao>
          <Cartao titulo="Textos do topo">
            <Campo rotulo="Linha pequena acima do título" valor={c.topo.local} onChange={v => mudar('topo', { local: v })} />
            <Campo rotulo="Título" valor={c.topo.titulo} onChange={v => mudar('topo', { titulo: v })} />
            <Campo rotulo="Texto" valor={c.topo.subtitulo} onChange={v => mudar('topo', { subtitulo: v })} linhas={3} />
            <Duas>
              <Campo rotulo="Botão principal" valor={c.topo.botao1} onChange={v => mudar('topo', { botao1: v })} />
              <Campo rotulo="Segundo botão" valor={c.topo.botao2} onChange={v => mudar('topo', { botao2: v })} />
            </Duas>
          </Cartao>
          <Cartao titulo="Os 3 números em destaque (logo abaixo do topo)">
            {c.destaques.map((d, i) => (
              <Duas key={i}>
                <Campo rotulo={`Número ${i + 1}`} valor={d.numero} onChange={v => mudar('destaques', c.destaques.map((x, j) => j === i ? { ...x, numero: v } : x))} />
                <Campo rotulo="Texto" valor={d.texto} onChange={v => mudar('destaques', c.destaques.map((x, j) => j === i ? { ...x, texto: v } : x))} />
              </Duas>
            ))}
          </Cartao>
        </>}

        {aba === 'sobre' && <>
          <Cartao titulo="Foto principal">
            <Foto valor={c.sobre.foto} onChange={v => mudar('sobre', { foto: v })} largura={180} />
            <Campo rotulo="Legenda em cima da foto" valor={c.sobre.legendaFoto} onChange={v => mudar('sobre', { legendaFoto: v })} />
          </Cartao>
          <Cartao titulo="Texto">
            <Campo rotulo="Linha pequena acima do nome" valor={c.sobre.etiqueta} onChange={v => mudar('sobre', { etiqueta: v })} />
            <Campo rotulo="Nome / título" valor={c.sobre.nome} onChange={v => mudar('sobre', { nome: v })} />
            <Campo rotulo="Texto (deixe uma linha em branco entre os parágrafos)" valor={c.sobre.paragrafos.join('\n\n')}
              onChange={v => mudar('sobre', { paragrafos: v.split(/\n\s*\n/) })} linhas={14} />
            <Campo rotulo="Botão" valor={c.sobre.botao} onChange={v => mudar('sobre', { botao: v })} />
          </Cartao>
          <Cartao titulo="Galeria de fotos">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
              {c.sobre.galeria.map((src, i) => (
                <div key={i}>
                  <Foto valor={src} onChange={v => mudar('sobre', { galeria: c.sobre.galeria.map((x, j) => j === i ? v : x) })} largura={140}
                    onRemover={() => mudar('sobre', { galeria: c.sobre.galeria.filter((_, j) => j !== i) })} />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10 }}>
              <EnviarFoto rotulo="+ Adicionar foto à galeria" onEnviada={url => mudar('sobre', { galeria: [...c.sobre.galeria, url] })} />
            </div>
          </Cartao>
        </>}

        {aba === 'metodo' && <>
          <Cartao titulo="Método MFCT">
            <Campo rotulo="Linha pequena acima do título" valor={c.metodo.etiqueta} onChange={v => mudar('metodo', { etiqueta: v })} />
            <Campo rotulo="Título" valor={c.metodo.titulo} onChange={v => mudar('metodo', { titulo: v })} />
            <Campo rotulo="Texto" valor={c.metodo.texto} onChange={v => mudar('metodo', { texto: v })} linhas={5} />
          </Cartao>
          <ListaItens titulo="Etapas do método" itens={c.metodo.etapas} numerar onChange={l => mudar('metodo', { etapas: l })} />
        </>}

        {aba === 'avaliacao' && <>
          <Cartao titulo="Avaliação física">
            <Campo rotulo="Linha pequena acima do título" valor={c.avaliacao.etiqueta} onChange={v => mudar('avaliacao', { etiqueta: v })} />
            <Campo rotulo="Título" valor={c.avaliacao.titulo} onChange={v => mudar('avaliacao', { titulo: v })} />
            <Campo rotulo="Texto" valor={c.avaliacao.texto} onChange={v => mudar('avaliacao', { texto: v })} linhas={4} />
          </Cartao>
          <ListaItens titulo="Equipamentos" itens={c.avaliacao.ferramentas} onChange={l => mudar('avaliacao', { ferramentas: l })} />
        </>}

        {aba === 'secoes' && <>
          <Cartao titulo="Chamada da aula experimental">
            <Campo rotulo="Título" valor={c.experimental.titulo} onChange={v => mudar('experimental', { titulo: v })} />
            <Campo rotulo="Texto" valor={c.experimental.texto} onChange={v => mudar('experimental', { texto: v })} linhas={3} />
            <Campo rotulo="Botão" valor={c.experimental.botao} onChange={v => mudar('experimental', { botao: v })} />
          </Cartao>
          <Cartao titulo="Planos">
            <Campo rotulo="Título" valor={c.planos.titulo} onChange={v => mudar('planos', { titulo: v })} />
            <Campo rotulo="Texto" valor={c.planos.texto} onChange={v => mudar('planos', { texto: v })} />
            <p className="ajuda">Os planos e preços que aparecem vêm sozinhos da tela Planos.</p>
          </Cartao>
          <Cartao titulo="Horários">
            <Campo rotulo="Título" valor={c.horarios.titulo} onChange={v => mudar('horarios', { titulo: v })} />
            <Campo rotulo="Texto" valor={c.horarios.texto} onChange={v => mudar('horarios', { texto: v })} />
            <p className="ajuda">Os horários que aparecem vêm sozinhos da Agenda.</p>
          </Cartao>
        </>}

        {aba === 'rodape' && <>
          <Cartao titulo="Onde estamos">
            <Campo rotulo="Título" valor={c.local.titulo} onChange={v => mudar('local', { titulo: v })} />
            <Campo rotulo="Endereço" valor={c.local.endereco} onChange={v => mudar('local', { endereco: v })} />
            <Campo rotulo="Botão" valor={c.local.botao} onChange={v => mudar('local', { botao: v })} />
          </Cartao>
          <Cartao titulo="Rodapé">
            <Campo rotulo="Frase embaixo do logo" valor={c.rodape.frase} onChange={v => mudar('rodape', { frase: v })} />
            <Campo rotulo="Instagram (sem @)" valor={c.rodape.instagram} onChange={v => mudar('rodape', { instagram: v.replace(/^@/, '') })} />
            <Campo rotulo="Última linha" valor={c.rodape.linhaFinal} onChange={v => mudar('rodape', { linhaFinal: v })} />
          </Cartao>
        </>}

        {aba === 'cores' && (
          <Cartao titulo="Cores do site">
            <Cor rotulo="Cor de destaque (números, detalhes)" valor={c.cores.destaque} onChange={v => mudar('cores', { destaque: v })} padrao={PADRAO.cores.destaque} />
            <Cor rotulo="Cor dos botões e chamadas" valor={c.cores.botao} onChange={v => mudar('cores', { botao: v })} padrao={PADRAO.cores.botao} />
            <p className="ajuda">Muda só o site público. O admin continua com as cores dele.</p>
          </Cartao>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
          <button onClick={salvar} disabled={salvando || !mudou} className="btn btn-primary">{salvando ? 'Salvando...' : 'Salvar'}</button>
          <button onClick={restaurar} className="btn btn-ghost">Voltar tudo ao original</button>
        </div>
      </div>
    </div>
  )
}

// ---------- pedaços da tela ----------

function Cartao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <div className="secao-titulo">{titulo}</div>
      <div style={{ display: 'grid', gap: 12 }}>{children}</div>
    </div>
  )
}

function Duas({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>{children}</div>
}

function Campo({ rotulo, valor, onChange, linhas }: { rotulo: string; valor: string; onChange: (v: string) => void; linhas?: number }) {
  return (
    <div>
      <label className="rotulo">{rotulo}</label>
      {linhas
        ? <textarea className="campo" rows={linhas} value={valor} onChange={e => onChange(e.target.value)} />
        : <input className="campo" value={valor} onChange={e => onChange(e.target.value)} />}
    </div>
  )
}

function Cor({ rotulo, valor, onChange, padrao }: { rotulo: string; valor: string; onChange: (v: string) => void; padrao: string }) {
  return (
    <div>
      <label className="rotulo">{rotulo}</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(valor) ? valor : padrao} onChange={e => onChange(e.target.value)}
          style={{ width: 48, height: 38, padding: 2, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', cursor: 'pointer' }} />
        <input value={valor} onChange={e => onChange(e.target.value)} style={{ width: 120 }} />
        <button onClick={() => onChange(padrao)} className="btn btn-ghost btn-sm">Original</button>
      </div>
    </div>
  )
}

async function enviarArquivo(file: File): Promise<string | null> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const caminho = `site/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from('post-images').upload(caminho, file)
  if (error) { alert('Não consegui enviar a foto: ' + error.message); return null }
  return SUPA_PUBLICO + caminho
}

function EnviarFoto({ rotulo, onEnviada }: { rotulo: string; onEnviada: (url: string) => void }) {
  const [enviando, setEnviando] = useState(false)
  return (
    <label className="btn btn-ghost btn-sm" style={{ cursor: enviando ? 'wait' : 'pointer' }}>
      {enviando ? 'Enviando...' : rotulo}
      <input type="file" accept="image/*" style={{ display: 'none' }} disabled={enviando} onChange={async e => {
        const f = e.target.files?.[0]; e.target.value = ''
        if (!f) return
        setEnviando(true)
        const url = await enviarArquivo(f)
        setEnviando(false)
        if (url) onEnviada(url)
      }} />
    </label>
  )
}

function Foto({ valor, onChange, largura, onRemover }: { valor: string; onChange: (v: string) => void; largura: number; onRemover?: () => void }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={valor} alt="" style={{ width: largura, maxWidth: '100%', aspectRatio: largura > 200 ? '16/9' : '3/4', objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <EnviarFoto rotulo="Trocar foto" onEnviada={onChange} />
        {onRemover && <button onClick={onRemover} className="btn btn-outline-danger btn-sm">Tirar</button>}
      </div>
    </div>
  )
}

function ListaItens({ titulo, itens, onChange, numerar }: { titulo: string; itens: Etapa[]; onChange: (l: Etapa[]) => void; numerar?: boolean }) {
  const mudarItem = (i: number, campo: keyof Etapa, v: string) => onChange(itens.map((x, j) => j === i ? { ...x, [campo]: v } : x))
  return (
    <Cartao titulo={titulo}>
      {itens.map((it, i) => (
        <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 12, background: 'var(--bg)', display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <b style={{ fontSize: 13 }}>{numerar ? String(i + 1).padStart(2, '0') : `Item ${i + 1}`}</b>
            <button onClick={() => onChange(itens.filter((_, j) => j !== i))} className="btn btn-outline-danger btn-sm">Tirar</button>
          </div>
          <Campo rotulo="Título" valor={it.titulo} onChange={v => mudarItem(i, 'titulo', v)} />
          <Campo rotulo="Texto" valor={it.texto} onChange={v => mudarItem(i, 'texto', v)} linhas={2} />
        </div>
      ))}
      <div><button onClick={() => onChange([...itens, { titulo: 'Novo item', texto: '' }])} className="btn btn-ghost btn-sm">+ Adicionar</button></div>
    </Cartao>
  )
}
