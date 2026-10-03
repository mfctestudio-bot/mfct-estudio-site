'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseAdmin'
import { Cabecalho } from '@/components/ui/Cabecalho'

// Lista de planos (02/10/2026): cada plano é uma linha fechada que leva pra página dele
// (/admin/planos/<id>), com Dados, Pagamento e Descontos. Nada expande aqui.

type Plano = {
  id: string; nome: string; vezes_semana: number; valor: number; ativo: boolean
  chave_pix: string | null; valor_atualizado_em: string; pix_atualizado_em: string | null
}
type Desconto = { plano_id: string; ativo: boolean }

const brl = (v: number) => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',')

function pixDesatualizado(p: Plano) {
  if (!p.chave_pix) return false
  if (!p.pix_atualizado_em) return true
  return new Date(p.valor_atualizado_em).getTime() > new Date(p.pix_atualizado_em).getTime()
}

export default function PlanosPage() {
  const router = useRouter()
  const [planos, setPlanos] = useState<Plano[]>([])
  const [descontos, setDescontos] = useState<Desconto[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [nome, setNome] = useState('')
  const [vezes, setVezes] = useState('3')
  const [valor, setValor] = useState('')

  useEffect(() => {
    // Link antigo "/admin/planos#<id>" → página do plano
    const doLink = window.location.hash.slice(1)
    if (/^[0-9a-f-]{36}$/.test(doLink)) { router.replace(`/admin/planos/${doLink}`); return }
    Promise.all([
      supabase.from('planos').select('*').order('valor'),
      supabase.from('descontos_planos').select('plano_id, ativo'),
    ]).then(([{ data }, { data: desc }]) => {
      setPlanos((data as Plano[]) || [])
      setDescontos((desc as Desconto[]) || [])
      setLoading(false)
    })
  }, [router])

  async function criar() {
    if (!nome.trim() || !valor) return
    setSalvando(true)
    const { data, error } = await supabase.from('planos').insert({
      nome: nome.trim(), vezes_semana: Number(vezes) || 1, valor: Number(valor), ativo: true,
    }).select('id').single()
    setSalvando(false)
    if (error || !data) { alert('Não consegui criar o plano: ' + (error?.message || '')); return }
    router.push(`/admin/planos/${(data as { id: string }).id}`)
  }

  return (
    <div>
      <Cabecalho
        titulo="Planos"
        subtitulo={<>Os planos mensais do estúdio. Clique num plano pra mudar valor, Pix, cartão e descontos. A chave Pix padrão fica em <Link href="/admin/configuracoes#pagamentos">Configurações</Link>.</>}
        acoes={!mostrarForm && <button onClick={() => setMostrarForm(true)} className="btn btn-primary">+ Novo plano</button>}
      />

      {mostrarForm && (
        <div className="card" style={{ padding: '18px 20px', marginBottom: 16, maxWidth: 720 }}>
          <div className="secao-titulo">Novo plano</div>
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <label className="rotulo">Nome</label>
              <input className="campo" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Plano 5x semana" autoFocus />
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 140px' }}>
                <label className="rotulo">Vezes por semana</label>
                <input className="campo" type="number" min={1} value={vezes} onChange={e => setVezes(e.target.value)} />
              </div>
              <div style={{ flex: '1 1 140px' }}>
                <label className="rotulo">Valor mensal (R$)</label>
                <input className="campo" type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} placeholder="Ex: 199.90" />
              </div>
            </div>
            <p className="ajuda">Depois de criar, abre a página do plano pra você cadastrar Pix, cartão e descontos.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button onClick={criar} disabled={salvando || !nome.trim() || !valor} className="btn btn-primary">{salvando ? 'Criando...' : 'Criar plano'}</button>
            <button onClick={() => setMostrarForm(false)} disabled={salvando} className="btn btn-neutral">Cancelar</button>
          </div>
        </div>
      )}

      {loading ? <p className="vazio">Carregando...</p> : !planos.length ? (
        <p className="vazio">Nenhum plano cadastrado ainda.</p>
      ) : (
        <div className="lista">
          {planos.map(p => {
            const nDesc = descontos.filter(d => d.plano_id === p.id && d.ativo).length
            return (
              <Link key={p.id} href={`/admin/planos/${p.id}`} className="card card-hover item-lista"
                style={{ opacity: p.ativo ? 1 : 0.6, borderColor: p.ativo ? undefined : 'var(--danger)' }}>
                <div>
                  <div className="item-titulo">{p.nome}</div>
                  <div className="item-sub">{p.vezes_semana}x por semana · {brl(p.valor)}/mês</div>
                </div>
                <div className="item-acoes">
                  {nDesc > 0 && <span className="etiqueta">🏷️ {nDesc} desconto{nDesc > 1 ? 's' : ''}</span>}
                  {!p.chave_pix && <span className="etiqueta" style={{ color: '#e0a020' }}>Pix padrão</span>}
                  {pixDesatualizado(p) && <span className="etiqueta" style={{ color: '#e0a020' }}>⚠️ preço mudou depois do Pix</span>}
                  {!p.ativo && <span className="etiqueta" style={{ color: 'var(--danger)' }}>Desativado</span>}
                  <span style={{ color: 'var(--text3)', fontSize: 16 }}>›</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
