// Ponte MFCT → CyberNutri (21/10/2026, pedido do Matheus).
// O CyberNutri tem o próprio banco (Supabase "cyberfit") e não lê o banco do estúdio.
// Quem manda os dados é o estúdio, por esta porta de entrada (webhook do workflow
// "CyberFit Nutri" no n8n). Dois eventos:
//  - 'indicacao': aluno terminou a anamnese e topou fazer a avaliação física (vem pela Elen).
//  - 'avaliacao_finalizada': o Matheus finalizou a avaliação no painel (botão 🥗).
// O CyberNutri identifica aluno e avaliação pelos ids do estúdio (studio_student_id /
// studio_assessment_id), então mandar duas vezes não duplica nada lá.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = any

export const CYBERNUTRI_URL = 'https://wetgoose-n8n.cloudfy.live/webhook/cybernutri-entrada'
const SITE = 'https://mfct-estudio-site.vercel.app'

export async function montarPacote(sb: Sb, alunoId: string, avaliacaoId?: string) {
  const { data: aluno } = await sb.from('alunos').select('id, nome, telefone, data_nascimento').eq('id', alunoId).maybeSingle()
  if (!aluno) return null
  const { data: ficha } = await sb.from('anamneses').select('respostas, status, atualizado_em')
    .eq('aluno_id', alunoId).order('atualizado_em', { ascending: false }).limit(1).maybeSingle()
  let avaliacao = null
  if (avaliacaoId) {
    const { data: av } = await sb.from('avaliacoes')
      .select('id, data, peso, imc, gordura_corporal_pct, gordura_visceral, massa_muscular_pct, idade_metabolica, nivel_atividade, objetivo, observacoes, medidas')
      .eq('id', avaliacaoId).eq('aluno_id', alunoId).maybeSingle()
    if (!av) return null
    avaliacao = { ...av, studio_assessment_id: av.id }
  }
  return {
    aluno: {
      studio_student_id: aluno.id,
      nome: aluno.nome,
      telefone: aluno.telefone,
      data_nascimento: aluno.data_nascimento,
    },
    anamnese: ficha ? { respostas: ficha.respostas || {}, completa: ficha.status === 'completa', atualizada_em: ficha.atualizado_em } : null,
    avaliacao,
    links: avaliacao ? { pdf_avaliacao_admin: `${SITE}/api/pdf?tipo=avaliacao&id=${avaliacao.id}` } : {},
  }
}

export async function enviarParaCyberNutri(evento: 'indicacao' | 'avaliacao_finalizada', pacote: object) {
  try {
    const resp = await fetch(CYBERNUTRI_URL, {
      method: 'POST',
      // Mesmo segredo da rota /api/cybernutri-perfil: o CyberNutri pode conferir que veio do estúdio.
      headers: { 'Content-Type': 'application/json', ...(process.env.CYBERNUTRI_TOKEN ? { 'x-cybernutri-token': process.env.CYBERNUTRI_TOKEN } : {}) },
      body: JSON.stringify({ evento, origem: 'mfct-estudio', enviado_em: new Date().toISOString(), ...pacote }),
    })
    return { ok: resp.ok, status: resp.status }
  } catch (e) {
    return { ok: false, status: 0, erro: e instanceof Error ? e.message : 'falha' }
  }
}
