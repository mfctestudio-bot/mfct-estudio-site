import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import PlanCards from '@/components/PlanCards'
import ScheduleGrid from '@/components/ScheduleGrid'
import Sobre from '@/components/Sobre'
import Metodologia from '@/components/Metodologia'
import { waLink, WA_MESSAGES } from '@/lib/whatsapp'
import { supabase, Post } from '@/lib/supabase'

export const revalidate = 0

async function getPosts(): Promise<Post[]> {
  const { data } = await supabase
    .from('posts')
    .select('*')
    .eq('publicado', true)
    .order('created_at', { ascending: false })
    .limit(3)
  return data || []
}

export default async function Home() {
  const posts = await getPosts()

  return (
    <>
      <Navbar />

      {/* HERO */}
      <section id="topo" style={{
        position: 'relative', minHeight: 480, display: 'flex', alignItems: 'center',
        backgroundImage: 'url(/banner.png)', backgroundSize: 'cover', backgroundPosition: 'center 30%',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(90deg, rgba(10,14,16,0.88) 25%, rgba(10,14,16,0.25) 100%)',
        }} />
        <div style={{ position: 'relative', maxWidth: 1100, margin: '0 auto', padding: '4rem 1.25rem', width: '100%' }}>
          <span style={{
            display: 'inline-block', color: 'var(--accent)', fontSize: 13, fontWeight: 800,
            letterSpacing: '2px', marginBottom: 12,
          }}>
            CHATUBA / CAJU · RIO DE JANEIRO
          </span>
          <h1 style={{ fontSize: 'clamp(2.4rem, 6vw, 4rem)', color: 'var(--text)', marginBottom: 12, maxWidth: 620 }}>
            Onde o seu resultado é nossa missão
          </h1>
          <p style={{ fontSize: 16, color: 'var(--text2)', maxWidth: 480, marginBottom: 28 }}>
            Aulas de personal training de 1 hora, segunda a domingo. Planos mensais ou
            avulso no Pix — você escolhe o ritmo. Primeira aula é por nossa conta.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <a href={waLink(WA_MESSAGES.experimental)} target="_blank" rel="noopener noreferrer"
              style={{
                background: 'var(--accent2)', color: '#fff', fontWeight: 800, fontSize: 14,
                padding: '14px 26px', borderRadius: 4, textDecoration: 'none', letterSpacing: '0.5px',
              }}>
              Marcar Aula Experimental Gratuita
            </a>
            <a href={waLink(WA_MESSAGES.endereco)} target="_blank" rel="noopener noreferrer"
              style={{
                border: '1px solid var(--border2)', color: 'var(--text)', fontWeight: 700, fontSize: 14,
                padding: '14px 26px', borderRadius: 4, textDecoration: 'none', letterSpacing: '0.5px',
                background: 'rgba(10,14,16,0.4)',
              }}>
              Onde fica o estúdio?
            </a>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '2.5rem 1.25rem 0' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14,
        }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontFamily: 'Anton, sans-serif', fontSize: 48, color: 'var(--accent)', lineHeight: 1 }}>1h</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8, letterSpacing: '0.5px' }}>DE TREINO POR AULA</div>
          </div>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontFamily: 'Anton, sans-serif', fontSize: 48, color: 'var(--accent)', lineHeight: 1 }}>7</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8, letterSpacing: '0.5px' }}>DIAS POR SEMANA COM AULA</div>
          </div>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontFamily: 'Anton, sans-serif', fontSize: 48, color: 'var(--accent)', lineHeight: 1 }}>1ª</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8, letterSpacing: '0.5px' }}>AULA EXPERIMENTAL GRÁTIS</div>
          </div>
        </div>
      </section>

      <Sobre />

      <Metodologia />

      {/* AULA EXPERIMENTAL */}
      <section id="experimental" style={{ maxWidth: 1100, margin: '0 auto', padding: '3rem 1.25rem 3rem' }}>
        <div style={{
          background: 'var(--card)', border: '1px solid var(--accent2)', borderRadius: 6, padding: '2rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24, flexWrap: 'wrap',
        }}>
          <div>
            <h2 style={{ fontSize: 28, color: 'var(--text)', marginBottom: 6 }}>
              Não conhece o MFCT ainda?
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text2)', maxWidth: 480 }}>
              Marque uma aula experimental sem compromisso. Depois te chamamos
              pra saber o que achou e indicar o melhor plano pra você.
            </p>
          </div>
          <a href={waLink(WA_MESSAGES.experimental)} target="_blank" rel="noopener noreferrer"
            style={{
              background: 'var(--accent2)', color: '#fff', fontWeight: 800, fontSize: 14,
              padding: '14px 28px', borderRadius: 4, textDecoration: 'none', letterSpacing: '0.5px',
              whiteSpace: 'nowrap',
            }}>
            Quero minha aula gratuita
          </a>
        </div>
      </section>

      {/* PLANOS */}
      <section id="planos" style={{ maxWidth: 1100, margin: '0 auto', padding: '1rem 1.25rem 3rem' }}>
        <h2 style={{ fontSize: 32, color: 'var(--text)', marginBottom: 6 }}>Planos</h2>
        <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 24 }}>
          Sem fidelidade, sem letra miúda. Escolha como prefere treinar.
        </p>
        <PlanCards />
      </section>

      {/* HORARIOS */}
      <section id="horarios" style={{ maxWidth: 1100, margin: '0 auto', padding: '1rem 1.25rem 3rem' }}>
        <h2 style={{ fontSize: 32, color: 'var(--text)', marginBottom: 6 }}>Horários</h2>
        <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 24 }}>
          Confira os horários disponíveis. Pra agendar, fala com a gente no WhatsApp.
        </p>
        <ScheduleGrid />
      </section>

      {/* DICAS / POSTS */}
      {posts.length > 0 && (
        <section id="dicas" style={{ maxWidth: 1100, margin: '0 auto', padding: '1rem 1.25rem 3rem' }}>
          <h2 style={{ fontSize: 32, color: 'var(--text)', marginBottom: 24 }}>Dicas do estúdio</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            {posts.map(post => (
              <div key={post.id} style={{
                background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6,
                overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                {post.imagem_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.imagem_url} alt={post.titulo} style={{ width: '100%', height: 140, objectFit: 'cover' }} />
                )}
                <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <h3 style={{ fontSize: 16, color: 'var(--text)' }}>{post.titulo}</h3>
                  <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>
                    {post.conteudo.slice(0, 140)}{post.conteudo.length > 140 ? '…' : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* LOCALIZACAO */}
      <section id="local" style={{ maxWidth: 1100, margin: '0 auto', padding: '1rem 1.25rem 4rem' }}>
        <div style={{
          background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6,
          padding: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: 24, flexWrap: 'wrap',
        }}>
          <div>
            <h2 style={{ fontSize: 28, color: 'var(--text)', marginBottom: 6 }}>Onde estamos</h2>
            <p style={{ fontSize: 14, color: 'var(--text2)' }}>
              Rua Vila Nova Esperança, nº 58 — Chatuba/Caju, Rio de Janeiro
            </p>
          </div>
          <a href={waLink(WA_MESSAGES.endereco)} target="_blank" rel="noopener noreferrer"
            style={{
              background: 'var(--accent2)', color: '#fff', fontWeight: 800, fontSize: 14,
              padding: '14px 26px', borderRadius: 4, textDecoration: 'none', letterSpacing: '0.5px',
              whiteSpace: 'nowrap',
            }}>
            Falar no WhatsApp
          </a>
        </div>
      </section>

      <Footer />
    </>
  )
}
