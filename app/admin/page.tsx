'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseAdmin'
import { periodoAtualHoje, statusPeriodoHoje } from '@/lib/periodos'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

type AulaHoje = {
  horario: string
  aluno_nome: string
  aluno_telefone: string
  tipo: string
  status: string
}

type PagPendente = {
  id: string
  aluno_nome: string
  valor: number
  comprovante_url: string | null
  comprovante_recebido_em: string | null
}

type Aniversariante = {
  id: string
  nome: string
  dia: number
  ehHoje: boolean
}

type VencendoEmBreve = {
  id: string
  nome: string
  dataFim: string
  dias: number
}

export default function AdminHome() {
  const [stats, setStats] = useState({ ativos: 0, leads: 0, aguardando: 0, vencidos: 0 })
  const [aulasHoje, setAulasHoje] = useState<AulaHoje[]>([])
  const [pagPendentes, setPagPendentes] = useState<PagPendente[]>([])
  const [aniversariantes, setAniversariantes] = useState<Aniversariante[]>([])
  const [vencendoEmBreve, setVencendoEmBreve] = useState<VencendoEmBreve[]>([])
  const [faturamentoGrafico, setFaturamentoGrafico] = useState<{ mes: string; total: number }[]>([])
  const [crescimentoGrafico, setCrescimentoGrafico] = useState<{ mes: string; alunos: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const hoje = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
      const hojeStr = hoje.toISOString().slice(0, 10)

      const anoAtual = hoje.getFullYear()

      const [
        { data: alunosComPeriodos },
        { count: leads },
        { count: aguardando },
        { data: periodos },
        { data: agendamentos },
        { data: pagamentos },
        { data: alunosNascimento },
        { data: pagosNoAno },
        { data: alunosMatricula },
      ] = await Promise.all([
        supabase.from('alunos').select('id, nome, status_plano'),
        supabase.from('alunos').select('*', { count: 'exact', head: true }).in('status_plano', ['lead', 'experimental_oferecida', 'experimental_agendada', 'experimental_realizada', 'em_negociacao']),
        supabase.from('pagamentos').select('*', { count: 'exact', head: true }).eq('status', 'aguardando_confirmacao'),
        supabase.from('planos_periodos').select('aluno_id, data_inicio, data_fim, status'),
        supabase.from('agendamentos')
          .select('status, tipo, horarios(horario), alunos(nome, telefone)')
          .eq('data', hojeStr)
          .eq('status', 'confirmado')
          .order('horarios(horario)'),
        supabase.from('pagamentos')
          .select('id, valor, comprovante_url, comprovante_recebido_em, alunos(nome)')
          .eq('status', 'aguardando_confirmacao')
          .order('comprovante_recebido_em', { ascending: false })
          .limit(5),
        supabase.from('alunos').select('id, nome, data_nascimento, status_plano').not('data_nascimento', 'is', null),
        supabase.from('pagamentos').select('valor, desconto, data_pagamento, status').eq('status', 'pago').gte('data_pagamento', `${anoAtual}-01-01`).lte('data_pagamento', `${anoAtual}-12-31`),
        supabase.from('alunos').select('data_matricula').not('data_matricula', 'is', null),
      ])

      const periodosPorAluno = new Map<string, { data_inicio: string; data_fim: string; status: string }[]>()
      for (const periodo of periodos || []) {
        const lista = periodosPorAluno.get(periodo.aluno_id) || []
        lista.push(periodo)
        periodosPorAluno.set(periodo.aluno_id, lista)
      }
      const ativos = (alunosComPeriodos || []).filter(a => periodoAtualHoje(periodosPorAluno.get(a.id) || [])).length
      const vencidos = (alunosComPeriodos || []).filter(a => {
        // Só conta como "vencido" (pendente de cobrança/renovação) quem ainda
        // está com matrícula ativa. Pausado/cancelado não entra nessa conta.
        if (a.status_plano !== 'ativo') return false
        const periodosAluno = periodosPorAluno.get(a.id) || []
        return !periodoAtualHoje(periodosAluno) && periodosAluno.some(p => statusPeriodoHoje(p) === 'vencido')
      }).length
      setStats({ ativos, leads: leads || 0, aguardando: aguardando || 0, vencidos })

      setAulasHoje((agendamentos || []).map((a: any) => ({
        horario: a.horarios?.horario?.slice(0, 5) || '',
        aluno_nome: a.alunos?.nome || '',
        aluno_telefone: a.alunos?.telefone || '',
        tipo: a.tipo,
        status: a.status,
      })))

      setPagPendentes((pagamentos || []).map((p: any) => ({
        id: p.id,
        aluno_nome: p.alunos?.nome || '',
        valor: p.valor,
        comprovante_url: p.comprovante_url,
        comprovante_recebido_em: p.comprovante_recebido_em,
      })))

      // Aniversariantes do mes -- so quem tem matricula ativa/em andamento (nao lead perdido/cancelado)
      const mesAtual = hoje.getMonth()
      const diaHoje = hoje.getDate()
      const listaAniversariantes = (alunosNascimento || [])
        .filter((a: any) => a.status_plano !== 'cancelado' && a.status_plano !== 'perdido')
        .map((a: any) => {
          const nasc = new Date(a.data_nascimento + 'T00:00:00')
          return { id: a.id, nome: a.nome, mes: nasc.getMonth(), dia: nasc.getDate() }
        })
        .filter(a => a.mes === mesAtual)
        .sort((a, b) => a.dia - b.dia)
        .map(a => ({ id: a.id, nome: a.nome, dia: a.dia, ehHoje: a.dia === diaHoje }))
      setAniversariantes(listaAniversariantes)

      // Vencendo em breve (proximos 7 dias) -- matricula ativa, periodo vigente terminando logo
      const proxima7 = new Date(hoje)
      proxima7.setDate(proxima7.getDate() + 7)
      const proxima7Str = proxima7.toISOString().slice(0, 10)
      const nomesPorAluno = new Map<string, string>()
      for (const a of alunosComPeriodos || []) nomesPorAluno.set(a.id, a.nome)
      const listaVencendo: VencendoEmBreve[] = []
      for (const a of alunosComPeriodos || []) {
        if (a.status_plano !== 'ativo') continue
        const periodoAtual = periodoAtualHoje(periodosPorAluno.get(a.id) || [])
        if (!periodoAtual) continue
        if (periodoAtual.data_fim >= hojeStr && periodoAtual.data_fim <= proxima7Str) {
          const dias = Math.round((new Date(periodoAtual.data_fim + 'T00:00:00').getTime() - hoje.getTime()) / 86400000)
          listaVencendo.push({ id: a.id, nome: nomesPorAluno.get(a.id) || '', dataFim: periodoAtual.data_fim, dias })
        }
      }
      listaVencendo.sort((a, b) => a.dias - b.dias)
      setVencendoEmBreve(listaVencendo)

      // Faturamento por mes (ano atual) -- valor liquido (cobrado menos desconto)
      const porMes = new Array(12).fill(0)
      for (const p of pagosNoAno || []) {
        if (!p.data_pagamento) continue
        const idx = new Date(p.data_pagamento).getMonth()
        porMes[idx] += Number(p.valor) - Number(p.desconto || 0)
      }
      setFaturamentoGrafico(MESES.map((m, i) => ({ mes: m, total: Math.round(porMes[i] * 100) / 100 })))

      // Crescimento (aproximado): total acumulado de matriculas feitas ate cada mes do ano atual.
      // Nao existe um historico de "quantos estavam ativos em cada mes" guardado -- isso e uma
      // aproximacao razoavel pra mostrar tendencia, nao um numero exato de ativos por mes.
      const matriculasPorMes = new Array(12).fill(0)
      for (const a of alunosMatricula || []) {
        const d = new Date(a.data_matricula)
        if (d.getFullYear() > anoAtual) continue
        if (d.getFullYear() === anoAtual) matriculasPorMes[d.getMonth()] += 1
        else matriculasPorMes[0] += 1 // matriculado antes desse ano -- conta como "base" em janeiro
      }
      let acumulado = 0
      const crescimento = MESES.map((m, i) => {
        acumulado += matriculasPorMes[i]
        return { mes: m, alunos: acumulado }
      })
      setCrescimentoGrafico(crescimento)

      setLoading(false)
    }
    load()
  }, [])

  const diaSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const hoje = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))

  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 4 }}>Dashboard</h1>
      <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>
        {diaSemana[hoje.getDay()]}, {hoje.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
      </p>

      {/* Cards de stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 28 }}>
        {[
          { label: 'Alunos ativos', value: stats.ativos, href: '/admin/alunos?status=ativo', color: '#3fb950' },
          { label: 'Leads / em negociação', value: stats.leads, href: '/admin/alunos?status=lead', color: 'var(--accent)' },
          { label: 'Aguard. confirmação', value: stats.aguardando, href: '/admin/pagamentos', color: '#f0a500' },
          { label: 'Planos vencidos', value: stats.vencidos, href: '/admin/alunos?status=vencido', color: 'var(--danger)' },
        ].map(c => (
          <Link key={c.label} href={c.href} style={{
            background: 'var(--card)', border: `1px solid var(--border)`, borderRadius: 8,
            padding: '1rem', textDecoration: 'none', color: 'var(--text)', display: 'block',
          }}>
            <div style={{ fontFamily: 'Anton, sans-serif', fontSize: 40, color: c.color, lineHeight: 1 }}>
              {loading ? '—' : c.value}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 6 }}>{c.label}</div>
          </Link>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Aulas de hoje */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', letterSpacing: 1, textTransform: 'uppercase' }}>
              Aulas hoje
            </h2>
            <Link href="/admin/agenda" style={{ fontSize: 12, color: 'var(--text2)', textDecoration: 'none' }}>Ver agenda →</Link>
          </div>
          {loading ? (
            <p style={{ fontSize: 13, color: 'var(--text2)' }}>Carregando...</p>
          ) : aulasHoje.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text2)' }}>Nenhuma aula hoje.</p>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {aulasHoje.map((a, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < aulasHoje.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{a.horario}</span>
                    <span style={{ fontSize: 13, color: 'var(--text2)', marginLeft: 8 }}>{a.aluno_nome}</span>
                  </div>
                  {a.tipo === 'experimental' && (
                    <span style={{ fontSize: 11, background: 'var(--accent)', color: '#fff', borderRadius: 4, padding: '2px 6px' }}>exp.</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagamentos aguardando confirmação */}
        <div style={{ background: 'var(--card)', border: `1px solid ${stats.aguardando > 0 ? '#f0a500' : 'var(--border)'}`, borderRadius: 8, padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: stats.aguardando > 0 ? '#f0a500' : 'var(--text2)', letterSpacing: 1, textTransform: 'uppercase' }}>
              {stats.aguardando > 0 ? `⚠️ ${stats.aguardando} aguardando` : 'Pagamentos'}
            </h2>
            <Link href="/admin/pagamentos" style={{ fontSize: 12, color: 'var(--text2)', textDecoration: 'none' }}>Ver todos →</Link>
          </div>
          {loading ? (
            <p style={{ fontSize: 13, color: 'var(--text2)' }}>Carregando...</p>
          ) : pagPendentes.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text2)' }}>Nenhum pagamento pendente.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {pagPendentes.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{p.aluno_nome}</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                      R$ {Number(p.valor).toFixed(2).replace('.', ',')}
                      {p.comprovante_recebido_em && ` · ${new Date(p.comprovante_recebido_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                    </div>
                  </div>
                  <Link href="/admin/pagamentos" style={{
                    background: '#f0a500', color: '#000', borderRadius: 4, padding: '4px 10px',
                    fontSize: 11, fontWeight: 700, textDecoration: 'none',
                  }}>Confirmar</Link>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>

        {/* Aniversariantes do mês */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
            🎂 Aniversariantes do mês
          </h2>
          {loading ? (
            <p style={{ fontSize: 13, color: 'var(--text2)' }}>Carregando...</p>
          ) : aniversariantes.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text2)' }}>Ninguém faz aniversário esse mês.</p>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {aniversariantes.map(a => (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13 }}>{a.nome}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: a.ehHoje ? 'var(--accent2)' : 'var(--text2)' }}>
                    {a.ehHoje ? 'Hoje! 🎉' : `dia ${a.dia}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Vencendo em breve */}
        <div style={{ background: 'var(--card)', border: `1px solid ${vencendoEmBreve.length > 0 ? 'var(--danger)' : 'var(--border)'}`, borderRadius: 8, padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: vencendoEmBreve.length > 0 ? 'var(--danger)' : 'var(--text2)', letterSpacing: 1, textTransform: 'uppercase' }}>
              ⏳ Vencendo em breve
            </h2>
            <Link href="/admin/mensalidades" style={{ fontSize: 12, color: 'var(--text2)', textDecoration: 'none' }}>Ver mensalidades →</Link>
          </div>
          {loading ? (
            <p style={{ fontSize: 13, color: 'var(--text2)' }}>Carregando...</p>
          ) : vencendoEmBreve.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text2)' }}>Ninguém vence nos próximos 7 dias.</p>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {vencendoEmBreve.map(v => (
                <Link key={v.id} href={`/admin/mensalidades/${v.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: 'var(--text)' }}>
                  <span style={{ fontSize: 13 }}>{v.nome}</span>
                  <span style={{ fontSize: 12, color: 'var(--text2)' }}>{v.dias === 0 ? 'vence hoje' : `${v.dias} dia(s)`}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>

        {/* Gráfico: faturamento por mês */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', letterSpacing: 1, textTransform: 'uppercase' }}>
              💰 Faturamento por mês
            </h2>
            <Link href="/admin/financeiro" style={{ fontSize: 12, color: 'var(--text2)', textDecoration: 'none' }}>Ver financeiro →</Link>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={faturamentoGrafico}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="mes" stroke="var(--text3)" fontSize={11} />
              <YAxis stroke="var(--text3)" fontSize={11} width={40} />
              <Tooltip
                formatter={(v: number) => [`R$ ${Number(v).toFixed(2).replace('.', ',')}`, 'Faturamento']}
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
              />
              <Bar dataKey="total" fill="var(--accent2)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Gráfico: crescimento de alunos */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
            📈 Crescimento (matrículas acumuladas)
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={crescimentoGrafico}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="mes" stroke="var(--text3)" fontSize={11} />
              <YAxis stroke="var(--text3)" fontSize={11} width={30} />
              <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }} />
              <Line type="monotone" dataKey="alunos" stroke="#3fb950" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

      </div>

      {/* Links rápidos */}
      <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
        {[
          { label: '👥 Alunos', href: '/admin/alunos' },
          { label: '📅 Agenda', href: '/admin/agenda' },
          { label: '🚴 Aeróbico', href: '/admin/aerobico' },
          { label: '💰 Pagamentos', href: '/admin/pagamentos' },
          { label: '📊 Financeiro', href: '/admin/financeiro' },
          { label: '📝 Posts', href: '/admin/posts' },
        ].map(l => (
          <Link key={l.href} href={l.href} style={{
            background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6,
            padding: '8px 16px', fontSize: 13, textDecoration: 'none', color: 'var(--text)',
          }}>{l.label}</Link>
        ))}
      </div>
    </div>
  )
}
