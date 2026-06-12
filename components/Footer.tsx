import Image from 'next/image'

export default function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--border)', padding: '2rem 1.25rem 1.5rem', marginTop: '2rem', background: 'var(--bg2)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Image src="/logo.jpeg" alt="MFCT Estúdio" width={44} height={44} style={{ borderRadius: 6 }} />
          <div>
            <div style={{ fontFamily: 'Anton, sans-serif', fontSize: 18, color: 'var(--text)' }}>
              MFCT <span style={{ color: 'var(--accent)' }}>ESTÚDIO</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
              Onde o seu resultado é nossa missão
            </div>
          </div>
        </div>
        <a href="https://www.instagram.com/mfctestudio" target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 13, color: 'var(--text2)', textDecoration: 'none', fontWeight: 600 }}>
          @mfctestudio
        </a>
      </div>
      <div style={{ maxWidth: 1100, margin: '1.25rem auto 0', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>
          MFCT Estúdio © 2026 — Rua Vila Nova Esperança, nº 58, Chatuba/Caju, Rio de Janeiro
        </span>
      </div>
    </footer>
  )
}
