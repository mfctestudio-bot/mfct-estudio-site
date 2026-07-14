import { waLink, WA_MESSAGES } from '@/lib/whatsapp'

const PLANOS = [
  {
    nome: '3x por semana',
    valor: '129,90',
    periodo: '/mês',
    desc: 'Treine três vezes na semana, nos horários que tiver vaga.',
    destaque: false,
  },
  {
    nome: '4x por semana',
    valor: '169,90',
    periodo: '/mês',
    desc: 'Treine quatro vezes na semana — mais consistência, mais resultado.',
    destaque: true,
  },
  {
    nome: 'Aula avulsa',
    valor: '15',
    periodo: '/aula (Pix)',
    desc: 'Sem plano fixo. Pague apenas pelos dias que vier treinar.',
    destaque: false,
  },
  {
    nome: 'Avulsa — fim de semana',
    valor: '30',
    periodo: '/aula (Pix)',
    desc: 'Sábado e domingo, das 8h ao meio-dia.',
    destaque: false,
  },
]

export default function PlanCards() {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14,
    }}>
      {PLANOS.map(p => (
        <div key={p.nome} style={{
          background: 'var(--card)',
          border: `1px solid ${p.destaque ? 'var(--accent2)' : 'var(--border)'}`,
          borderRadius: 6, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: 12,
          position: 'relative',
        }}>
          {p.destaque && (
            <span style={{
              position: 'absolute', top: -10, left: '1.5rem',
              background: 'var(--accent2)', color: '#fff',
              fontSize: 11, fontWeight: 800, padding: '2px 10px', borderRadius: 3,
              letterSpacing: '0.5px',
            }}>
              MAIS ESCOLHIDO
            </span>
          )}
          <h3 style={{ fontSize: 18, color: 'var(--text)' }}>{p.nome}</h3>
          <div>
            <span style={{ fontFamily: 'Anton, sans-serif', fontSize: 32, color: 'var(--accent)' }}>
              R$ {p.valor}
            </span>
            <span style={{ fontSize: 13, color: 'var(--text2)' }}> {p.periodo}</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text2)', flex: 1 }}>{p.desc}</p>
          <a
            href={waLink(WA_MESSAGES.matricula)}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block', textAlign: 'center', padding: '10px 0',
              background: p.destaque ? 'var(--accent2)' : 'transparent',
              color: p.destaque ? '#fff' : 'var(--text)',
              border: `1px solid ${p.destaque ? 'var(--accent2)' : 'var(--border2)'}`,
              borderRadius: 4, fontWeight: 700, fontSize: 13, textDecoration: 'none',
              letterSpacing: '0.5px',
            }}
          >
            Falar no WhatsApp
          </a>
        </div>
      ))}
    </div>
  )
}
