'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'

const MENU = [
  { href: '/admin', label: 'Início', icon: '⊞' },
  { href: '/admin/alunos', label: 'Alunos', icon: '👤' },
  { href: '/admin/agenda', label: 'Agenda', icon: '📅' },
  { href: '/admin/pagamentos', label: 'Pagamentos', icon: '💳' },
  { href: '/admin/posts', label: 'Posts', icon: '📝' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  async function sair() {
    await fetch('/api/admin-auth', { method: 'DELETE' })
    router.push('/admin-login')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: "'Inter', sans-serif", display: 'flex' }}>
      <aside style={{
        width: 220, background: 'var(--bg2)', borderRight: '1px solid var(--border)',
        padding: '1.25rem 0.75rem', display: 'flex', flexDirection: 'column', gap: 4,
        position: 'sticky', top: 0, height: '100vh', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 0.5rem', marginBottom: '1.5rem' }}>
          <Image src="/logo.png" alt="MFCT" width={36} height={24} style={{ objectFit: 'contain' }} />
          <span style={{ fontFamily: 'Anton, sans-serif', fontSize: 15, letterSpacing: 1 }}>ADMIN</span>
        </div>
        {MENU.map(item => {
          const active = pathname === item.href || (item.href !== '/admin' && pathname?.startsWith(item.href))
          return (
            <Link key={item.href} href={item.href} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
              borderRadius: 6, textDecoration: 'none', fontSize: 13, fontWeight: 600,
              color: active ? 'var(--text)' : 'var(--text2)',
              background: active ? 'var(--card)' : 'transparent',
            }}>
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
      <main style={{ flex: 1, padding: '1.75rem 2rem', maxWidth: 1100, width: '100%', margin: '0 auto' }}>
        {children}
      </main>
    </div>
  )
}
