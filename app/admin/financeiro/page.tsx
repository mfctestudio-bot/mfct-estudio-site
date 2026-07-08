'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseAdmin'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

type PagamentoRow = {
  valor: string | number
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

export default function FinanceiroPage() {
  const [loading, setLoading] = useState(true)
  const [totalMes, setTotalMes] = useState(0)
  const [qtdMes, setQtdMes] = useState(0)
  const [previsto, setPrevisto] = useState(0)
  const [alunosAtivos, setAlunosAtivos] = useState(0)
  const [pendentes, setPendentes] = useState(0)
  const [grafico, setGrafico] = useState<{ mes: string; total: number }[]>([])
  const [vencimentos, setVencimentos] = useState<VencimentoRow[]>([])

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
        .select('valor, data_pagamento, status')
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
        const valor = Number(p.valor)
        porMes[idx] += valor
        if (idx === mesAtualIdx) {
          totalDoMesAtual += valor
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

      setLoading(false)
    }
    load()
  }, [])

  const mesAtualLabel = MESES[new Date().getMonth()]

  if (loading) return <p style={{ color: 'var(--text2)' }}>Carregando...</p>

  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 20 }}>Financeiro</h1>

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
          <div style={{ display: 'grid', gap: 6 }}>
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
