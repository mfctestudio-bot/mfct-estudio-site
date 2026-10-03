'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseAdmin'
import { Cabecalho } from '@/components/ui/Cabecalho'

// Lista de serviços (02/10/2026): cada serviço é uma linha fechada que leva pra página dele
// (/admin/servicos/<id>), onde ficam Dados, Pagamento e Agenda. Nada expande aqui.

type Servico = {
  id: string; nome: string; valor: number; quantidade_usos: number; tem_agenda: boolean; ativo: boolean
  chave_pix: string | null; link_cartao: string | null; valor_atualizado_em: string; pix_atualizado_em: string | null
  categoria_id: string | null; agenda_tipo_id: string | null
}
type Categoria = { id: string; nome: string; ativo: boolean }

const brl = (v: number) => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',')

function pixDesatualizado(s: Servico) {
  if (!s.chave_pix) return false
  if (!s.pix_atualizado_em) return true
  return new Date(s.valor_atualizado_em).getTime() > new Date(s.pix_atualizado_em).getTime()
}

export default function ServicosPage() {
  const router = useRouter()
  const [servicos, setServicos] = useState<Servico[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [nome, setNome] = useState('')
  const [valor, setValor] = useState('')
  const [usos, setUsos] = useState('1')
  const [categoriaId, setCategoriaId] = useState('')

  useEffect(() => {
    // Link antigo "/admin/servicos#<id>" → página do serviço
    const doLink = window.location.hash.slice(1)
    if (/^[0-9a-f-]{36}$/.test(doLink)) { router.replace(`/admin/servicos/${doLink}`); return }
    Promise.all([
      supabase.from('servicos').select('*').order('nome'),
      supabase.from('servicos_categorias').select('*').order('nome'),
    ]).then(([{ data }, { data: cats }]) => {
      setServicos((data as Servico[]) || [])
      setCategorias((cats as Categoria[]) || [])
      setLoading(false)
    })
  }, [router])

  async function criar() {
    if (!nome.trim() || !valor) return
    setSalvando(true)
    const { data, error } = await supabase.from('servicos').insert({
      nome: nome.trim(),
      valor: Number(valor),
      quantidade_usos: Number(usos) || 1,
      tem_agenda: false,
      ativo: true,
      categoria_id: categoriaId || null,
      agenda_tipo_id: null,
    }).select('id').single()
    setSalvando(false)
    if (error || !data) { alert('Não consegui criar o serviço: ' + (error?.message || '')); return }
    router.push(`/admin/servicos/${(data as { id: string }).id}`)
  }

  const nomeCategoria = (id: string | null) => categorias.find(c => c.id === id)?.nome

  return (
    <div>
      <Cabecalho
        titulo="Serviços"
        subtitulo="Os serviços que o estúdio oferece (aula avulsa, avaliação, personal...). Clique num serviço pra mudar preço, Pix, cartão e agenda dele."
        acoes={!mostrarForm && <button onClick={() => setMostrarForm(true)} className="btn btn-primary">+ Novo serviço</button>}
      />

      {mostrarForm && (
        <div className="card" style={{ padding: '18px 20px', marginBottom: 16, maxWidth: 720 }}>
          <div className="secao-titulo">Novo serviço</div>
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <label className="rotulo">Nome</label>
              <input className="campo" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Massagem, Pacote 5 Avaliações..." autoFocus />
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 140px' }}>
                <label className="rotulo">Valor (R$)</label>
                <input className="campo" type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} placeholder="Ex: 50.00" />
              </div>
              <div style={{ flex: '1 1 140px' }}>
                <label className="rotulo">Quantidade de usos</label>
                <input className="campo" type="number" min={1} value={usos} onChange={e => setUsos(e.target.value)} />
              </div>
              <div style={{ flex: '2 1 200px' }}>
                <label className="rotulo">Categoria</label>
                <select className="campo" value={categoriaId} onChange={e => setCategoriaId(e.target.value)}>
                  <option value="">Sem categoria</option>
                  {categorias.filter(c => c.ativo).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            </div>
            <p className="ajuda">Depois de criar, abre a página do serviço pra você cadastrar Pix, cartão e agenda.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button onClick={criar} disabled={salvando || !nome.trim() || !valor} className="btn btn-primary">{salvando ? 'Criando...' : 'Criar serviço'}</button>
            <button onClick={() => setMostrarForm(false)} disabled={salvando} className="btn btn-neutral">Cancelar</button>
          </div>
        </div>
      )}

      {loading ? <p className="vazio">Carregando...</p> : !servicos.length ? (
        <p className="vazio">Nenhum serviço cadastrado ainda.</p>
      ) : (
        <div className="lista">
          {servicos.map(s => (
            <Link key={s.id} href={`/admin/servicos/${s.id}`} className="card card-hover item-lista"
              style={{ opacity: s.ativo ? 1 : 0.6, borderColor: s.ativo ? undefined : 'var(--danger)' }}>
              <div>
                <div className="item-titulo">{s.nome}</div>
                <div className="item-sub">
                  {brl(s.valor)} · {s.quantidade_usos}x uso{s.quantidade_usos > 1 ? 's' : ''}
                  {' · '}{s.tem_agenda ? (s.agenda_tipo_id ? 'agenda igual à do estúdio' : 'horários próprios') : 'sem agenda'}
                </div>
              </div>
              <div className="item-acoes">
                {nomeCategoria(s.categoria_id) && <span className="etiqueta">🏷️ {nomeCategoria(s.categoria_id)}</span>}
                {!s.chave_pix && <span className="etiqueta" style={{ color: '#e0a020' }}>Pix padrão</span>}
                {pixDesatualizado(s) && <span className="etiqueta" style={{ color: '#e0a020' }}>⚠️ preço mudou depois do Pix</span>}
                {!s.ativo && <span className="etiqueta" style={{ color: 'var(--danger)' }}>Desativado</span>}
                <span style={{ color: 'var(--text3)', fontSize: 16 }}>›</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
