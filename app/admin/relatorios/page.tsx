'use client'
import { useEffect, useMemo, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabaseAdmin'

// Relatórios financeiros (01/10/2026).
// Entradas = pagamentos com status 'pago' (valor - desconto, pela data_pagamento)
//          + créditos de aula avulsa confirmados (confirmado_em preenchido e não cancelados)
//          + vendas de serviços registradas (vendas_servicos, pela data_venda).
// Saídas   = despesas lançadas no mês (tabela despesas_mensais).
// "Fechar mês" grava uma foto em fechamentos_mensais; mês fechado mostra a foto, não recalcula.

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

type Entrada = { data: string; nome: string; tipo: 'Mensalidade' | 'Aula avulsa' | 'Serviço'; detalhe?: string; metodo: string; valor: number; vendaId?: string; daAvaliacao?: boolean }
type ServicoOpt = { id: string; nome: string; valor: number }
type AlunoOpt = { id: string; nome: string }
type Despesa = { id: string; mes: string; categoria: string; valor: number; observacao: string | null }
type Fechamento = {
  mes: string
  receita_mensalidades: number
  receita_avulsas: number
  receita_servicos: number
  receita_total: number
  despesas_total: number
  resultado: number
  detalhes: { entradas?: Entrada[]; despesas?: { categoria: string; valor: number; observacao: string | null }[]; porMetodo?: Record<string, number> }
  fechado_em: string
}

const brl = (v: number) => 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pad = (n: number) => String(n).padStart(2, '0')
// Limites do mês no horário de Brasília (-03:00), pra um pagamento às 22h do dia 31 não cair no mês seguinte.
function limitesMes(ano: number, mes: number) {
  const ini = `${ano}-${pad(mes)}-01T00:00:00-03:00`
  const prox = mes === 12 ? `${ano + 1}-01-01T00:00:00-03:00` : `${ano}-${pad(mes + 1)}-01T00:00:00-03:00`
  return { ini, prox }
}
function chaveMesDeData(iso: string) {
  const d = new Date(new Date(iso).getTime() - 3 * 3600 * 1000)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`
}
function dataBR(iso: string) {
  const d = new Date(new Date(iso).getTime() - 3 * 3600 * 1000)
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}`
}
const nomeMetodo = (m: string | null) => {
  const v = (m || '').toLowerCase()
  if (v === 'pix') return 'Pix'
  if (v === 'cartao' || v === 'cartão' || v === 'credito' || v === 'debito') return 'Cartão'
  if (v === 'dinheiro') return 'Dinheiro'
  if (v === 'manual' || !v) return 'Não informado'
  return m || 'Não informado'
}

async function buscarEntradas(iniISO: string, proxISO: string): Promise<Entrada[]> {
  const [{ data: pags }, { data: avs }, { data: vendas }] = await Promise.all([
    supabase.from('pagamentos')
      .select('valor, desconto, data_pagamento, metodo_pagamento, alunos(nome)')
      .eq('status', 'pago').gte('data_pagamento', iniISO).lt('data_pagamento', proxISO),
    supabase.from('creditos_avulsos')
      .select('valor, confirmado_em, metodo_pagamento, status, alunos(nome)')
      .not('confirmado_em', 'is', null).neq('status', 'cancelado').gte('confirmado_em', iniISO).lt('confirmado_em', proxISO),
    supabase.from('vendas_servicos')
      .select('id, servico_nome, cliente_nome, valor, data_venda, metodo_pagamento, observacao, alunos(nome)')
      .gte('data_venda', iniISO).lt('data_venda', proxISO),
  ])
  const nomeDe = (a: unknown) => {
    const o = Array.isArray(a) ? a[0] : a
    return (o as { nome?: string } | null)?.nome || 'Aluno'
  }
  const lista: Entrada[] = []
  for (const p of (pags as { valor: number; desconto: number | null; data_pagamento: string; metodo_pagamento: string | null; alunos: unknown }[]) || []) {
    lista.push({ data: p.data_pagamento, nome: nomeDe(p.alunos), tipo: 'Mensalidade', metodo: nomeMetodo(p.metodo_pagamento), valor: Number(p.valor) - Number(p.desconto || 0) })
  }
  for (const c of (avs as { valor: number; confirmado_em: string; metodo_pagamento: string | null; alunos: unknown }[]) || []) {
    lista.push({ data: c.confirmado_em, nome: nomeDe(c.alunos), tipo: 'Aula avulsa', metodo: nomeMetodo(c.metodo_pagamento), valor: Number(c.valor) || 0 })
  }
  for (const v of (vendas as { id: string; servico_nome: string; cliente_nome: string | null; valor: number; data_venda: string; metodo_pagamento: string | null; observacao: string | null; alunos: unknown }[]) || []) {
    const nomeAluno = v.alunos ? nomeDe(v.alunos) : (v.cliente_nome || 'Cliente')
    lista.push({ data: v.data_venda, nome: nomeAluno, tipo: 'Serviço', detalhe: v.servico_nome, metodo: nomeMetodo(v.metodo_pagamento), valor: Number(v.valor) || 0, vendaId: v.id, daAvaliacao: (v.observacao || '').includes('[avaliacao:') })
  }
  return lista.sort((a, b) => a.data.localeCompare(b.data))
}

function baixarCSV(nome: string, linhas: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = typeof v === 'number' ? v.toFixed(2).replace('.', ',') : String(v ?? '')
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = '﻿' + linhas.map(l => l.map(esc).join(';')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a'); a.href = url; a.download = nome; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6,
  padding: '8px 10px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
}

function Card({ label, value, sub, cor }: { label: string; value: string; sub?: string; cor?: string }) {
  return (
    <div className="card rel-card" style={{ padding: '14px 16px' }}>
      <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</div>
      <div style={{ fontFamily: 'Anton, sans-serif', fontSize: 24, color: cor || 'var(--text)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function Secao({ titulo, children, acao }: { titulo: string; children: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <div className="card rel-secao" style={{ padding: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: 13, color: 'var(--text2)', letterSpacing: '1px', textTransform: 'uppercase', margin: 0 }}>{titulo}</h3>
        {acao}
      </div>
      {children}
    </div>
  )
}

const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, color: 'var(--text2)', fontWeight: 700, padding: '6px 8px', borderBottom: '1px solid var(--border)' }
const td: React.CSSProperties = { fontSize: 13, padding: '7px 8px', borderBottom: '1px solid var(--border)' }
const tdNum: React.CSSProperties = { ...td, textAlign: 'right', whiteSpace: 'nowrap' }

// ======================= MÊS =======================
function RelatorioMes({ ano, mes }: { ano: number; mes: number }) {
  const chave = `${ano}-${pad(mes)}-01`
  const [loading, setLoading] = useState(true)
  const [entradas, setEntradas] = useState<Entrada[]>([])
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [fechamento, setFechamento] = useState<Fechamento | null>(null)
  const [novaCat, setNovaCat] = useState('')
  const [novoValor, setNovoValor] = useState('')
  const [novaObs, setNovaObs] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [servicosOpt, setServicosOpt] = useState<ServicoOpt[]>([])
  const [alunosOpt, setAlunosOpt] = useState<AlunoOpt[]>([])
  const [vServico, setVServico] = useState('')
  const [vAluno, setVAluno] = useState('')
  const [vCliente, setVCliente] = useState('')
  const [vValor, setVValor] = useState('')
  const [vData, setVData] = useState('')
  const [vMetodo, setVMetodo] = useState('pix')
  const [vObs, setVObs] = useState('')
  const [mostrarVenda, setMostrarVenda] = useState(false)

  async function carregar() {
    setLoading(true)
    const { ini, prox } = limitesMes(ano, mes)
    const [lista, { data: desp }, { data: fech }] = await Promise.all([
      buscarEntradas(ini, prox),
      supabase.from('despesas_mensais').select('*').eq('mes', chave).order('created_at'),
      supabase.from('fechamentos_mensais').select('*').eq('mes', chave).maybeSingle(),
    ])
    setEntradas(lista)
    setDespesas(((desp as Despesa[]) || []).map(d => ({ ...d, valor: Number(d.valor) })))
    setFechamento((fech as Fechamento) || null)
    setLoading(false)
  }
  useEffect(() => { carregar() }, [ano, mes])
  useEffect(() => {
    supabase.from('servicos').select('id, nome, valor').eq('ativo', true).order('nome').then(({ data }) => setServicosOpt(((data as ServicoOpt[]) || []).map(x => ({ ...x, valor: Number(x.valor) }))))
    supabase.from('alunos').select('id, nome').not('nome', 'is', null).order('nome').then(({ data }) => setAlunosOpt((data as AlunoOpt[]) || []))
  }, [])

  // Números ao vivo
  const vivo = useMemo(() => {
    const mens = entradas.filter(e => e.tipo === 'Mensalidade').reduce((s, e) => s + e.valor, 0)
    const avul = entradas.filter(e => e.tipo === 'Aula avulsa').reduce((s, e) => s + e.valor, 0)
    const serv = entradas.filter(e => e.tipo === 'Serviço').reduce((s, e) => s + e.valor, 0)
    const porMetodo: Record<string, number> = {}
    for (const e of entradas) porMetodo[e.metodo] = (porMetodo[e.metodo] || 0) + e.valor
    const desp = despesas.reduce((s, d) => s + d.valor, 0)
    return { mens, avul, serv, total: mens + avul + serv, desp, resultado: mens + avul + serv - desp, porMetodo }
  }, [entradas, despesas])

  // Se o mês está fechado, mostra a foto guardada
  const fechado = !!fechamento
  const n = fechado
    ? {
        mens: Number(fechamento!.receita_mensalidades), avul: Number(fechamento!.receita_avulsas), serv: Number(fechamento!.receita_servicos || 0), total: Number(fechamento!.receita_total),
        desp: Number(fechamento!.despesas_total), resultado: Number(fechamento!.resultado), porMetodo: fechamento!.detalhes?.porMetodo || {},
      }
    : vivo
  const listaEntradas = fechado ? (fechamento!.detalhes?.entradas || []) : entradas
  const listaDespesas = fechado ? (fechamento!.detalhes?.despesas || []) : despesas

  const hoje = new Date(Date.now() - 3 * 3600 * 1000)
  const mesAtual = hoje.getUTCFullYear() === ano && hoje.getUTCMonth() + 1 === mes
  const mesFuturo = new Date(Date.UTC(ano, mes - 1, 1)) > hoje
  const diferencaFoto = fechado && Math.abs(vivo.total - n.total) > 0.009

  async function addDespesa() {
    const valor = Number(String(novoValor).replace(',', '.'))
    if (!novaCat.trim() || !(valor >= 0)) return
    setSalvando(true)
    const { error } = await supabase.from('despesas_mensais').insert({ mes: chave, categoria: novaCat.trim(), valor, observacao: novaObs.trim() || null })
    setSalvando(false)
    if (error) { alert('Não consegui salvar a despesa: ' + error.message); return }
    setNovaCat(''); setNovoValor(''); setNovaObs('')
    carregar()
  }

  async function editarValor(d: Despesa, texto: string) {
    const valor = Number(String(texto).replace(',', '.'))
    if (!(valor >= 0) || valor === d.valor) return
    const { error } = await supabase.from('despesas_mensais').update({ valor }).eq('id', d.id)
    if (error) { alert('Não consegui salvar: ' + error.message); return }
    carregar()
  }

  async function removerDespesa(d: Despesa) {
    if (!confirm(`Apagar a despesa "${d.categoria}" deste mês?`)) return
    const { error } = await supabase.from('despesas_mensais').delete().eq('id', d.id)
    if (error) { alert('Não consegui apagar: ' + error.message); return }
    carregar()
  }

  async function puxarModelo() {
    const { data: modelo } = await supabase.from('caixa_config').select('categoria, valor').order('ordem')
    const linhas = ((modelo as { categoria: string; valor: number | null }[]) || []).map(m => ({ mes: chave, categoria: m.categoria, valor: Number(m.valor) || 0 }))
    if (!linhas.length) { alert('Não há categorias no Controle de caixa pra usar de modelo.'); return }
    const { error } = await supabase.from('despesas_mensais').insert(linhas)
    if (error) { alert('Não consegui copiar o modelo: ' + error.message); return }
    carregar()
  }

  async function copiarMesAnterior() {
    const anterior = mes === 1 ? `${ano - 1}-12-01` : `${ano}-${pad(mes - 1)}-01`
    const { data: ant } = await supabase.from('despesas_mensais').select('categoria, valor, observacao').eq('mes', anterior)
    const linhas = ((ant as { categoria: string; valor: number; observacao: string | null }[]) || []).map(d => ({ mes: chave, categoria: d.categoria, valor: Number(d.valor), observacao: d.observacao }))
    if (!linhas.length) { alert('O mês anterior não tem despesas lançadas.'); return }
    const { error } = await supabase.from('despesas_mensais').insert(linhas)
    if (error) { alert('Não consegui copiar: ' + error.message); return }
    carregar()
  }

  async function fecharMes() {
    const aviso = mesAtual
      ? `${MESES[mes - 1]} ainda não acabou. Fechar agora congela os números de hoje — pagamentos que entrarem depois não vão aparecer no fechamento (dá pra reabrir e fechar de novo). Fechar mesmo assim?`
      : `Fechar ${MESES[mes - 1]}/${ano}? Os números ficam congelados como estão agora.`
    if (!confirm(aviso)) return
    const { error } = await supabase.from('fechamentos_mensais').upsert({
      mes: chave,
      receita_mensalidades: vivo.mens, receita_avulsas: vivo.avul, receita_servicos: vivo.serv, receita_total: vivo.total,
      despesas_total: vivo.desp, resultado: vivo.resultado,
      detalhes: { entradas, despesas: despesas.map(d => ({ categoria: d.categoria, valor: d.valor, observacao: d.observacao })), porMetodo: vivo.porMetodo },
      fechado_em: new Date().toISOString(),
    })
    if (error) { alert('Não consegui fechar o mês: ' + error.message); return }
    carregar()
  }

  async function reabrirMes() {
    if (!confirm(`Reabrir ${MESES[mes - 1]}/${ano}? A foto do fechamento é descartada e os números voltam a ser calculados ao vivo.`)) return
    const { error } = await supabase.from('fechamentos_mensais').delete().eq('mes', chave)
    if (error) { alert('Não consegui reabrir: ' + error.message); return }
    carregar()
  }

  function abrirVenda() {
    const padraoData = mesAtual ? new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10) : `${ano}-${pad(mes)}-01`
    setVData(padraoData); setVServico(''); setVAluno(''); setVCliente(''); setVValor(''); setVMetodo('pix'); setVObs('')
    setMostrarVenda(true)
  }

  async function salvarVenda() {
    const srv = servicosOpt.find(x => x.id === vServico)
    const valor = Number(String(vValor).replace(',', '.'))
    if (!srv || !(valor >= 0) || !vData) return
    if (!vAluno && !vCliente.trim()) { alert('Escolha o aluno ou escreva o nome do cliente.'); return }
    setSalvando(true)
    const { error } = await supabase.from('vendas_servicos').insert({
      servico_id: srv.id, servico_nome: srv.nome, aluno_id: vAluno || null, cliente_nome: vAluno ? null : vCliente.trim(),
      valor, data_venda: `${vData}T12:00:00-03:00`, metodo_pagamento: vMetodo, observacao: vObs.trim() || null,
    })
    setSalvando(false)
    if (error) { alert('Não consegui registrar a venda: ' + error.message); return }
    setMostrarVenda(false)
    carregar()
  }

  async function apagarVenda(id: string, nome: string) {
    if (!confirm(`Apagar a venda de serviço de ${nome}?`)) return
    const { error } = await supabase.from('vendas_servicos').delete().eq('id', id)
    if (error) { alert('Não consegui apagar: ' + error.message); return }
    carregar()
  }

  function exportar() {
    const linhas: (string | number)[][] = [
      [`Relatório ${MESES[mes - 1]}/${ano}`, fechado ? `Fechado em ${new Date(fechamento!.fechado_em).toLocaleString('pt-BR')}` : 'Mês aberto'],
      [],
      ['Resumo', 'Valor'],
      ['Mensalidades', n.mens], ['Aulas avulsas', n.avul], ['Serviços', n.serv], ['Total de entradas', n.total], ['Despesas', n.desp], ['Resultado', n.resultado],
      [],
      ['Entradas por forma de pagamento', 'Valor'],
      ...Object.entries(n.porMetodo).map(([k, v]) => [k, v as number]),
      [],
      ['Data', 'Aluno/Cliente', 'Tipo', 'Forma', 'Valor'],
      ...listaEntradas.map(e => [dataBR(e.data), e.nome, e.detalhe ? `${e.tipo}: ${e.detalhe}` : e.tipo, e.metodo, e.valor]),
      [],
      ['Despesa', 'Observação', 'Valor'],
      ...listaDespesas.map(d => [d.categoria, d.observacao || '', d.valor]),
    ]
    baixarCSV(`relatorio-${ano}-${pad(mes)}.csv`, linhas)
  }

  if (loading) return <p style={{ color: 'var(--text2)' }}>Carregando...</p>

  return (
    <div>
      <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        {fechado ? (
          <>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#3fb950', background: '#3fb95018', padding: '6px 10px', borderRadius: 6 }}>
              🔒 Mês fechado em {new Date(fechamento!.fechado_em).toLocaleDateString('pt-BR')}
            </span>
            <button onClick={reabrirMes} className="btn btn-ghost btn-sm">Reabrir mês</button>
          </>
        ) : (
          !mesFuturo && <button onClick={fecharMes} className="btn btn-primary btn-sm">🔒 Fechar mês</button>
        )}
        <button onClick={() => window.print()} className="btn btn-ghost btn-sm">🖨️ Imprimir / Salvar PDF</button>
        <button onClick={exportar} className="btn btn-ghost btn-sm">⬇️ Baixar planilha</button>
      </div>

      {diferencaFoto && (
        <p className="no-print" style={{ fontSize: 12, color: '#e0a020', marginBottom: 12 }}>
          ⚠️ Depois do fechamento entrou ou mudou pagamento neste mês (hoje somaria {brl(vivo.total)}). Se quiser atualizar, reabra e feche de novo.
        </p>
      )}

      <div className="print-only" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>MFCT Estúdio — Relatório de {MESES[mes - 1]}/{ano}</h2>
        <div style={{ fontSize: 12 }}>{fechado ? `Mês fechado em ${new Date(fechamento!.fechado_em).toLocaleDateString('pt-BR')}` : `Mês aberto — gerado em ${new Date().toLocaleDateString('pt-BR')}`}</div>
      </div>

      <div className="rel-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
        <Card label="Mensalidades" value={brl(n.mens)} />
        <Card label="Aulas avulsas" value={brl(n.avul)} />
        <Card label="Serviços" value={brl(n.serv)} />
        <Card label="Total de entradas" value={brl(n.total)} cor="#3fb950" sub={`${listaEntradas.length} pagamento(s)`} />
        <Card label="Despesas" value={brl(n.desp)} cor="var(--danger)" />
        <Card label="Resultado" value={brl(n.resultado)} cor={n.resultado >= 0 ? '#3fb950' : 'var(--danger)'} sub={n.total > 0 ? `${((n.resultado / n.total) * 100).toFixed(0)}% das entradas` : undefined} />
      </div>

      <Secao titulo="Entradas por forma de pagamento">
        {Object.keys(n.porMetodo).length === 0 ? <p style={{ fontSize: 13, color: 'var(--text3)' }}>Nenhuma entrada neste mês.</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {Object.entries(n.porMetodo).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([k, v]) => (
                <tr key={k}><td style={td}>{k}</td><td style={tdNum}>{brl(v as number)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </Secao>

      <Secao
        titulo={`Despesas (${listaDespesas.length})`}
        acao={!fechado && despesas.length === 0 ? (
          <div className="no-print" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={copiarMesAnterior} className="btn btn-ghost btn-sm">Copiar do mês anterior</button>
            <button onClick={puxarModelo} className="btn btn-ghost btn-sm">Usar categorias do Controle de caixa</button>
          </div>
        ) : undefined}
      >
        {listaDespesas.length === 0 && <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 10 }}>Nenhuma despesa lançada neste mês.</p>}
        {listaDespesas.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
            <thead><tr><th style={th}>Despesa</th><th style={th}>Observação</th><th style={{ ...th, textAlign: 'right' }}>Valor</th>{!fechado && <th style={th} className="no-print"></th>}</tr></thead>
            <tbody>
              {fechado
                ? listaDespesas.map((d, i) => (
                    <tr key={i}><td style={td}>{d.categoria}</td><td style={{ ...td, color: 'var(--text2)' }}>{d.observacao || ''}</td><td style={tdNum}>{brl(d.valor)}</td></tr>
                  ))
                : despesas.map(d => (
                    <tr key={d.id}>
                      <td style={td}>{d.categoria}</td>
                      <td style={{ ...td, color: 'var(--text2)' }}>{d.observacao || ''}</td>
                      <td style={tdNum}>
                        <span className="print-only">{brl(d.valor)}</span>
                        <input className="no-print" defaultValue={String(d.valor).replace('.', ',')} onBlur={e => editarValor(d, e.target.value)}
                          style={{ ...inputStyle, width: 100, textAlign: 'right', padding: '5px 8px' }} />
                      </td>
                      <td style={{ ...td, width: 40 }} className="no-print">
                        <button onClick={() => removerDespesa(d)} className="btn btn-outline-danger btn-sm" title="Apagar">✕</button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        )}
        {!fechado && (
          <div className="no-print" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <input value={novaCat} onChange={e => setNovaCat(e.target.value)} placeholder="Despesa (ex: Aluguel)" style={{ ...inputStyle, flex: '2 1 140px' }} />
            <input value={novaObs} onChange={e => setNovaObs(e.target.value)} placeholder="Observação (opcional)" style={{ ...inputStyle, flex: '2 1 140px' }} />
            <input value={novoValor} onChange={e => setNovoValor(e.target.value)} placeholder="Valor" inputMode="decimal" style={{ ...inputStyle, flex: '1 1 80px' }}
              onKeyDown={e => { if (e.key === 'Enter') addDespesa() }} />
            <button onClick={addDespesa} disabled={salvando || !novaCat.trim() || !novoValor} className="btn btn-primary btn-sm">+ Adicionar</button>
          </div>
        )}
      </Secao>

      <Secao
        titulo={`Vendas de serviços (${listaEntradas.filter(e => e.tipo === 'Serviço').length})`}
        acao={!fechado && !mostrarVenda ? <button onClick={abrirVenda} className="btn btn-primary btn-sm no-print">+ Registrar venda</button> : undefined}
      >
        {mostrarVenda && !fechado && (
          <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginBottom: 12, padding: 12, background: 'var(--bg)', borderRadius: 8 }}>
            <select value={vServico} onChange={e => { setVServico(e.target.value); const sv = servicosOpt.find(x => x.id === e.target.value); if (sv) setVValor(String(sv.valor).replace('.', ',')) }} style={inputStyle}>
              <option value="">Serviço...</option>
              {servicosOpt.map(x => <option key={x.id} value={x.id}>{x.nome} — {brl(x.valor)}</option>)}
            </select>
            <select value={vAluno} onChange={e => setVAluno(e.target.value)} style={inputStyle}>
              <option value="">Cliente de fora (não é aluno)</option>
              {alunosOpt.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}
            </select>
            {!vAluno && <input value={vCliente} onChange={e => setVCliente(e.target.value)} placeholder="Nome do cliente" style={inputStyle} />}
            <input value={vValor} onChange={e => setVValor(e.target.value)} placeholder="Valor" inputMode="decimal" style={inputStyle} />
            <input type="date" value={vData} onChange={e => setVData(e.target.value)} style={inputStyle} />
            <select value={vMetodo} onChange={e => setVMetodo(e.target.value)} style={inputStyle}>
              <option value="pix">Pix</option><option value="cartao">Cartão</option><option value="dinheiro">Dinheiro</option>
            </select>
            <input value={vObs} onChange={e => setVObs(e.target.value)} placeholder="Observação (opcional)" style={inputStyle} />
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={salvarVenda} disabled={salvando || !vServico || !vValor || !vData} className="btn btn-primary btn-sm">{salvando ? 'Salvando...' : 'Salvar venda'}</button>
              <button onClick={() => setMostrarVenda(false)} className="btn btn-neutral btn-sm">Cancelar</button>
            </div>
          </div>
        )}
        {listaEntradas.filter(e => e.tipo === 'Serviço').length === 0 ? <p style={{ fontSize: 13, color: 'var(--text3)' }}>Nenhuma venda de serviço neste mês.</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Data</th><th style={th}>Cliente</th><th style={th}>Serviço</th><th style={th}>Forma</th><th style={{ ...th, textAlign: 'right' }}>Valor</th>{!fechado && <th style={th} className="no-print"></th>}</tr></thead>
            <tbody>
              {listaEntradas.filter(e => e.tipo === 'Serviço').map((e, i) => (
                <tr key={i}>
                  <td style={td}>{dataBR(e.data)}</td><td style={td}>{e.nome}</td><td style={td}>{e.detalhe}</td><td style={td}>{e.metodo}</td><td style={tdNum}>{brl(e.valor)}</td>
                  {!fechado && <td style={{ ...td, width: 40 }} className="no-print">{e.daAvaliacao ? <a href="/admin/avaliacoes" title="Venda criada pela avaliação física — altere ou apague lá em Avaliações" style={{ fontSize: 11, color: 'var(--text3)', textDecoration: 'none' }}>📋</a> : e.vendaId && <button onClick={() => apagarVenda(e.vendaId!, e.nome)} className="btn btn-outline-danger btn-sm" title="Apagar">✕</button>}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Secao>

      <Secao titulo={`Pagamentos recebidos (${listaEntradas.length})`}>
        {listaEntradas.length === 0 ? <p style={{ fontSize: 13, color: 'var(--text3)' }}>Nenhum pagamento confirmado neste mês.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Data</th><th style={th}>Aluno</th><th style={th}>Tipo</th><th style={th}>Forma</th><th style={{ ...th, textAlign: 'right' }}>Valor</th></tr></thead>
              <tbody>
                {listaEntradas.map((e, i) => (
                  <tr key={i}>
                    <td style={td}>{dataBR(e.data)}</td><td style={td}>{e.nome}</td><td style={td}>{e.detalhe ? `${e.tipo}: ${e.detalhe}` : e.tipo}</td><td style={td}>{e.metodo}</td><td style={tdNum}>{brl(e.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Secao>
      <p className="no-print" style={{ fontSize: 11, color: 'var(--text3)' }}>
        Entradas = mensalidades confirmadas (pela data do pagamento, já com desconto) + aulas avulsas confirmadas + vendas de serviços registradas aqui.
      </p>
    </div>
  )
}

// ======================= ANO =======================
type LinhaAno = { mes: number; mens: number; avul: number; serv: number; total: number; desp: number; resultado: number; fechado: boolean }

function RelatorioAno({ ano, abrirMes }: { ano: number; abrirMes: (m: number) => void }) {
  const [loading, setLoading] = useState(true)
  const [linhas, setLinhas] = useState<LinhaAno[]>([])
  const [totalAnoAnterior, setTotalAnoAnterior] = useState<number | null>(null)

  async function carregar() {
    setLoading(true)
    const ini = `${ano}-01-01T00:00:00-03:00`
    const prox = `${ano + 1}-01-01T00:00:00-03:00`
    const [entradas, { data: desp }, { data: fechs }, anteriores] = await Promise.all([
      buscarEntradas(ini, prox),
      supabase.from('despesas_mensais').select('mes, valor').gte('mes', `${ano}-01-01`).lt('mes', `${ano + 1}-01-01`),
      supabase.from('fechamentos_mensais').select('*').gte('mes', `${ano}-01-01`).lt('mes', `${ano + 1}-01-01`),
      buscarEntradas(`${ano - 1}-01-01T00:00:00-03:00`, ini),
    ])
    const base: LinhaAno[] = Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, mens: 0, avul: 0, serv: 0, total: 0, desp: 0, resultado: 0, fechado: false }))
    for (const e of entradas) {
      const m = Number(chaveMesDeData(e.data).slice(5, 7)) - 1
      if (e.tipo === 'Mensalidade') base[m].mens += e.valor; else if (e.tipo === 'Serviço') base[m].serv += e.valor; else base[m].avul += e.valor
    }
    for (const d of (desp as { mes: string; valor: number }[]) || []) base[Number(d.mes.slice(5, 7)) - 1].desp += Number(d.valor)
    for (const l of base) { l.total = l.mens + l.avul + l.serv; l.resultado = l.total - l.desp }
    for (const f of (fechs as Fechamento[]) || []) {
      const l = base[Number(f.mes.slice(5, 7)) - 1]
      Object.assign(l, { mens: Number(f.receita_mensalidades), avul: Number(f.receita_avulsas), serv: Number(f.receita_servicos || 0), total: Number(f.receita_total), desp: Number(f.despesas_total), resultado: Number(f.resultado), fechado: true })
    }
    setLinhas(base)
    setTotalAnoAnterior(anteriores.length ? anteriores.reduce((s, e) => s + e.valor, 0) : null)
    setLoading(false)
  }
  useEffect(() => { carregar() }, [ano])

  if (loading) return <p style={{ color: 'var(--text2)' }}>Carregando...</p>

  const hoje = new Date(Date.now() - 3 * 3600 * 1000)
  const ultimoMes = hoje.getUTCFullYear() === ano ? hoje.getUTCMonth() + 1 : hoje.getUTCFullYear() > ano ? 12 : 0
  const comMovimento = linhas.filter(l => l.mes <= ultimoMes && (l.total > 0 || l.desp > 0))
  const tot = linhas.reduce((s, l) => ({ mens: s.mens + l.mens, avul: s.avul + l.avul, serv: s.serv + l.serv, total: s.total + l.total, desp: s.desp + l.desp, resultado: s.resultado + l.resultado }), { mens: 0, avul: 0, serv: 0, total: 0, desp: 0, resultado: 0 })
  const media = comMovimento.length ? tot.total / comMovimento.length : 0
  const comEntrada = comMovimento.filter(l => l.total > 0)
  const melhor = comEntrada.length ? comEntrada.reduce((a, b) => (b.total > a.total ? b : a)) : null
  const pior = comEntrada.length ? comEntrada.reduce((a, b) => (b.total < a.total ? b : a)) : null
  const maxTotal = Math.max(1, ...linhas.map(l => l.total))

  function exportar() {
    baixarCSV(`relatorio-anual-${ano}.csv`, [
      [`Relatório anual ${ano}`],
      [],
      ['Mês', 'Mensalidades', 'Aulas avulsas', 'Serviços', 'Total entradas', 'Despesas', 'Resultado', 'Situação'],
      ...linhas.map(l => [MESES[l.mes - 1], l.mens, l.avul, l.serv, l.total, l.desp, l.resultado, l.fechado ? 'Fechado' : 'Aberto']),
      ['TOTAL', tot.mens, tot.avul, tot.serv, tot.total, tot.desp, tot.resultado, ''],
    ])
  }

  return (
    <div>
      <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <button onClick={() => window.print()} className="btn btn-ghost btn-sm">🖨️ Imprimir / Salvar PDF</button>
        <button onClick={exportar} className="btn btn-ghost btn-sm">⬇️ Baixar planilha</button>
      </div>
      <div className="print-only" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>MFCT Estúdio — Relatório anual {ano}</h2>
        <div style={{ fontSize: 12 }}>Gerado em {new Date().toLocaleDateString('pt-BR')}</div>
      </div>

      <div className="rel-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
        <Card label={`Entradas ${ano}`} value={brl(tot.total)} cor="#3fb950"
          sub={totalAnoAnterior != null && totalAnoAnterior > 0 ? `${ano - 1}: ${brl(totalAnoAnterior)} (${tot.total >= totalAnoAnterior ? '+' : ''}${(((tot.total - totalAnoAnterior) / totalAnoAnterior) * 100).toFixed(0)}%)` : undefined} />
        <Card label="Despesas no ano" value={brl(tot.desp)} cor="var(--danger)" />
        <Card label="Resultado no ano" value={brl(tot.resultado)} cor={tot.resultado >= 0 ? '#3fb950' : 'var(--danger)'} />
        <Card label="Média de entradas/mês" value={brl(media)} sub={`${comMovimento.length} mês(es) com movimento`} />
        {melhor && <Card label="Melhor mês" value={MESES_CURTOS[melhor.mes - 1]} sub={brl(melhor.total)} />}
        {pior && comEntrada.length > 1 && <Card label="Mês mais fraco" value={MESES_CURTOS[pior.mes - 1]} sub={brl(pior.total)} />}
      </div>

      <Secao titulo="Mês a mês">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr>
                <th style={th}>Mês</th><th style={{ ...th, textAlign: 'right' }}>Mensalidades</th><th style={{ ...th, textAlign: 'right' }}>Avulsas</th><th style={{ ...th, textAlign: 'right' }}>Serviços</th>
                <th style={{ ...th, textAlign: 'right' }}>Entradas</th><th style={{ ...th, textAlign: 'right' }}>Despesas</th><th style={{ ...th, textAlign: 'right' }}>Resultado</th><th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(l => (
                <tr key={l.mes} onClick={() => abrirMes(l.mes)} style={{ cursor: 'pointer', opacity: l.mes > ultimoMes ? 0.4 : 1 }}>
                  <td style={td}>
                    <div>{MESES[l.mes - 1]}</div>
                    <div className="no-print" style={{ height: 4, background: '#3fb95040', borderRadius: 2, marginTop: 4, width: `${(l.total / maxTotal) * 100}%` }} />
                  </td>
                  <td style={tdNum}>{brl(l.mens)}</td><td style={tdNum}>{brl(l.avul)}</td><td style={tdNum}>{brl(l.serv)}</td>
                  <td style={{ ...tdNum, fontWeight: 700 }}>{brl(l.total)}</td><td style={tdNum}>{brl(l.desp)}</td>
                  <td style={{ ...tdNum, color: l.resultado >= 0 ? '#3fb950' : 'var(--danger)' }}>{brl(l.resultado)}</td>
                  <td style={{ ...td, fontSize: 11, color: 'var(--text3)' }}>{l.fechado ? '🔒' : ''}</td>
                </tr>
              ))}
              <tr>
                <td style={{ ...td, fontWeight: 700 }}>TOTAL</td><td style={{ ...tdNum, fontWeight: 700 }}>{brl(tot.mens)}</td><td style={{ ...tdNum, fontWeight: 700 }}>{brl(tot.avul)}</td><td style={{ ...tdNum, fontWeight: 700 }}>{brl(tot.serv)}</td>
                <td style={{ ...tdNum, fontWeight: 700 }}>{brl(tot.total)}</td><td style={{ ...tdNum, fontWeight: 700 }}>{brl(tot.desp)}</td>
                <td style={{ ...tdNum, fontWeight: 700, color: tot.resultado >= 0 ? '#3fb950' : 'var(--danger)' }}>{brl(tot.resultado)}</td><td style={td}></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="no-print" style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>Clique num mês pra abrir o relatório dele. 🔒 = mês fechado.</p>
      </Secao>
    </div>
  )
}

// ======================= PÁGINA =======================
function RelatoriosContent() {
  const hoje = new Date(Date.now() - 3 * 3600 * 1000)
  const [aba, setAba] = useState<'mes' | 'ano'>('mes')
  const [ano, setAno] = useState(hoje.getUTCFullYear())
  const [mes, setMes] = useState(hoje.getUTCMonth() + 1)

  const tab = (ativo: boolean): React.CSSProperties => ({
    background: ativo ? '#3fb95022' : 'var(--card)', border: `1.5px solid ${ativo ? '#3fb950' : 'var(--border)'}`,
    color: ativo ? '#3fb950' : 'var(--text2)', borderRadius: 6, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
  })
  function mudarMes(delta: number) {
    let m = mes + delta, a = ano
    if (m < 1) { m = 12; a-- } else if (m > 12) { m = 1; a++ }
    setMes(m); setAno(a)
  }

  return (
    <div>
      <style>{`
        .print-only { display: none; }
        @media print {
          .no-print, .admin-topbar { display: none !important; }
          .print-only { display: block !important; }
          body, main { background: #fff !important; color: #000 !important; }
          main { max-width: none !important; padding: 0 !important; }
          .card { background: #fff !important; border: 1px solid #ccc !important; box-shadow: none !important; break-inside: avoid; }
          .card * { color: #000 !important; }
          table { font-size: 11px; }
          td, th { border-color: #ddd !important; }
          .rel-grid { grid-template-columns: repeat(6, 1fr) !important; }
        }
      `}</style>

      <h1 className="no-print" style={{ fontSize: 24, marginBottom: 4 }}>Relatórios</h1>
      <p className="no-print" style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>
        Fechamento de cada mês, resumo do ano e despesas do estúdio. Dá pra imprimir, salvar em PDF ou baixar em planilha.
      </p>

      <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
        <button onClick={() => setAba('mes')} style={tab(aba === 'mes')}>📅 Mês</button>
        <button onClick={() => setAba('ano')} style={tab(aba === 'ano')}>📊 Ano</button>
        <div style={{ flex: 1 }} />
        {aba === 'mes' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={() => mudarMes(-1)} className="btn btn-ghost btn-sm">◀</button>
            <span style={{ fontWeight: 700, fontSize: 14, minWidth: 130, textAlign: 'center' }}>{MESES[mes - 1]} {ano}</span>
            <button onClick={() => mudarMes(1)} className="btn btn-ghost btn-sm">▶</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={() => setAno(ano - 1)} className="btn btn-ghost btn-sm">◀</button>
            <span style={{ fontWeight: 700, fontSize: 14, minWidth: 60, textAlign: 'center' }}>{ano}</span>
            <button onClick={() => setAno(ano + 1)} className="btn btn-ghost btn-sm">▶</button>
          </div>
        )}
      </div>

      {aba === 'mes'
        ? <RelatorioMes key={`${ano}-${mes}`} ano={ano} mes={mes} />
        : <RelatorioAno key={ano} ano={ano} abrirMes={m => { setMes(m); setAba('mes') }} />}
    </div>
  )
}

export default function RelatoriosPage() {
  return <Suspense><RelatoriosContent /></Suspense>
}
