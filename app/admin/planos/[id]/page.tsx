'use client'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseAdmin'
import { Cabecalho } from '@/components/ui/Cabecalho'
import { Segmento } from '@/components/ui/Segmento'
import { useAbaDaUrl } from '@/components/ui/useAbaDaUrl'

// Página própria de cada plano (02/10/2026, pedido do Matheus): abas Dados, Pagamento e Descontos.
// Grava exatamente o mesmo que a edição antiga na lista gravava.

type Plano = {
  id: string; nome: string; vezes_semana: number; valor: number; ativo: boolean
  chave_pix: string | null; chave_pix_valor_fixo: boolean; link_cartao: string | null; link_cartao_valor_fixo: boolean
  valor_atualizado_em: string; pix_atualizado_em: string | null
}
type Desconto = { id: string; plano_id: string; nome: string; motivo: string; valor: number; ativo: boolean }
type Aba = 'dados' | 'pagamento' | 'descontos'

const brl = (v: number) => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',')

export default function PlanoPage() {
  const { id } = useParams<{ id: string }>()
  const [p, setP] = useState<Plano | null>(null)
  const [naoAchou, setNaoAchou] = useState(false)
  const [descontos, setDescontos] = useState<Desconto[]>([])
  const [aba, setAba] = useState<Aba>('dados')
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState('')

  const [nome, setNome] = useState('')
  const [vezes, setVezes] = useState('3')
  const [valor, setValor] = useState('')
  const [chavePix, setChavePix] = useState('')
  const [chaveFixa, setChaveFixa] = useState(true)
  const [linkCartao, setLinkCartao] = useState('')
  const [linkFixo, setLinkFixo] = useState(true)
  const [novoDescNome, setNovoDescNome] = useState('')
  const [novoDescValor, setNovoDescValor] = useState('')

  useAbaDaUrl(['dados', 'pagamento', 'descontos'] as const, setAba)
  function escolherAba(a: Aba) { setAba(a); history.replaceState(null, '', `#${a}`) }

  const carregar = useCallback(async () => {
    const [{ data }, { data: desc }] = await Promise.all([
      supabase.from('planos').select('*').eq('id', id).maybeSingle(),
      supabase.from('descontos_planos').select('*').eq('plano_id', id).order('valor', { ascending: false }),
    ])
    if (!data) { setNaoAchou(true); return }
    const x = data as Plano
    setP(x)
    setNome(x.nome); setVezes(String(x.vezes_semana)); setValor(String(x.valor))
    setChavePix(x.chave_pix || ''); setChaveFixa(x.chave_pix_valor_fixo)
    setLinkCartao(x.link_cartao || ''); setLinkFixo(x.link_cartao_valor_fixo)
    setDescontos((desc as Desconto[]) || [])
  }, [id])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar() }, [carregar])

  function mostrarAviso(t: string) { setAviso(t); setTimeout(() => setAviso(''), 2500) }

  async function salvar() {
    if (!p) return
    setSalvando(true)
    const corpo: Record<string, unknown> = {
      nome: nome.trim(), vezes_semana: Number(vezes) || 1, valor: Number(valor),
      chave_pix_valor_fixo: chaveFixa,
      link_cartao_valor_fixo: linkFixo,
    }
    // Só marca a chave Pix como "atualizada agora" se o texto dela realmente mudou.
    if (chavePix.trim() !== (p.chave_pix || '')) corpo.chave_pix = chavePix.trim() || null
    corpo.link_cartao = linkCartao.trim() || null
    const { error } = await supabase.from('planos').update(corpo).eq('id', p.id)
    setSalvando(false)
    if (error) { alert('Não consegui salvar: ' + error.message); return }
    mostrarAviso('✅ Salvo')
    carregar()
  }

  async function alternarAtivo() {
    if (!p) return
    await supabase.from('planos').update({ ativo: !p.ativo }).eq('id', p.id)
    carregar()
  }

  async function criarDesconto() {
    if (!p || !novoDescNome.trim() || !novoDescValor) return
    await supabase.from('descontos_planos').insert({
      plano_id: p.id, nome: novoDescNome.trim(), motivo: novoDescNome.trim().toLowerCase(), valor: Number(novoDescValor), ativo: true,
    })
    setNovoDescNome(''); setNovoDescValor('')
    carregar()
  }

  async function alternarDesconto(d: Desconto) {
    await supabase.from('descontos_planos').update({ ativo: !d.ativo }).eq('id', d.id)
    carregar()
  }

  async function apagarDesconto(idDesc: string) {
    if (!confirm('Apagar esse desconto? A Elen não vai mais poder oferecer ele.')) return
    await supabase.from('descontos_planos').delete().eq('id', idDesc)
    carregar()
  }

  if (naoAchou) return <p className="vazio">Plano não encontrado. <Link href="/admin/planos">Voltar pra Planos</Link></p>
  if (!p) return <p className="vazio">Carregando...</p>

  const pixAntigo = !!p.chave_pix && (!p.pix_atualizado_em || new Date(p.valor_atualizado_em).getTime() > new Date(p.pix_atualizado_em).getTime())
  const ABAS: { id: Aba; label: string }[] = [
    { id: 'dados', label: '📋 Dados' },
    { id: 'pagamento', label: '💳 Pagamento' },
    { id: 'descontos', label: `🏷️ Descontos (${descontos.filter(d => d.ativo).length})` },
  ]

  return (
    <div>
      <Cabecalho
        voltar={{ href: '/admin/planos', label: 'Planos' }}
        titulo={p.nome}
        subtitulo={<>{p.vezes_semana}x por semana · {brl(p.valor)} por mês. Mudar aqui não mexe em quem já tem o plano — só vale daqui pra frente.</>}
        acoes={<>
          {aviso && <span className="etiqueta" style={{ color: '#3fb950' }}>{aviso}</span>}
          <span className="etiqueta" style={{ color: p.ativo ? '#3fb950' : 'var(--danger)' }}>{p.ativo ? 'Ativo' : 'Desativado'}</span>
          <button onClick={alternarAtivo} className={`btn btn-sm ${p.ativo ? 'btn-ghost' : 'btn-outline-success'}`}>{p.ativo ? 'Desativar' : 'Ativar'}</button>
        </>}
      />

      <div className="abas">
        {ABAS.map(a => (
          <button key={a.id} onClick={() => escolherAba(a.id)} className={`aba${aba === a.id ? ' ativa' : ''}`}>{a.label}</button>
        ))}
      </div>

      {aba === 'dados' && (
        <div className="card" style={{ padding: '18px 20px', maxWidth: 720 }}>
          <div className="secao-titulo">Dados do plano</div>
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <label className="rotulo">Nome</label>
              <input className="campo" value={nome} onChange={e => setNome(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 160px' }}>
                <label className="rotulo">Vezes por semana</label>
                <input className="campo" type="number" min={1} value={vezes} onChange={e => setVezes(e.target.value)} />
              </div>
              <div style={{ flex: '1 1 160px' }}>
                <label className="rotulo">Valor mensal (R$)</label>
                <input className="campo" type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} />
              </div>
            </div>
          </div>
          <div style={{ marginTop: 18 }}>
            <button onClick={salvar} disabled={salvando || !nome.trim() || !valor} className="btn btn-primary">{salvando ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </div>
      )}

      {aba === 'pagamento' && (
        <div style={{ display: 'grid', gap: 12, maxWidth: 720 }}>
          {pixAntigo && <div className="aviso aviso-atencao">⚠️ O preço mudou depois que a chave Pix foi cadastrada. Confira se o Pix ainda está com o valor certo.</div>}
          <div className="card" style={{ padding: '18px 20px' }}>
            <div className="secao-titulo">🔑 Pagamento via Pix</div>
            <textarea className="campo" value={chavePix} onChange={e => setChavePix(e.target.value)} style={{ minHeight: 70, marginBottom: 10 }}
              placeholder="Cole aqui o código Pix copia-e-cola, ou uma chave Pix simples (já com o valor certo desse plano)" />
            <Segmento value={chaveFixa} onChange={setChaveFixa} trueLabel="Valor fixo (só copia e cola)" falseLabel="Chave aberta (aluno digita)" />
            <p className="ajuda" style={{ marginTop: 8 }}>Sem chave aqui, a Elen usa a chave Pix padrão de <Link href="/admin/configuracoes#pagamentos">Configurações</Link>.</p>
          </div>
          <div className="card" style={{ padding: '18px 20px' }}>
            <div className="secao-titulo">💳 Pagamento no cartão</div>
            <input className="campo" value={linkCartao} onChange={e => setLinkCartao(e.target.value)} style={{ marginBottom: 10 }}
              placeholder="Cole aqui o link de pagamento no cartão deste plano" />
            <Segmento value={linkFixo} onChange={setLinkFixo} trueLabel="Valor fixo (só clica e paga)" falseLabel="Link aberto (aluno digita)" />
          </div>
          <div><button onClick={salvar} disabled={salvando} className="btn btn-primary">{salvando ? 'Salvando...' : 'Salvar'}</button></div>
        </div>
      )}

      {aba === 'descontos' && (
        <div className="card" style={{ padding: '18px 20px', maxWidth: 720 }}>
          <div className="secao-titulo">Descontos que a Elen pode oferecer</div>
          <p className="ajuda" style={{ marginBottom: 12 }}>A Elen só oferece os descontos que estiverem aqui — ela nunca inventa um valor.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
            {descontos.map(d => (
              <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 10px', borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)', opacity: d.ativo ? 1 : 0.5 }}>
                <span style={{ fontSize: 13 }}><b>{d.nome}</b> — {brl(d.valor)} de desconto{!d.ativo && ' (desativado)'}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => alternarDesconto(d)} className="btn btn-ghost btn-sm">{d.ativo ? 'Desativar' : 'Ativar'}</button>
                  <button onClick={() => apagarDesconto(d.id)} className="btn btn-outline-danger btn-sm">Apagar</button>
                </div>
              </div>
            ))}
            {!descontos.length && <p className="ajuda">Nenhum desconto ainda pra esse plano.</p>}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '2 1 200px' }}>
              <label className="rotulo">Motivo do desconto</label>
              <input className="campo" value={novoDescNome} onChange={e => setNovoDescNome(e.target.value)} placeholder="Ex: Falta de dinheiro" />
            </div>
            <div style={{ flex: '1 1 110px' }}>
              <label className="rotulo">Valor (R$)</label>
              <input className="campo" type="number" step="0.01" value={novoDescValor} onChange={e => setNovoDescValor(e.target.value)} />
            </div>
            <button onClick={criarDesconto} disabled={!novoDescNome.trim() || !novoDescValor} className="btn btn-primary">+ Adicionar desconto</button>
          </div>
        </div>
      )}
    </div>
  )
}
