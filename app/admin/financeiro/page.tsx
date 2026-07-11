'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseAdmin'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const MESES_LONGOS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

type PagamentoRow = {
  valor: string | number
  desconto: string | number | null
  data_pagamento: string | null
  status: string
}

type VencimentoRow = {
  id: string
  nome: string
  telefone: string | null
  dia_vencimento: number | null
  valor: number
  proximaData: Date
  diasRestantes: number
}

type PagamentoDetalhe = {
  nome: string
  valor: number
  data: string
}

type MesHistorico = {
  chave: string // "2026-07"
  label: string // "Julho 2026"
  total: number
  qtd: number
  ticketMedio: number
  crescimento: number | null // % em relação ao mês anterior
  pagamentos: PagamentoDetalhe[]
}

export default function FinanceiroPage() {
  const [aba, setAba] = useState<'visao' | 'historico'>('visao')
  const [loading, setLoading] = useState(true)
  const [totalMes, setTotalMes] = useState(0)
  const [qtdMes, setQtdMes] = useState(0)
  const [previsto, setPrevisto] = useState(0)
  const [alunosAtivos, setAlunosAtivos] = useState(0)
  const [pendentes, setPendentes] = useState(0)
  const [grafico, setGrafico] = useState<{ mes: string; total: number }[]>([])
  const [vencimentos, setVencimentos] = useState<VencimentoRow[]>([])
  const [historico, setHistorico] = useState<MesHistorico[]>([])
  const [mesAberto, setMesAberto] = useState<string | null>(null)
  const [semanalData, setSemanalData] = useState<{ label: string; total: number }[]>([])
  const [anualData, setAnualData] = useState<{ label: string; total: number }[]>([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const agora = new Date()
      const anoAtual = agora.getFullYear()
      const inicioAno = `${anoAtual}-01-01`
      const fimAno = `${anoAtual}-12-31`

      // Pagamentos pagos no ano (pra montar gráfico mensal)
      const { data: pagos } = await supabase
        .from('pagamentos')
        .select('valor, desconto, data_pagamento, status')
        .eq('status', 'pago')
        .gte('data_pagamento', inicioAno)
        .lte('data_pagamento', fimAno)

      const porMes = new Array(12).fill(0)
      let totalDoMesAtual = 0
      let qtdDoMesAtual = 0
      const mesAtualIdx = agora.getMonth()

      for (const p of (pagos as PagamentoRow[] | null) || []) {
        if (!p.data_pagamento) continue
        const d = new Date(p.data_pagamento)
        const idx = d.getMonth()
        // Valor realmente recebido = valor cobrado menos o desconto dado (ex: cortesia de 100% = recebeu R$0)
        const valorLiquido = Number(p.valor) - Number(p.desconto || 0)
        porMes[idx] += valorLiquido
        if (idx === mesAtualIdx) {
          totalDoMesAtual += valorLiquido
          qtdDoMesAtual += 1
        }
      }

      setTotalMes(totalDoMesAtual)
      setQtdMes(qtdDoMesAtual)
      setGrafico(MESES.map((m, i) => ({ mes: m, total: Math.round(porMes[i] * 100) / 100 })))

      // Receita prevista: soma dos planos dos alunos ativos
      const { data: ativos } = await supabase
        .from('alunos')
        .select('id, nome, telefone, dia_vencimento, planos(valor)')
        .eq('status_plano', 'ativo')

      let soma = 0
      const hoje = new Date()
      hoje.setHours(0, 0, 0, 0)
      const projecao: VencimentoRow[] = []

      for (const a of ativos || []) {
        const p = Array.isArray(a.planos) ? a.planos[0] : a.planos
        const valor = p?.valor ? Number(p.valor) : 0
        if (valor) soma += valor

        if (a.dia_vencimento) {
          let proximaData = new Date(hoje.getFullYear(), hoje.getMonth(), a.dia_vencimento)
          if (proximaData < hoje) {
            proximaData = new Date(hoje.getFullYear(), hoje.getMonth() + 1, a.dia_vencimento)
          }
          const diasRestantes = Math.round((proximaData.getTime() - hoje.getTime()) / 86400000)
          projecao.push({
            id: a.id, nome: a.nome, telefone: a.telefone, dia_vencimento: a.dia_vencimento,
            valor, proximaData, diasRestantes,
          })
        }
      }
      projecao.sort((x, y) => x.proximaData.getTime() - y.proximaData.getTime())
      setVencimentos(projecao)
      setPrevisto(soma)
      setAlunosAtivos(ativos?.length || 0)

      // Pagamentos pendentes
      const { count } = await supabase
        .from('pagamentos')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pendente')
      setPendentes(count || 0)

      // Histórico mensal completo (todos os meses que já tiveram pagamento, de qualquer ano)
      const { data: todosPagos } = await supabase
        .from('pagamentos')
        .select('valor, desconto, data_pagamento, status, alunos(nome)')
        .eq('status', 'pago')
        .not('data_pagamento', 'is', null)
        .order('data_pagamento', { ascending: true })

      const porChave = new Map<string, MesHistorico>()
      for (const p of (todosPagos as (PagamentoRow & { alunos: { nome: string } | { nome: string }[] | null })[] | null) || []) {
        if (!p.data_pagamento) continue
        const d = new Date(p.data_pagamento)
        const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const label = `${MESES_LONGOS[d.getMonth()]} ${d.getFullYear()}`
        const valorLiquido = Number(p.valor) - Number(p.desconto || 0)
        const alunoObj = Array.isArray(p.alunos) ? p.alunos[0] : p.alunos
        const nome = alunoObj?.nome || 'Aluno'

        if (!porChave.has(chave)) {
          porChave.set(chave, { chave, label, total: 0, qtd: 0, ticketMedio: 0, crescimento: null, pagamentos: [] })
        }
        const mes = porChave.get(chave)!
        mes.total += valorLiquido
        mes.qtd += 1
        mes.pagamentos.push({ nome, valor: valorLiquido, data: p.data_pagamento })
      }

      const mesesOrdenados = [...porChave.values()].sort((a, b) => a.chave.localeCompare(b.chave))
      for (let i = 0; i < mesesOrdenados.length; i++) {
        const m = mesesOrdenados[i]
        m.ticketMedio = m.qtd > 0 ? m.total / m.qtd : 0
        if (i > 0 && mesesOrdenados[i - 1].total > 0) {
          m.crescimento = ((m.total - mesesOrdenados[i - 1].total) / mesesOrdenados[i - 1].total) * 100
        }
      }
      setHistorico([...mesesOrdenados].reverse()) // mais recente primeiro

      // Dados semanais (ultimas 12 semanas) e anuais, a partir dos mesmos pagamentos
      const porSemana = new Map<string, number>()
      const porAno = new Map<string, number>()
      for (const p of (todosPagos as (PagamentoRow & { alunos: { nome: string } | { nome: string }[] | null })[] | null) || []) {
        if (!p.data_pagamento) continue
        const d = new Date(p.data_pagamento)
        const valorLiquido = Number(p.valor) - Number(p.desconto || 0)

        // Semana: segunda-feira da semana como chave
        const diaSemana = (d.getDay() + 6) % 7 // 0 = segunda
        const inicioSemana = new Date(d)
        inicioSemana.setDate(d.getDate() - diaSemana)
        const chaveSemana = inicioSemana.toISOString().slice(0, 10)
        porSemana.set(chaveSemana, (porSemana.get(chaveSemana) || 0) + valorLiquido)

        const chaveAno = String(d.getFullYear())
        porAno.set(chaveAno, (porAno.get(chaveAno) || 0) + valorLiquido)
      }

      const semanasOrdenadas = [...porSemana.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12)
      setSemanalData(semanasOrdenadas.map(([chave, total]) => ({
        label: new Date(chave + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        total: Math.round(total * 100) / 100,
      })))

      const anosOrdenados = [...porAno.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      setAnualData(anosOrdenados.map(([ano, total]) => ({ label: ano, total: Math.round(total * 100) / 100 })))

      setLoading(false)
    }
    load()
  }, [])

  const mesAtualLabel = MESES[new Date().getMonth()]

  if (loading) return <p style={{ color: 'var(--text2)' }}>Carregando...</p>

  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 16 }}>Financeiro</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button onClick={() => setAba('visao')} style={{
          background: aba === 'visao' ? 'var(--accent)' : 'var(--card)',
          border: '1px solid var(--border)', color: aba === 'visao' ? '#fff' : 'var(--text2)',
          borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          Visão geral
        </button>
        <button onClick={() => setAba('historico')} style={{
          background: aba === 'historico' ? 'var(--accent)' : 'var(--card)',
          border: '1px solid var(--border)', color: aba === 'historico' ? '#fff' : 'var(--text2)',
          borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          Histórico mensal
        </button>
      </div>

      {aba === 'visao' ? (
      <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        <Card label={`Recebido em ${mesAtualLabel}`} value={`R$ ${totalMes.toFixed(2)}`} />
        <Card label="Pagamentos no mês" value={String(qtdMes)} />
        <Card label="Receita prevista/mês" value={`R$ ${previsto.toFixed(2)}`} sub={`${alunosAtivos} aluno(s) ativo(s)`} />
        <Card label="Pagamentos pendentes" value={String(pendentes)} accent="var(--accent2)" />
      </div>

      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, padding: '1.25rem' }}>
        <h3 style={{ fontSize: 13, color: 'var(--text2)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 14 }}>
          Receita por mês ({new Date().getFullYear()})
        </h3>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <BarChart data={grafico}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="mes" stroke="var(--text2)" fontSize={12} />
              <YAxis stroke="var(--text2)" fontSize={12} tickFormatter={(v) => `R$${v}`} />
              <Tooltip
                formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Recebido']}
                contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
                labelStyle={{ color: 'var(--text)' }}
              />
              <Bar dataKey="total" fill="var(--accent2)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, padding: '1.25rem', marginTop: 20 }}>
        <h3 style={{ fontSize: 13, color: 'var(--text2)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 4 }}>
          Próximos vencimentos
        </h3>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>
          Baseado no dia de vencimento cadastrado de cada aluno ativo. Alunos sem dia de vencimento definido não aparecem aqui.
        </p>

        {vencimentos.length === 0 ? (
          <p style={{ color: 'var(--text2)', fontSize: 13 }}>Nenhum vencimento com data cadastrada.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
            {vencimentos.map(v => {
              const urgente = v.diasRestantes <= 3
              const emBreve = v.diasRestantes <= 7
              return (
                <div key={v.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 4, flexWrap: 'wrap',
                  background: urgente ? 'var(--accent2)15' : 'var(--bg)',
                  border: `1px solid ${urgente ? 'var(--accent2)' : 'var(--border)'}`,
                }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{v.nome}</span>
                    <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 8 }}>
                      {v.proximaData.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>R$ {v.valor.toFixed(2)}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 4,
                      color: urgente ? 'var(--accent2)' : emBreve ? '#f0a500' : 'var(--text2)',
                      background: 'var(--bg2)',
                    }}>
                      {v.diasRestantes === 0 ? 'vence hoje' : v.diasRestantes === 1 ? 'vence amanhã' : `em ${v.diasRestantes} dias`}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      </>
      ) : (
        <HistoricoMensal historico={historico} mesAberto={mesAberto} setMesAberto={setMesAberto} semanalData={semanalData} anualData={anualData} />
      )}
    </div>
  )
}

function HistoricoMensal({ historico, mesAberto, setMesAberto, semanalData, anualData }: {
  historico: MesHistorico[]
  mesAberto: string | null
  setMesAberto: (v: string | null) => void
  semanalData: { label: string; total: number }[]
  anualData: { label: string; total: number }[]
}) {
  const [periodo, setPeriodo] = useState<'semana' | 'mes' | 'ano'>('mes')

  if (historico.length === 0) {
    return <p style={{ color: 'var(--text2)', fontSize: 13 }}>Nenhum pagamento confirmado ainda.</p>
  }

  const mediaTicketGeral = historico.reduce((s, m) => s + m.ticketMedio, 0) / historico.length
  const mensalData = [...historico].reverse().map(m => ({ label: m.label.split(' ')[0].slice(0, 3), total: Math.round(m.total * 100) / 100 }))
  const dadosGrafico = periodo === 'semana' ? semanalData : periodo === 'ano' ? anualData : mensalData

  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
        Cada mês fecha automaticamente assim que vira o mês — os valores são calculados pela data real de cada pagamento, sempre editável se precisar corrigir algo na tela de Pagamentos.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
        <Card label="Ticket médio geral" value={`R$ ${mediaTicketGeral.toFixed(2)}`} />
        <Card label="Meses registrados" value={String(historico.length)} />
      </div>

      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, padding: '1.25rem', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <h3 style={{ fontSize: 13, color: 'var(--text2)', letterSpacing: '1px', textTransform: 'uppercase' }}>
            Crescimento
          </h3>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['semana', 'mes', 'ano'] as const).map(p => (
              <button key={p} onClick={() => setPeriodo(p)} style={{
                background: periodo === p ? 'var(--accent)' : 'transparent',
                border: '1px solid var(--border)', color: periodo === p ? '#fff' : 'var(--text2)',
                borderRadius: 4, padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {p === 'semana' ? 'Semanal' : p === 'mes' ? 'Mensal' : 'Anual'}
              </button>
            ))}
          </div>
        </div>
        <div style={{ width: '100%', height: 240 }}>
          <ResponsiveContainer>
            <LineChart data={dadosGrafico}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" stroke="var(--text2)" fontSize={12} />
              <YAxis stroke="var(--text2)" fontSize={12} tickFormatter={(v) => `R$${v}`} />
              <Tooltip
                formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Recebido']}
                contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
                labelStyle={{ color: 'var(--text)' }}
              />
              <Line type="monotone" dataKey="total" stroke="var(--accent2)" strokeWidth={2.5} dot={{ fill: 'var(--accent2)', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
        {historico.map(m => {
          const aberto = mesAberto === m.chave
          return (
            <div key={m.chave} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
              <div
                onClick={() => setMesAberto(aberto ? null : m.chave)}
                style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, cursor: 'pointer' }}
              >
                <div>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{m.label}</span>
                  <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 10 }}>{m.qtd} pagamento{m.qtd === 1 ? '' : 's'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ fontSize: 12, color: 'var(--text2)' }}>Ticket médio: R$ {m.ticketMedio.toFixed(2)}</span>
                  {m.crescimento !== null && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4,
                      color: m.crescimento >= 0 ? '#3fb950' : 'var(--accent2)',
                      background: 'var(--bg)',
                    }}>
                      {m.crescimento >= 0 ? '↑' : '↓'} {Math.abs(m.crescimento).toFixed(0)}%
                    </span>
                  )}
                  <span style={{ fontFamily: 'Anton, sans-serif', fontSize: 20, color: 'var(--accent)' }}>
                    R$ {m.total.toFixed(2)}
                  </span>
                </div>
              </div>

              {aberto && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '10px 16px' }}>
                  {m.pagamentos.map((p, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, borderBottom: i < m.pagamentos.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <span>{p.nome}</span>
                      <span style={{ color: 'var(--text2)', display: 'flex', gap: 10 }}>
                        <span>{new Date(p.data).toLocaleDateString('pt-BR')}</span>
                        <span style={{ fontWeight: 700, color: 'var(--text)' }}>R$ {p.valor.toFixed(2)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Card({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, padding: '1.25rem' }}>
      <div style={{ fontFamily: 'Anton, sans-serif', fontSize: 28, color: accent || 'var(--accent)' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 6 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}
