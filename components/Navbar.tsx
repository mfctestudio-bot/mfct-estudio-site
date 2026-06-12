'use client'

const links = [
  { href: '#planos', label: 'Planos' },
  { href: '#horarios', label: 'Horários' },
  { href: '#experimental', label: 'Aula Experimental' },
  { href: '#dicas', label: 'Dicas' },
  { href: '#local', label: 'Onde estamos' },
]

export default function Navbar() {
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(15,14,12,0.85)', backdropFilter: 'blur(8px)',
      borderBottom: '1px solid var(--border)',
    }}>
      <nav style={{
        maxWidth: 1100, margin: '0 auto', padding: '0.9rem 1.25rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <a href="#topo" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontFamily: 'Anton, sans-serif', fontSize: 22, letterSpacing: 1,
            color: 'var(--text)',
          }}>
            MFCT <span style={{ color: 'var(--accent)' }}>ESTÚDIO</span>
          </span>
        </a>
        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
          {links.map(l => (
            <a key={l.href} href={l.href} style={{
              fontSize: 13, fontWeight: 600, color: 'var(--text2)',
              textDecoration: 'none', letterSpacing: '0.3px',
            }}>
              {l.label}
            </a>
          ))}
        </div>
      </nav>
    </header>
  )
}
