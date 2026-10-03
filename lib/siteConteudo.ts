// Conteúdo editável do site público (02/10/2026).
// Fica salvo na tabela `configuracoes`, chave 'site_publico', como JSON (texto).
// Tudo que não foi editado usa os valores PADRAO abaixo — que são exatamente o que o site mostrava antes.

export type Etapa = { titulo: string; texto: string }
export type Destaque = { numero: string; texto: string }

export type SiteConteudo = {
  cores: { destaque: string; botao: string }
  topo: { imagemFundo: string; local: string; titulo: string; subtitulo: string; botao1: string; botao2: string }
  destaques: Destaque[]
  sobre: { etiqueta: string; nome: string; legendaFoto: string; foto: string; paragrafos: string[]; botao: string; galeria: string[] }
  metodo: { etiqueta: string; titulo: string; texto: string; etapas: Etapa[] }
  avaliacao: { etiqueta: string; titulo: string; texto: string; ferramentas: Etapa[] }
  experimental: { titulo: string; texto: string; botao: string }
  planos: { titulo: string; texto: string }
  horarios: { titulo: string; texto: string }
  local: { titulo: string; endereco: string; botao: string }
  rodape: { frase: string; instagram: string; linhaFinal: string }
}

export const CHAVE_SITE = 'site_publico'

export const PADRAO: SiteConteudo = {
  cores: { destaque: '#cfd8dc', botao: '#2F6FED' },
  topo: {
    imagemFundo: '/banner.png',
    local: 'CHATUBA / CAJU · RIO DE JANEIRO',
    titulo: 'Onde o seu resultado é nossa missão',
    subtitulo: 'Aulas de personal training de 1 hora, segunda a domingo. Planos mensais ou avulso no Pix — você escolhe o ritmo. Primeira aula é por nossa conta.',
    botao1: 'Marcar Aula Experimental Gratuita',
    botao2: 'Onde fica o estúdio?',
  },
  destaques: [
    { numero: '1h', texto: 'DE TREINO POR AULA' },
    { numero: '7', texto: 'DIAS POR SEMANA COM AULA' },
    { numero: '1ª', texto: 'AULA EXPERIMENTAL GRÁTIS' },
  ],
  sobre: {
    etiqueta: 'Quem está por trás do MFCT',
    nome: 'Matheus Feitosa',
    legendaFoto: 'Fundador · MFCT Estúdio',
    foto: '/sobre/IMG_3774.jpg',
    paragrafos: [
      'Minha paixão pelo fisiculturismo começou em 2011, aos 14 anos, numa academia de bairro. Sem dinheiro pra curso ou treinador, estudava sozinho: baixava vídeos e artigos em inglês lá de fora, traduzia como dava e tentava replicar os treinos. Aos 16, 17 anos, já tinha um físico que me destacava bastante entre os da minha idade.',
      'Foi nessa fase que me machuquei — não por erro no treino, mas por falta de segurança no equipamento: faltava um grampo na barra, a anilha escorregou e lesionei o ombro. Essa lesão me acompanhou por anos. Tentei voltar a treinar durante o tempo que servi na Marinha, mas a dor persistia. Foi lá, por ironia do destino, que fui trabalhar num centro esportivo — e acabei tendo contato direto com a preparação de atletas olímpicos durante as Olimpíadas, dando suporte aos profissionais que aplicavam os treinos.',
      'Depois da Marinha, entrei no ramo de suplementação e nutrição — e foi ali que a paixão pelo fisiculturismo voltou com força. Fui atrás de tratamento sério pro ombro (fisioterapia, massoterapia, liberação miofascial) e, enquanto isso, comecei a faculdade de Educação Física pra entender de verdade o que precisava mudar.',
      'Com o ombro recuperado e prestes a me formar, apliquei tudo que tinha aprendido: uma preparação de 2 meses, focada em reduzir gordura e preservar o máximo de massa muscular no menor tempo possível. Competi na categoria físico de praia, nível de entrada — um projeto que deu 100% certo. Decidi pausar os palcos ali, num ponto de virada, pra me dedicar à carreira, terminar a faculdade e construir algo maior.',
      'Esse algo maior é o MFCT Estúdio — onde continuo investindo em cursos, workshops e formações até hoje, aplicando todo esse conhecimento e método no treino de cada aluno.',
    ],
    botao: 'Treinar com o método MFCT',
    galeria: ['/sobre/IMG_3692.jpg', '/sobre/IMG_3821.jpg', '/sobre/IMG_6314.jpg', '/sobre/IMG_7669.jpg'],
  },
  metodo: {
    etiqueta: 'Método MFCT',
    titulo: 'Treino pensado pra sua realidade, não pra rotina perfeita',
    texto: 'A maioria dos métodos de treino foi pensada pra quem já tem rotina organizada, boa alimentação e sono em dia. Não é a realidade de quem trabalha 10+ horas por dia, pega transporte público e chega cansado em casa. Foi observando isso que o método MFCT nasceu: um treino seguro, eficiente e adaptado a quem mais precisa — sem copiar treino de internet, respeitando a individualidade de cada corpo.',
    etapas: [
      { titulo: 'Avaliação funcional', texto: 'Identificamos limitações de mobilidade, postura, equilíbrio e possíveis compensações musculares antes de qualquer treino pesado.' },
      { titulo: 'Correção do movimento', texto: 'O foco é aprender o padrão certo de cada exercício, no seu tempo — sem carga pesada ainda.' },
      { titulo: 'Fortalecimento da base', texto: 'Aumentamos a carga aos poucos, fortalecendo o que protege suas articulações e sua postura.' },
      { titulo: 'Capacidades físicas', texto: 'Equilíbrio, resistência, agilidade e controle corporal — a base pra qualquer objetivo mais complexo.' },
      { titulo: 'Seu objetivo', texto: 'Só depois da base pronta, focamos no que você realmente quer: emagrecimento, hipertrofia, condicionamento, qualidade de vida.' },
    ],
  },
  avaliacao: {
    etiqueta: 'Antes de começar',
    titulo: 'Avaliação física completa, incluída no seu plano',
    texto: 'Antes de montar seu treino, fazemos uma avaliação física completa — não é só olhômetro. Usamos equipamentos de verdade pra entender exatamente onde você está, medir sua composição corporal e acompanhar sua evolução com dados reais, mês a mês.',
    ferramentas: [
      { titulo: 'Bioimpedância', texto: 'Mede sua composição corporal — percentual de gordura, massa magra, água corporal — de forma rápida e precisa.' },
      { titulo: 'Adipômetro', texto: 'Medição das dobras cutâneas em pontos específicos do corpo, pra calcular o percentual de gordura corporal com precisão clínica.' },
      { titulo: 'Fita antropométrica', texto: 'Circunferências de braço, cintura, quadril, coxa e outros pontos — pra acompanhar a evolução real do seu corpo, não só o peso na balança.' },
    ],
  },
  experimental: {
    titulo: 'Não conhece o MFCT ainda?',
    texto: 'Marque uma aula experimental sem compromisso. Depois te chamamos pra saber o que achou e indicar o melhor plano pra você.',
    botao: 'Quero minha aula gratuita',
  },
  planos: { titulo: 'Planos', texto: 'Sem fidelidade, sem letra miúda. Escolha como prefere treinar.' },
  horarios: { titulo: 'Horários', texto: 'Confira os horários disponíveis. Pra agendar, fala com a gente no WhatsApp.' },
  local: {
    titulo: 'Onde estamos',
    endereco: 'Rua Vila Nova Esperança, nº 58 — Chatuba/Caju, Rio de Janeiro',
    botao: 'Falar no WhatsApp',
  },
  rodape: {
    frase: 'Onde o seu resultado é nossa missão',
    instagram: 'mfctestudio',
    linhaFinal: 'MFCT Estúdio © 2026 — Rua Vila Nova Esperança, nº 58, Chatuba/Caju, Rio de Janeiro',
  },
}

type Obj = Record<string, unknown>
const ehObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)

/** Junta o que foi salvo com o padrão: campo vazio ou faltando → usa o padrão. */
export function mesclar<T>(padrao: T, salvo: unknown): T {
  if (Array.isArray(padrao)) {
    if (!Array.isArray(salvo)) return padrao
    // Lista: se salvou, vale exatamente o que salvou (permite tirar/pôr itens e deixar texto vazio).
    const base = (padrao as unknown[])[0]
    if (ehObj(base)) {
      return salvo.filter(ehObj).map(item => {
        const o: Obj = {}
        for (const k of Object.keys(base)) o[k] = typeof item[k] === 'string' ? item[k] : ''
        return o
      }) as T
    }
    return salvo.filter(x => typeof x === 'string') as T
  }
  if (ehObj(padrao)) {
    const out: Obj = {}
    const s = ehObj(salvo) ? salvo : {}
    for (const k of Object.keys(padrao)) out[k] = mesclar((padrao as Obj)[k], s[k])
    return out as T
  }
  if (typeof padrao === 'string') return (typeof salvo === 'string' && salvo.trim() !== '' ? salvo : padrao) as T
  return (salvo ?? padrao) as T
}

export function lerConteudo(texto: string | null | undefined): SiteConteudo {
  if (!texto) return PADRAO
  try { return mesclar(PADRAO, JSON.parse(texto)) } catch { return PADRAO }
}

/** Só no servidor: lê o conteúdo salvo (usa a chave de serviço, nunca vai pro navegador). */
export async function carregarConteudoSite(): Promise<SiteConteudo> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return PADRAO
  try {
    const r = await fetch(`${url}/rest/v1/configuracoes?chave=eq.${CHAVE_SITE}&select=valor`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: 'no-store',
    })
    if (!r.ok) return PADRAO
    const linhas = (await r.json()) as { valor: string | null }[]
    return lerConteudo(linhas[0]?.valor)
  } catch {
    return PADRAO
  }
}
