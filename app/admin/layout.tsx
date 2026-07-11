'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'
import { useState } from 'react'
import NotificationBell from '@/components/admin/NotificationBell'

function Icon({ name }: { name: string }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (name) {
    case 'home':
      return <svg {...common}><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></svg>
    case 'users':
      return <svg {...common}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><path d="M16 8.2a3 3 0 0 1 0 5.9" /><path d="M18.5 20c0-2.7-1.5-4.8-3.7-5.7" /></svg>
    case 'calendar':
      return <svg {...common}><rect x="3.5" y="5" width="17" height="16" rx="2" /><line x1="3.5" y1="10" x2="20.5" y2="10" /><line x1="8" y1="3" x2="8" y2="7" /><line x1="16" y1="3" x2="16" y2="7" /></svg>
    case 'activity':
      return <svg {...common}><path d="M3 12h4l2-7 4 14 2-7h6" /></svg>
    case 'card':
      return <svg {...common}><rect x="2.5" y="5.5" width="19" height="13" rx="2" /><line x1="2.5" y1="10" x2="21.5" y2="10" /></svg>
    case 'tag':
      return <svg {...common}><path d="M11.5 3.5H4v7.5l10 10 7.5-7.5-10-10z" /><circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none" /></svg>
    case 'chart':
      return <svg {...common}><line x1="5" y1="20" x2="5" y2="12" /><line x1="12" y1="20" x2="12" y2="5" /><line x1="19" y1="20" x2="19" y2="15" /></svg>
    case 'file':
      return <svg {...common}><path d="M6 3h9l4 4v14H6z" /><line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="16" x2="15" y2="16" /></svg>
    default:
      return null
  }
}

const GRUPOS = [
  {
    titulo: null,
    itens: [{ href: '/admin', label: 'Início', icon: 'home' }],
  },
  {
    titulo: 'Alunos & Agenda',
    itens: [
      { href: '/admin/alunos', label: 'Alunos', icon: 'users' },
      { href: '/admin/agenda', label: 'Agenda', icon: 'calendar' },
      { href: '/admin/aerobico', label: 'Aeróbico', icon: 'activity' },
    ],
  },
  {
    titulo: 'Financeiro',
    itens: [
      { href: '/admin/pagamentos', label: 'Pagamentos', icon: 'card' },
      { href: '/admin/avulsas', label: 'Aulas Avulsas', icon: 'tag' },
      { href: '/admin/planos', label: 'Planos', icon: 'tag' },
      { href: '/admin/financeiro', label: 'Financeiro', icon: 'chart' },
    ],
  },
  {
    titulo: 'Site',
    itens: [{ href: '/admin/posts', label: 'Posts', icon: 'file' }],
  },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [menuAberto, setMenuAberto] = useState(false)

  async function sair() {
    await fetch('/api/admin-auth', { method: 'DELETE' })
    router.push('/admin-login')
  }

  const linkStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px',
    borderRadius: 6, textDecoration: 'none', fontSize: 13, fontWeight: 600,
    color: active ? 'var(--text)' : 'var(--text2)',
    background: active ? 'var(--card)' : 'transparent',
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: "'Inter', sans-serif" }}>
      {/* Barra fixa no topo — sempre, em qualquer tamanho de tela */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 40, background: 'var(--bg2)',
        borderBottom: '1px solid var(--border)', padding: '0.75rem 1.25rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button
          onClick={() => setMenuAberto(true)}
          aria-label="Abrir menu"
          style={{ background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0, width: 32 }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Image src="/logo.png" alt="MFCT" width={30} height={20} style={{ objectFit: 'contain' }} />
          <span style={{ fontFamily: 'Anton, sans-serif', fontSize: 14, letterSpacing: 1 }}>ADMIN</span>
        </div>

        <div style={{ width: 32, display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
          <NotificationBell />
        </div>
      </div>

      {/* Overlay + menu deslizante — a mesma coisa em qualquer tamanho de tela */}
      {menuAberto && (
        <div
          onClick={() => setMenuAberto(false)}
          style={{ position: 'fixed', inset: 0, background: '#000c', zIndex: 50 }}
        >
          <aside
            onClick={e => e.stopPropagation()}
            style={{
              width: 270, maxWidth: '82vw', height: '100vh', background: 'var(--bg2)',
              borderRight: '1px solid var(--border)', padding: '1.25rem 0.75rem',
              display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0.5rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Image src="/logo.png" alt="MFCT" width={36} height={24} style={{ objectFit: 'contain' }} />
                <span style={{ fontFamily: 'Anton, sans-serif', fontSize: 15, letterSpacing: 1 }}>ADMIN</span>
              </div>
              <button onClick={() => setMenuAberto(false)} aria-label="Fechar menu" style={{ background: 'transparent', border: 'none', color: 'var(--text2)', cursor: 'pointer', display: 'flex' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="5" y1="5" x2="19" y2="19" />
                  <line x1="19" y1="5" x2="5" y2="19" />
                </svg>
              </button>
            </div>

            {GRUPOS.map((grupo, gi) => (
              <div key={gi} style={{ marginBottom: 10 }}>
                {grupo.titulo && (
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', letterSpacing: '1px', textTransform: 'uppercase', padding: '8px 12px 4px' }}>
                    {grupo.titulo}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {grupo.itens.map(item => {
                    const active = pathname === item.href || (item.href !== '/admin' && pathname?.startsWith(item.href))
                    return (
                      <Link key={item.href} href={item.href} onClick={() => setMenuAberto(false)} style={linkStyle(active)}>
                        <Icon name={item.icon} />
                        {item.label}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}

            <div style={{ flex: 1 }} />
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 8 }}>
              <Link href="/" style={{ fontSize: 12, color: 'var(--text3)', textDecoration: 'none', padding: '10px 12px', display: 'block' }}>
                ← Ver site
              </Link>
              <button onClick={sair} style={{
                textAlign: 'left', background: 'transparent', border: 'none', color: 'var(--accent2)', width: '100%',
                fontSize: 12, fontWeight: 700, padding: '10px 12px', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Sair
              </button>
            </div>
          </aside>
        </div>
      )}

      <main style={{ maxWidth: 1100, width: '100%', margin: '0 auto', padding: '1.5rem 1.25rem', boxSizing: 'border-box' }}>
        {children}
      </main>
    </div>
  )
}
