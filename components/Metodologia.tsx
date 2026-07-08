const ETAPAS = [
  {
    numero: '01',
    titulo: 'Avaliação funcional',
    texto: 'Identificamos limitações de mobilidade, postura, equilíbrio e possíveis compensações musculares antes de qualquer treino pesado.',
  },
  {
    numero: '02',
    titulo: 'Correção do movimento',
    texto: 'O foco é aprender o padrão certo de cada exercício, no seu tempo — sem carga pesada ainda.',
  },
  {
    numero: '03',
    titulo: 'Fortalecimento da base',
    texto: 'Aumentamos a carga aos poucos, fortalecendo o que protege suas articulações e sua postura.',
  },
  {
    numero: '04',
    titulo: 'Capacidades físicas',
    texto: 'Equilíbrio, resistência, agilidade e controle corporal — a base pra qualquer objetivo mais complexo.',
  },
  {
    numero: '05',
    titulo: 'Seu objetivo',
    texto: 'Só depois da base pronta, focamos no que você realmente quer: emagrecimento, hipertrofia, condicionamento, qualidade de vida.',
  },
]

export default function Metodologia() {
  return (
    <section id="metodologia" style={{ maxWidth: 1100, margin: '0 auto', padding: '1rem 1.25rem 3.5rem' }}>
      <span style={{
        fontSize: 12, fontWeight: 800, color: 'var(--accent2)', letterSpacing: '2px',
        textTransform: 'uppercase' as const,
      }}>
        Método MFCT
      </span>
      <h2 style={{ fontSize: 32, color: 'var(--text)', margin: '0.5rem 0 1.25rem' }}>
        Treino pensado pra sua realidade, não pra rotina perfeita
      </h2>

      <p style={{ fontSize: 15, lineHeight: 1.75, color: 'var(--text2)', maxWidth: 720, marginBottom: '2rem' }}>
        A maioria dos métodos de treino foi pensada pra quem já tem rotina organizada, boa alimentação e sono em
        dia. Não é a realidade de quem trabalha 10+ horas por dia, pega transporte público e chega cansado em
        casa. Foi observando isso que o método MFCT nasceu: um treino seguro, eficiente e adaptado a quem mais
        precisa — sem copiar treino de internet, respeitando a individualidade de cada corpo.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-5" style={{ gap: 16 }}>
        {ETAPAS.map(etapa => (
          <div key={etapa.numero} style={{
            background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, padding: '1.25rem',
          }}>
            <div style={{ fontFamily: 'Anton, sans-serif', fontSize: 28, color: 'var(--accent)', marginBottom: 8 }}>
              {etapa.numero}
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
