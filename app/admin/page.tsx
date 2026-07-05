'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseAdmin'

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

export default function AdminHome() {
  const [stats, setStats] = useState({ ativos: 0, leads: 0, aguardando: 0, vencidos: 0 })
  const [aulasHoje, setAulasHoje] = useState<AulaHoje[]>([])
  const [pagPendentes, setPagPendentes] = useState<PagPendente[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const hoje = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
      const hojeStr = hoje.toISOString().slice(0, 10)

      const [
        { count: ativos },
        { count: leads },
        { count: aguardando },
        { count: vencidos },
        { data: agendamentos },
        { data: pagamentos },
      ] = await Promise.all([
        supabase.from('alunos').select('*', { count: 'exact', head: true }).eq('status_plano', 'ativo'),
        supabase.from('alunos').select('*', { count: 'exact', head: true }).in('status_plano', ['lead', 'experimental_oferecida', 'experimental_agendada', 'experimental_realizada', 'em_negociacao']),
        supabase.from('pagamentos').select('*', { count: 'exact', head: true }).eq('status', 'aguardando_confirmacao'),
        supabase.from('alunos').select('*', { count: 'exact', head: true }).eq('status_plano', 'vencido'),
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
      ])

      setStats({ ativos: ativos || 0, leads: leads || 0, aguardando: aguardando || 0, vencidos: vencidos || 0 })

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

      setLoading(false)
    }
    load()
  }, [])

  const diaSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const hoje = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))

  return (
    <div style={{ maxWidth: 800 }}>
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
          { label: 'Planos vencidos', value: stats.vencidos, href: '/admin/alunos?status=vencido', color: 'var(--accent2)' },
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
