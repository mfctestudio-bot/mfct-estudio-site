import { waLink, WA_MESSAGES } from '@/lib/whatsapp'
import { supabase, Plano, Servico } from '@/lib/supabase'

const DESCRICAO_SERVICO: Record<string, string> = {
  'Aula Avulsa': 'Sem plano fixo. Pague apenas pelos dias que vier treinar (Pix).',
  'Avaliação Física': 'Descubra sua taxa metabólica basal e monte um plano sob medida.',
}

function formatValor(v: number) {
  return Number(v).toFixed(2).replace('.', ',').replace(',00', '')
}

type CardData = {
  id: string
  nome: string
  valor: string
  periodo: string
  desc: string
  destaque: boolean
}

async function getPlanos(): Promise<CardData[]> {
  const [{ data: planosData }, { data: servicosData }] = await Promise.all([
    supabase.from('planos').select('*').eq('ativo', true).order('vezes_semana'),
    supabase.from('servicos').select('*').eq('ativo', true).order('created_at'),
  ])

  const planos = (planosData as Plano[] | null) || []
  const servicos = (servicosData as Servico[] | null) || []

  const cardsPlanos: CardData[] = planos.map((p, i) => ({
    id: p.id,
    nome: `${p.vezes_semana}x por semana`,
    valor: formatValor(p.valor),
    periodo: '/mês',
    desc: `Treine ${p.vezes_semana} vezes na semana, nos horários que tiver vaga.`,
    destaque: i === planos.length - 1, // o de mais vezes por semana fica em destaque
  }))

  const cardsServicos: CardData[] = servicos.map(s => ({
    id: s.id,
    nome: s.nome,
    valor: formatValor(s.valor),
    periodo: '/vez (Pix)',
    desc: DESCRICAO_SERVICO[s.nome] || 'Fale com a gente pelo WhatsApp pra saber mais.',
    destaque: false,
  }))

  return [...cardsPlanos, ...cardsServicos]
}

export default async function PlanCards() {
  const cards = await getPlanos()
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14,
    }}>
      {cards.map(p => (
        <div key={p.id} style={{
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
