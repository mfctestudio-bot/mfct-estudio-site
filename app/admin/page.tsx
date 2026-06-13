'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function AdminHome() {
  const [stats, setStats] = useState({ alunos: 0, ativos: 0, leads: 0, pendentes: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ count: total }, { count: ativos }, { count: leads }, { count: pendentes }] = await Promise.all([
        supabase.from('alunos').select('*', { count: 'exact', head: true }),
        supabase.from('alunos').select('*', { count: 'exact', head: true }).eq('status_plano', 'ativo'),
        supabase.from('alunos').select('*', { count: 'exact', head: true }).in('status_plano', ['lead', 'experimental_oferecida', 'experimental_agendada', 'experimental_realizada', 'faltou_experimental', 'em_negociacao', 'experimental']),
        supabase.from('pagamentos').select('*', { count: 'exact', head: true }).eq('status', 'pendente'),
      ])
      setStats({ alunos: total || 0, ativos: ativos || 0, leads: leads || 0, pendentes: pendentes || 0 })
      setLoading(false)
    }
    load()
  }, [])

  const cards = [
    { label: 'Total de alunos', value: stats.alunos, href: '/admin/alunos' },
    { label: 'Alunos ativos', value: stats.ativos, href: '/admin/alunos?status=ativo' },
    { label: 'Leads / experimentais', value: stats.leads, href: '/admin/alunos?status=lead' },
    { label: 'Pagamentos pendentes', value: stats.pendentes, href: '/admin/pagamentos' },
  ]

  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 20 }}>Início</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        {cards.map(c => (
          <Link key={c.label} href={c.href} style={{
            background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6,
            padding: '1.25rem', textDecoration: 'none', color: 'var(--text)',
          }}>
            <div style={{ fontFamily: 'Anton, sans-serif', fontSize: 36, color: 'var(--accent)' }}>
              {loading ? '—' : c.value}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 6 }}>{c.label}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
