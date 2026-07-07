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
                Minha paixão pelo fisiculturismo começou em 2014, aos 14 anos, numa academia de bairro. Sem
                dinheiro pra curso ou treinador, estudava sozinho: baixava vídeos e artigos em inglês lá de fora,
                traduzia como dava e tentava replicar os treinos. Aos 16, 17 anos, já tinha um físico que me
                destacava bastante entre os da minha idade.
              </p>
              <p>
                Foi nessa fase que me machuquei — não por erro no treino, mas por falta de segurança no
                equipamento: faltava um grampo na barra, a anilha escorregou e lesionei o ombro. Essa lesão me
                acompanhou por anos. Tentei voltar a treinar durante o tempo que servi na Marinha, mas a dor
                persistia. Foi lá, por ironia do destino, que fui trabalhar num centro esportivo — e acabei tendo
                contato direto com a preparação de atletas olímpicos durante as Olimpíadas, dando suporte aos
                profissionais que aplicavam os treinos.
              </p>
              <p>
                Depois da Marinha, entrei no ramo de suplementação e nutrição — e foi ali que a paixão pelo
                fisiculturismo voltou com força. Fui atrás de tratamento sério pro ombro (fisioterapia,
                massoterapia, liberação miofascial) e, enquanto isso, comecei a faculdade de Educação Física
                pra entender de verdade o que precisava mudar.
              </p>
              <p>
                Com o ombro recuperado e prestes a me formar, apliquei tudo que tinha aprendido: uma preparação de
                2 meses, focada em reduzir gordura e preservar o máximo de massa muscular no menor tempo possível.
                Competi na categoria físico de praia, nível de entrada — um projeto que deu 100% certo. Decidi
                pausar os palcos ali, num ponto de virada, pra me dedicar à carreira, terminar a faculdade e
                construir algo maior.
              </p>
              <p>
                Esse algo maior é o <strong style={{ color: 'var(--text)' }}>MFCT Estúdio</strong> — onde continuo
                investindo em cursos, workshops e formações até hoje, aplicando todo esse conhecimento e método no
                treino de cada aluno.
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
