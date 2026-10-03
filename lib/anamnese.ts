// Ficha de anamnese do MFCT Estúdio (03/10/2026).
// As respostas ficam em anamneses.respostas (jsonb) usando as CHAVES abaixo.
// A Elen usa exatamente essas chaves quando salva pela conversa no WhatsApp.
// Pra mudar/adicionar pergunta: mexa só aqui (a tabela não precisa mudar).

export type TipoPergunta = 'texto' | 'longo' | 'sim_nao'
export type Pergunta = { chave: string; pergunta: string; tipo: TipoPergunta; detalhe?: string }
export type Grupo = { titulo: string; perguntas: Pergunta[] }

export const ANAMNESE: Grupo[] = [
  {
    titulo: 'Dados pessoais',
    perguntas: [
      { chave: 'profissao', pergunta: 'Profissão', tipo: 'texto' },
      { chave: 'rotina_trabalho', pergunta: 'Como é a rotina de trabalho (horas por dia, em pé ou sentado)?', tipo: 'longo' },
      { chave: 'contato_emergencia', pergunta: 'Contato de emergência (nome e telefone)', tipo: 'texto' },
    ],
  },
  {
    titulo: 'Objetivo e histórico',
    perguntas: [
      { chave: 'objetivo', pergunta: 'Qual o seu objetivo com o treino?', tipo: 'longo' },
      { chave: 'atividade_atual', pergunta: 'Pratica alguma atividade física hoje? Qual e quantas vezes por semana?', tipo: 'longo' },
      { chave: 'historico_treino', pergunta: 'Já treinou antes? Por quanto tempo e quando parou?', tipo: 'longo' },
    ],
  },
  {
    titulo: 'Saúde',
    perguntas: [
      { chave: 'problema_cardiaco', pergunta: 'Algum médico já disse que você tem problema no coração?', tipo: 'sim_nao' },
      { chave: 'dor_peito', pergunta: 'Sente dor no peito durante esforço físico?', tipo: 'sim_nao' },
      { chave: 'tontura_desmaio', pergunta: 'Já teve tontura forte ou desmaio?', tipo: 'sim_nao' },
      { chave: 'pressao_alta', pergunta: 'Tem pressão alta?', tipo: 'sim_nao' },
      { chave: 'diabetes', pergunta: 'Tem diabetes?', tipo: 'sim_nao' },
      { chave: 'outras_doencas', pergunta: 'Tem alguma outra doença ou condição de saúde?', tipo: 'longo' },
      { chave: 'medicamentos', pergunta: 'Toma algum remédio? Qual?', tipo: 'longo' },
      { chave: 'gestante', pergunta: 'Está grávida ou teve bebê nos últimos 6 meses?', tipo: 'sim_nao', detalhe: 'Só pra alunas.' },
    ],
  },
  {
    titulo: 'Dores, lesões e limitações',
    perguntas: [
      { chave: 'dores_atuais', pergunta: 'Sente alguma dor hoje (costas, joelho, ombro...)? Onde?', tipo: 'longo' },
      { chave: 'lesoes_cirurgias', pergunta: 'Já teve lesão, fratura ou cirurgia? Qual e quando?', tipo: 'longo' },
      { chave: 'restricao_medica', pergunta: 'Algum médico já pediu pra evitar algum tipo de exercício?', tipo: 'longo' },
    ],
  },
  {
    titulo: 'Hábitos',
    perguntas: [
      { chave: 'sono', pergunta: 'Quantas horas dorme por noite? Dorme bem?', tipo: 'texto' },
      { chave: 'alimentacao', pergunta: 'Como é a sua alimentação no dia a dia?', tipo: 'longo' },
      { chave: 'agua', pergunta: 'Quanta água bebe por dia?', tipo: 'texto' },
      { chave: 'fumante', pergunta: 'Fuma?', tipo: 'sim_nao' },
      { chave: 'bebida_alcoolica', pergunta: 'Bebe bebida alcoólica? Com que frequência?', tipo: 'texto' },
    ],
  },
  {
    titulo: 'Observações',
    perguntas: [
      { chave: 'observacoes', pergunta: 'Algo mais que o professor precisa saber?', tipo: 'longo' },
    ],
  },
]

export const TODAS_PERGUNTAS = ANAMNESE.flatMap(g => g.perguntas)

/** Perguntas de saúde que, se responderem "sim", merecem atenção antes de treinar. */
export const ALERTAS = ['problema_cardiaco', 'dor_peito', 'tontura_desmaio', 'pressao_alta', 'diabetes', 'gestante']

export type Respostas = Record<string, string>

export function respondidas(r: Respostas) {
  return TODAS_PERGUNTAS.filter(p => (r[p.chave] || '').trim() !== '').length
}

export function alertasDe(r: Respostas) {
  return TODAS_PERGUNTAS.filter(p => ALERTAS.includes(p.chave) && /^s/i.test((r[p.chave] || '').trim()))
}
