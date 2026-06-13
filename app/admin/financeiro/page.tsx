'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

type PagamentoRow = {
  valor: string | number
  data_pagamento: string | null
  status: string
}

export default function FinanceiroPage() {
  const [loading, setLoading] = useState(true)
  const [totalMes, setTotalMes] = useState(0)
  const [qtdMes, setQtdMes] = useState(0)
  const [previsto, setPrevisto] = useState(0)
  const [alunosAtivos, setAlunosAtivos] = useState(0)
  const [pendentes, setPendentes] = useState(0)
  const [grafico, setGrafico] = useState<{ mes: string; total: number }[]>([])

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
        .select('id, planos(valor)')
        .eq('status_plano', 'ativo')

      let soma = 0
      for (const a of ativos || []) {
        const p = Array.isArray(a.planos) ? a.planos[0] : a.planos
        if (p?.valor) soma += Number(p.valor)
      }
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
