'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'
import { useState, useEffect } from 'react'
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

function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean | null>(null)
  useEffect(() => {
    function checar() { setIsMobile(window.innerWidth < 768) }
    checar()
    window.addEventListener('resize', checar)
    return () => window.removeEventListener('resize', checar)
  }, [])
  return isMobile
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [menuAberto, setMenuAberto] = useState(false)
  const isMobile = useIsMobile()

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

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      {MENU.map(item => {
        const active = pathname === item.href || (item.href !== '/admin' && pathname?.startsWith(item.href))
        return (
          <Link key={item.href} href={item.href} onClick={onNavigate} style={linkStyle(active)}>
            <span style={{ fontSize: 15 }}>{item.icon}</span>
            {item.label}
          </Link>
        )
      })}
    </>
  )

  // Evita "flash" errado antes do JS descobrir o tamanho real da tela
  if (isMobile === null) {
    return <div style={{ minHeight: '100vh', background: 'var(--bg)' }} />
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: "'Inter', sans-serif" }}>
      {isMobile ? (
        <>
          {/* Barra superior mobile */}
          <div style={{
            position: 'sticky', top: 0, zIndex: 40, background: 'var(--bg2)',
            borderBottom: '1px solid var(--border)', padding: '0.75rem 1rem',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Image src="/logo.png" alt="MFCT" width={30} height={20} style={{ objectFit: 'contain' }} />
              <span style={{ fontFamily: 'Anton, sans-serif', fontSize: 14, letterSpacing: 1 }}>ADMIN</span>
            </div>
            <button
              onClick={() => setMenuAberto(true)}
              aria-label="Abrir menu"
              style={{ background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 22, cursor: 'pointer', padding: 4 }}
            >
              ☰
            </button>
          </div>

          {/* Overlay + menu deslizante */}
          {menuAberto && (
            <div
              onClick={() => setMenuAberto(false)}
              style={{ position: 'fixed', inset: 0, background: '#000c', zIndex: 50 }}
            >
              <aside
                onClick={e => e.stopPropagation()}
                style={{
                  width: 250, maxWidth: '80vw', height: '100vh', background: 'var(--bg2)',
                  borderRight: '1px solid var(--border)', padding: '1.25rem 0.75rem',
                  display: 'flex', flexDirection: 'column', gap: 4,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0.5rem', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Image src="/logo.png" alt="MFCT" width={36} height={24} style={{ objectFit: 'contain' }} />
                    <span style={{ fontFamily: 'Anton, sans-serif', fontSize: 15, letterSpacing: 1 }}>ADMIN</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <NotificationBell />
                    <button onClick={() => setMenuAberto(false)} aria-label="Fechar menu" style={{ background: 'transparent', border: 'none', color: 'var(--text2)', fontSize: 20, cursor: 'pointer' }}>
                      ✕
                    </button>
                  </div>
                </div>
                <NavLinks onNavigate={() => setMenuAberto(false)} />
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

          <main style={{ padding: '1rem' }}>{children}</main>
        </>
      ) : (
        <div style={{ display: 'flex' }}>
          {/* Menu lateral fixo desktop */}
          <aside style={{
            width: 220, background: 'var(--bg2)', borderRight: '1px solid var(--border)',
            padding: '1.25rem 0.75rem', display: 'flex', flexDirection: 'column', gap: 4,
            position: 'sticky', top: 0, height: '100vh', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0.5rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Image src="/logo.png" alt="MFCT" width={36} height={24} style={{ objectFit: 'contain' }} />
                <span style={{ fontFamily: 'Anton, sans-serif', fontSize: 15, letterSpacing: 1 }}>ADMIN</span>
              </div>
              <NotificationBell />
            </div>
            <NavLinks />
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

          <main style={{ flex: 1, width: '100%', margin: '0 auto', maxWidth: 1100, padding: '1.75rem' }}>
            {children}
          </main>
        </div>
      )}
    </div>
  )
}
