'use client'
import { useEffect, useMemo, useState, Suspense } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseAdmin'
import { Cabecalho } from '@/components/ui/Cabecalho'

// Arrecadação por categoria e por serviço.
// Usa as MESMAS regras de entrada dos Relatórios (pra os totais baterem):
//  - Mensalidades: pagamentos com status 'pago' (valor - desconto, pela data_pagamento) → agrupadas por plano
//  - Aula avulsa: créditos avulsos confirmados e não cancelados (pela confirmado_em)
//  - Serviços: vendas_servicos (pela data_venda) → agrupadas pela categoria do serviço

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const CORES = ['#4a90d9', '#3fb950', '#e0a020', '#e05656', '#a371f7', '#2fb5b5', '#d96aa7', '#8b949e', '#c9803a', '#6e8bd9', '#7cbf4a', '#b5552f']
const CAT_PLANOS = 'Planos (mensalidades)'

type Lanc = { data: string; nome: string; metodo: string; valor: number }
type Item = { nome: string; total: number; qtd: number; lancs: Lanc[] }
type Grupo = { categoria: string; total: number; qtd: number; itens: Item[] }

const brl = (v: number) => 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pad = (n: number) => String(n).padStart(2, '0')
const dataBR = (iso: string) => { const d = new Date(new Date(iso).getTime() - 3 * 3600 * 1000); return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}` }
const um = <T,>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? x[0] ?? null : x ?? null)
const nomeMetodo = (m: string | null) => {
  const v = (m || '').toLowerCase()
  if (v === 'pix') return 'Pix'
  if (['cartao', 'cartão', 'credito', 'debito'].includes(v)) return 'Cartão'
  if (v === 'dinheiro') return 'Dinheiro'
  return 'Não informado'
}

function limites(ano: number, mes: number | null) {
  if (mes == null) return { ini: `${ano}-01-01T00:00:00-03:00`, prox: `${ano + 1}-01-01T00:00:00-03:00` }
  return { ini: `${ano}-${pad(mes)}-01T00:00:00-03:00`, prox: mes === 12 ? `${ano + 1}-01-01T00:00:00-03:00` : `${ano}-${pad(mes + 1)}-01T00:00:00-03:00` }
}

async function buscar(ini: string, prox: string): Promise<Grupo[]> {
  const [{ data: pags }, { data: avs }, { data: vendas }, { data: servs }] = await Promise.all([
    supabase.from('pagamentos').select('valor, desconto, data_pagamento, metodo_pagamento, alunos(nome), planos(nome)')
      .eq('status', 'pago').gte('data_pagamento', ini).lt('data_pagamento', prox),
    supabase.from('creditos_avulsos').select('valor, confirmado_em, metodo_pagamento, status, alunos(nome)')
      .not('confirmado_em', 'is', null).neq('status', 'cancelado').gte('confirmado_em', ini).lt('confirmado_em', prox),
    supabase.from('vendas_servicos').select('servico_id, servico_nome, cliente_nome, valor, data_venda, metodo_pagamento, alunos(nome)')
      .gte('data_venda', ini).lt('data_venda', prox),
    supabase.from('servicos').select('id, nome, servicos_categorias(nome)'),
  ])
  const catDoServico = new Map<string, string>()
  let avulsa = { categoria: 'Aula avulsa', nome: 'Aula Avulsa' }
  for (const s of (servs as unknown as { id: string; nome: string; servicos_categorias: unknown }[]) || []) {
    const cat = (um(s.servicos_categorias as { nome: string } | { nome: string }[]))?.nome || 'Sem categoria'
    catDoServico.set(s.id, cat)
    if (cat.toLowerCase().includes('avulsa') || s.nome.toLowerCase().includes('avulsa')) avulsa = { categoria: cat, nome: s.nome }
  }

  const mapa = new Map<string, Map<string, Item>>()
  const add = (cat: string, item: string, l: Lanc) => {
    if (!mapa.has(cat)) mapa.set(cat, new Map())
    const m = mapa.get(cat)!
    if (!m.has(item)) m.set(item, { nome: item, total: 0, qtd: 0, lancs: [] })
    const it = m.get(item)!
    it.total += l.valor; it.qtd++; it.lancs.push(l)
  }
  const nomeAluno = (a: unknown, fb = 'Aluno') => (um(a as { nome: string } | { nome: string }[]))?.nome || fb

  for (const p of (pags as unknown as { valor: number; desconto: number | null; data_pagamento: string; metodo_pagamento: string | null; alunos: unknown; planos: unknown }[]) || []) {
    const plano = (um(p.planos as { nome: string } | { nome: string }[]))?.nome || 'Plano não informado'
    add(CAT_PLANOS, plano, { data: p.data_pagamento, nome: nomeAluno(p.alunos), metodo: nomeMetodo(p.metodo_pagamento), valor: Number(p.valor) - Number(p.desconto || 0) })
  }
  for (const c of (avs as unknown as { valor: number; confirmado_em: string; metodo_pagamento: string | null; alunos: unknown }[]) || []) {
    add(avulsa.categoria, avulsa.nome, { data: c.confirmado_em, nome: nomeAluno(c.alunos), metodo: nomeMetodo(c.metodo_pagamento), valor: Number(c.valor) || 0 })
  }
  for (const v of (vendas as unknown as { servico_id: string | null; servico_nome: string; cliente_nome: string | null; valor: number; data_venda: string; metodo_pagamento: string | null; alunos: unknown }[]) || []) {
    const cat = (v.servico_id && catDoServico.get(v.servico_id)) || 'Sem categoria'
    add(cat, v.servico_nome || 'Serviço', { data: v.data_venda, nome: v.alunos ? nomeAluno(v.alunos) : (v.cliente_nome || 'Cliente'), metodo: nomeMetodo(v.metodo_pagamento), valor: Number(v.valor) || 0 })
  }

  const grupos: Grupo[] = [...mapa.entries()].map(([categoria, itens]) => {
    const lista = [...itens.values()].sort((a, b) => b.total - a.total)
    for (const it of lista) it.lancs.sort((a, b) => b.data.localeCompare(a.data))
    return { categoria, itens: lista, total: lista.reduce((t, i) => t + i.total, 0), qtd: lista.reduce((t, i) => t + i.qtd, 0) }
  })
  return grupos.sort((a, b) => b.total - a.total)
}

function ArrecadacaoContent() {
  const hoje = new Date()
  const [ano, setAno] = useState(hoje.getFullYear())
  const [mes, setMes] = useState<number | null>(hoje.getMonth() + 1) // null = ano inteiro
  const [grupos, setGrupos] = useState<Grupo[] | null>(null)
  const [anteriores, setAnteriores] = useState<Record<string, number>>({})
  const [aberto, setAberto] = useState<Record<string, boolean>>({})
  const [detalhe, setDetalhe] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      setGrupos(null)
      const { ini, prox } = limites(ano, mes)
      const ant = mes == null ? limites(ano - 1, null) : (mes === 1 ? limites(ano - 1, 12) : limites(ano, mes - 1))
      const [atual, anterior] = await Promise.all([buscar(ini, prox), buscar(ant.ini, ant.prox)])
      if (!vivo) return
      setGrupos(atual)
      setAnteriores(Object.fromEntries(anterior.map(g => [g.categoria, g.total])))
    })()
    return () => { vivo = false }
  }, [ano, mes])

  const total = useMemo(() => (grupos || []).reduce((t, g) => t + g.total, 0), [grupos])
  const totalAnterior = useMemo(() => Object.values(anteriores).reduce((t, v) => t + v, 0), [anteriores])
  const qtd = useMemo(() => (grupos || []).reduce((t, g) => t + g.qtd, 0), [grupos])
  const cor = (i: number) => CORES[i % CORES.length]
  const rotuloPeriodo = mes == null ? `${ano}` : `${MESES[mes - 1]} de ${ano}`
  const rotuloAnterior = mes == null ? `${ano - 1}` : 'mês anterior'

  function variacao(atual: number, antes: number | undefined) {
    if (!antes) return atual > 0 ? <span style={{ fontSize: 11, color: 'var(--text3)' }}>novo</span> : null
    const p = ((atual - antes) / antes) * 100
    const c = p > 0.5 ? '#3fb950' : p < -0.5 ? 'var(--danger)' : 'var(--text3)'
    return <span style={{ fontSize: 11, color: c }}>{p > 0 ? '▲' : p < 0 ? '▼' : '='} {Math.abs(p).toFixed(0)}% vs {rotuloAnterior}</span>
  }


  return (
    <div>
      <Cabecalho
        titulo="Arrecadação por serviço"
        subtitulo={<>Quanto entrou em cada categoria e em cada serviço. Mesmas regras dos <Link href="/admin/relatorios">Relatórios</Link>.</>}
        acoes={<>
              <select value={mes ?? 0} onChange={e => setMes(Number(e.target.value) || null)}>
                <option value={0}>Ano inteiro</option>
                {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
              <select value={ano} onChange={e => setAno(Number(e.target.value))}>
                {[hoje.getFullYear() - 1, hoje.getFullYear(), hoje.getFullYear() + 1].map(a => <option key={a} value={a}>{a}</option>)}
              </select>
        </>}
      />

      {grupos == null ? <p className="vazio">Carregando...</p> : (
        <>
          <div className="card" style={{ padding: '16px 18px', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1 }}>Total arrecadado · {rotuloPeriodo}</div>
                <div style={{ fontSize: 30, fontWeight: 700, fontFamily: 'Anton, sans-serif', color: '#3fb950' }}>{brl(total)}</div>
                <div style={{ marginTop: 2 }}>{variacao(total, totalAnterior)}</div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text2)' }}>
                <div><b style={{ color: 'var(--text)' }}>{qtd}</b> lançamentos</div>
                <div><b style={{ color: 'var(--text)' }}>{grupos.length}</b> categorias</div>
              </div>
            </div>
            {total > 0 && (
              <>
                <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', marginTop: 14, background: 'var(--bg)' }}>
                  {grupos.map((g, i) => <div key={g.categoria} title={`${g.categoria}: ${brl(g.total)}`} style={{ width: `${(g.total / total) * 100}%`, background: cor(i) }} />)}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: 8 }}>
                  {grupos.map((g, i) => (
                    <span key={g.categoria} style={{ fontSize: 11, color: 'var(--text2)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 2, background: cor(i) }} />{g.categoria} {((g.total / total) * 100).toFixed(0)}%
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>

          {!grupos.length && <div className="card" style={{ padding: 18, color: 'var(--text2)', fontSize: 13 }}>Nada arrecadado em {rotuloPeriodo}.</div>}

          <div style={{ display: 'grid', gap: 10 }}>
            {grupos.map((g, i) => {
              const abertoG = aberto[g.categoria] ?? i < 3
              return (
                <div key={g.categoria} className="card" style={{ padding: 0, overflow: 'hidden', borderLeft: `4px solid ${cor(i)}` }}>
                  <button onClick={() => setAberto(a => ({ ...a, [g.categoria]: !abertoG }))}
                    className="btn btn-ghost" style={{ width: '100%', textAlign: 'left' }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{g.categoria}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{g.qtd} lançamento{g.qtd > 1 ? 's' : ''} · {g.itens.length} {g.categoria === CAT_PLANOS ? 'plano' : 'serviço'}{g.itens.length > 1 ? 's' : ''} · {total ? ((g.total / total) * 100).toFixed(1) : 0}% do total</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 17, fontWeight: 700 }}>{brl(g.total)}</div>
                      <div>{variacao(g.total, anteriores[g.categoria])}</div>
                    </div>
                  </button>
                  {abertoG && (
                    <div style={{ borderTop: '1px solid var(--border)' }}>
                      {g.itens.map(it => {
                        const chave = g.categoria + '|' + it.nome
                        return (
                          <div key={chave} style={{ borderBottom: '1px solid var(--border)' }}>
                            <div onClick={() => setDetalhe(detalhe === chave ? null : chave)} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, padding: '10px 16px 10px 22px', cursor: 'pointer' }}>
                              <div>
                                <div style={{ fontSize: 13 }}>{it.nome} <span style={{ fontSize: 11, color: 'var(--text3)' }}>{detalhe === chave ? '▾' : '▸'}</span></div>
                                <div style={{ height: 5, borderRadius: 3, background: 'var(--bg)', marginTop: 5, maxWidth: 320 }}>
                                  <div style={{ height: 5, borderRadius: 3, width: `${g.total ? (it.total / g.total) * 100 : 0}%`, background: cor(i) }} />
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 13, fontWeight: 700 }}>{brl(it.total)}</div>
                                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{it.qtd}× · média {brl(it.total / it.qtd)}</div>
                              </div>
                            </div>
                            {detalhe === chave && (
                              <div style={{ padding: '0 16px 10px 22px' }}>
                                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                                  <tbody>
                                    {it.lancs.map((l, k) => (
                                      <tr key={k} style={{ color: 'var(--text2)' }}>
                                        <td style={{ padding: '4px 0', width: 52 }}>{dataBR(l.data)}</td>
                                        <td style={{ padding: '4px 0', color: 'var(--text)' }}>{l.nome}</td>
                                        <td style={{ padding: '4px 0' }}>{l.metodo}</td>
                                        <td style={{ padding: '4px 0', textAlign: 'right' }}>{brl(l.valor)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export default function ArrecadacaoPage() {
  return <Suspense><ArrecadacaoContent /></Suspense>
}
