'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'
import { useState } from 'react'
import NotificationBell from '@/components/admin/NotificationBell'

const MENU = [
  { href: '/admin', label: 'Início', icon: '⊞' },
  { href: '/admin/alunos', label: 'Alunos', icon: '👤' },
  { href: '/admin/agenda', label: 'Agenda', icon: '📅' },
  { href: '/admin/aerobico', label: 'Aeróbico', icon: '🚴' },
  { href: '/admin/pagamentos', label: 'Pagamentos', icon: '💳' },
  { href: '/admin/planos', label: 'Planos', icon: '🏷️' },
  { href: '/admin/financeiro', label: 'Financeiro', icon: '📊' },
  { href: '/admin/posts', label: 'Posts', icon: '📝' },
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
    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
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
          style={{ background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 22, cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
        >
          ☰
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Image src="/logo.png" alt="MFCT" width={30} height={20} style={{ objectFit: 'contain' }} />
          <span style={{ fontFamily: 'Anton, sans-serif', fontSize: 14, letterSpacing: 1 }}>ADMIN</span>
        </div>

        <NotificationBell />
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
              width: 260, maxWidth: '82vw', height: '100vh', background: 'var(--bg2)',
              borderRight: '1px solid var(--border)', padding: '1.25rem 0.75rem',
              display: 'flex', flexDirection: 'column', gap: 4,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0.5rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Image src="/logo.png" alt="MFCT" width={36} height={24} style={{ objectFit: 'contain' }} />
                <span style={{ fontFamily: 'Anton, sans-serif', fontSize: 15, letterSpacing: 1 }}>ADMIN</span>
              </div>
              <button onClick={() => setMenuAberto(false)} aria-label="Fechar menu" style={{ background: 'transparent', border: 'none', color: 'var(--text2)', fontSize: 20, cursor: 'pointer' }}>
                ✕
              </button>
            </div>

            {MENU.map(item => {
              const active = pathname === item.href || (item.href !== '/admin' && pathname?.startsWith(item.href))
              return (
                <Link key={item.href} href={item.href} onClick={() => setMenuAberto(false)} style={linkStyle(active)}>
                  <span style={{ fontSize: 15 }}>{item.icon}</span>
                  {item.label}
                </Link>
              )
            })}

            <div style={{ flex: 1 }} />
            <Link href="/" style={{ fontSize: 12, color: 'var(--text3)', textDecoration: 'none', padding: '10px 12px' }}>
              ← Ver site
            </Link>
            <button onClick={sair} style={{
              textAlign: 'left', background: 'transparent', border: 'none', color: 'var(--accent2)',
              fontSize: 12, fontWeight: 700, padding: '10px 12px', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Sair
            </button>
          </aside>
        </div>
      )}

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '1.5rem 1.25rem' }}>
        {children}
      </main>
    </div>
  )
}
