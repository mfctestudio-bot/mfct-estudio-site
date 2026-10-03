import type { SiteConteudo } from '@/lib/siteConteudo'

export default function Sobre({ c }: { c: SiteConteudo['sobre'] }) {
  return (
    <section id="sobre" style={{ background: 'var(--bg2)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '3.5rem 1.25rem' }}>
        <div style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {/* Foto principal em destaque */}
          <div style={{ flex: '1 1 320px', maxWidth: 380 }}>
            <div style={{
              position: 'relative', borderRadius: 4, overflow: 'hidden',
              border: '1px solid var(--border2)',
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.foto}
                alt={c.nome}
                style={{ width: '100%', display: 'block' }}
              />
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.75) 100%)',
              }} />
              <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16 }}>
                <span style={{
                  fontSize: 11, fontWeight: 800, color: 'var(--accent2)', letterSpacing: '1.5px',
                  textTransform: 'uppercase' as const,
                }}>
                  {c.legendaFoto}
                </span>
              </div>
            </div>
          </div>

          {/* Texto */}
          <div style={{ flex: '2 1 420px', minWidth: 280 }}>
            <span style={{
              fontSize: 12, fontWeight: 800, color: 'var(--accent2)', letterSpacing: '2px',
              textTransform: 'uppercase' as const,
            }}>
              {c.etiqueta}
            </span>
            <h2 style={{ fontSize: 36, color: 'var(--text)', margin: '0.5rem 0 1.5rem' }}>
              {c.nome}
            </h2>

            <div style={{ display: 'grid', gap: 16, fontSize: 15, lineHeight: 1.75, color: 'var(--text2)' }}>
              {c.paragrafos.filter(t => t.trim()).map((t, i) => <p key={i}>{t}</p>)}
            </div>

            <a
              href="https://wa.me/5521979582450?text=Oi!%20Vi%20a%20p%C3%A1gina%20sobre%20o%20Matheus%20e%20quero%20saber%20mais"
              target="_blank" rel="noopener noreferrer"
              style={{
                display: 'inline-block', marginTop: 24, background: 'transparent', border: '1px solid var(--accent)',
                color: 'var(--accent)', fontWeight: 800, fontSize: 13, padding: '12px 24px', borderRadius: 4,
                textDecoration: 'none', letterSpacing: '0.5px',
              }}
            >
              {c.botao}
            </a>
          </div>
        </div>

        {/* Galeria de competição */}
        <div
          className="grid grid-cols-2 md:grid-cols-5"
          style={{ gap: 8, marginTop: '3rem' }}
        >
          {c.galeria.filter(Boolean).map((src, i) => (
            <div key={i} style={{ borderRadius: 3, overflow: 'hidden', border: '1px solid var(--border)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`${c.nome} ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', aspectRatio: '3/4', display: 'block' }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
