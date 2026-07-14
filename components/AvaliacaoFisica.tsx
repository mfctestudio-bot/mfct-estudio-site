const FERRAMENTAS = [
  {
    titulo: 'Bioimpedância',
    texto: 'Mede sua composição corporal — percentual de gordura, massa magra, água corporal — de forma rápida e precisa.',
  },
  {
    titulo: 'Adipômetro',
    texto: 'Medição das dobras cutâneas em pontos específicos do corpo, pra calcular o percentual de gordura corporal com precisão clínica.',
  },
  {
    titulo: 'Fita antropométrica',
    texto: 'Circunferências de braço, cintura, quadril, coxa e outros pontos — pra acompanhar a evolução real do seu corpo, não só o peso na balança.',
  },
]

export default function AvaliacaoFisica() {
  return (
    <section id="avaliacao" style={{ maxWidth: 1100, margin: '0 auto', padding: '1rem 1.25rem 3.5rem' }}>
      <span style={{
        fontSize: 12, fontWeight: 800, color: 'var(--accent2)', letterSpacing: '2px',
        textTransform: 'uppercase' as const,
      }}>
        Antes de começar
      </span>
      <h2 style={{ fontSize: 32, color: 'var(--text)', margin: '0.5rem 0 1.25rem' }}>
        Avaliação física completa, incluída no seu plano
      </h2>

      <p style={{ fontSize: 15, lineHeight: 1.75, color: 'var(--text2)', maxWidth: 720, marginBottom: '2rem' }}>
        Antes de montar seu treino, fazemos uma avaliação física completa — não é só olhômetro. Usamos
        equipamentos de verdade pra entender exatamente onde você está, medir sua composição corporal e
        acompanhar sua evolução com dados reais, mês a mês.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 16 }}>
        {FERRAMENTAS.map(f => (
          <div key={f.titulo} style={{
            background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, padding: '1.25rem',
          }}>
            <h3 style={{ fontSize: 15, color: 'var(--text)', marginBottom: 8, fontWeight: 700 }}>
              {f.titulo}
            </h3>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text2)' }}>
              {f.texto}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
