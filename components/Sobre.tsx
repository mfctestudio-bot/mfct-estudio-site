const GALERIA = [
  '/sobre/IMG_3692.jpg',
  '/sobre/IMG_3821.jpg',
  '/sobre/IMG_6314.jpg',
  '/sobre/IMG_7669.jpg',
]

export default function Sobre() {
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
                src="/sobre/IMG_3774.jpg"
                alt="Matheus Feitosa competindo em fisiculturismo"
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
                  Fundador · MFCT Estúdio
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
              Quem está por trás do MFCT
            </span>
            <h2 style={{ fontSize: 36, color: 'var(--text)', margin: '0.5rem 0 1.5rem' }}>
              Matheus Feitosa
            </h2>

            <div style={{ display: 'grid', gap: 16, fontSize: 15, lineHeight: 1.75, color: 'var(--text2)' }}>
              <p>
                Minha relação com o esporte de alto rendimento começa cedo — desde os 15 anos, atuando em centro
                esportivo durante a época das Olimpíadas, tive contato direto com atletas de diversas modalidades.
                Acompanhei de perto treinamento, alimentação, descanso e preparação de profissionais de alto nível.
                Foi ali que comecei a entender o que separa o treino comum do treino de performance.
              </p>
              <p>
                Meu sonho era competir na categoria físico de praia — um fisiculturismo natural e estético, focado
                em proporção, definição e postura, bem diferente do fisiculturismo clássico "bolado". Treinei
                pesado com esse objetivo — mas uma lesão no meio do caminho mudou minha trajetória. Em vez de
                desistir, usei aquilo como estímulo pra estudar ainda mais: nutrição, metodologia de treino,
                recuperação.
              </p>
              <p>
                Depois de mais de 15 anos entre estudo, prática em estúdios de treinamento personalizado e
                experiência de bastidores com esporte de alto rendimento, fundei o <strong style={{ color: 'var(--text)' }}>MFCT Estúdio</strong> pra
                aplicar tudo isso numa metodologia própria.
              </p>
              <p>
                Aqui, cada aluno passa por uma fase de observação — postura, comportamento, evolução e
                comprometimento — antes do treino se tornar individual, evoluindo dentro de um protocolo pensado
                especificamente pra performance máxima daquela pessoa.
              </p>
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
              Treinar com o método MFCT
            </a>
          </div>
        </div>

        {/* Galeria de competição */}
        <div
          className="grid grid-cols-2 md:grid-cols-5"
          style={{ gap: 8, marginTop: '3rem' }}
        >
          {GALERIA.map((src, i) => (
            <div key={i} style={{ borderRadius: 3, overflow: 'hidden', border: '1px solid var(--border)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Matheus Feitosa em competição de fisiculturismo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', aspectRatio: '3/4', display: 'block' }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
