import type { SiteConteudo } from '@/lib/siteConteudo'

export default function Metodologia({ c }: { c: SiteConteudo['metodo'] }) {
  return (
    <section id="metodologia" style={{ maxWidth: 1100, margin: '0 auto', padding: '1rem 1.25rem 3.5rem' }}>
      <span style={{
        fontSize: 12, fontWeight: 800, color: 'var(--accent2)', letterSpacing: '2px',
        textTransform: 'uppercase' as const,
      }}>
        {c.etiqueta}
      </span>
      <h2 style={{ fontSize: 32, color: 'var(--text)', margin: '0.5rem 0 1.25rem' }}>
        {c.titulo}
      </h2>

      <p style={{ fontSize: 15, lineHeight: 1.75, color: 'var(--text2)', maxWidth: 720, marginBottom: '2rem' }}>
        {c.texto}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-5" style={{ gap: 16 }}>
        {c.etapas.map((etapa, i) => (
          <div key={i} style={{
            background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, padding: '1.25rem',
          }}>
            <div style={{ fontFamily: 'Anton, sans-serif', fontSize: 28, color: 'var(--accent)', marginBottom: 8 }}>
              {String(i + 1).padStart(2, '0')}
            </div>
            <h3 style={{ fontSize: 14, color: 'var(--text)', marginBottom: 8, fontWeight: 700 }}>
              {etapa.titulo}
            </h3>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text2)' }}>
              {etapa.texto}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
