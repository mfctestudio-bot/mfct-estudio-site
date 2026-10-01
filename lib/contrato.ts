// Modelo padrão do contrato + termo de responsabilidade (01/10/2026).
// Fica salvo em configuracoes.modelo_contrato e é editável na tela /admin/contratos.
// Os campos entre {{ }} são trocados pelos dados do aluno na hora de gerar.
// Trechos marcados com [AJUSTAR] são sugestões que o Matheus precisa revisar.

export const CAMPOS_CONTRATO: { chave: string; descricao: string }[] = [
  { chave: 'nome', descricao: 'Nome completo do aluno' },
  { chave: 'cpf', descricao: 'CPF do aluno' },
  { chave: 'data_nascimento', descricao: 'Data de nascimento' },
  { chave: 'telefone', descricao: 'Telefone do aluno' },
  { chave: 'plano', descricao: 'Nome do plano' },
  { chave: 'vezes_semana', descricao: 'Aulas por semana do plano' },
  { chave: 'valor', descricao: 'Valor mensal do plano' },
  { chave: 'dia_vencimento', descricao: 'Dia de vencimento' },
  { chave: 'data_inicio', descricao: 'Início do período atual' },
  { chave: 'data_fim', descricao: 'Fim do período atual' },
  { chave: 'data_hoje', descricao: 'Data de hoje' },
]

export const MODELO_CONTRATO_PADRAO = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE TREINAMENTO FÍSICO

CONTRATADA: MFCT Estúdio, representada por Ronald Matheus Feitosa da Silva, com endereço na Rua Vila Nova Esperança, 58, Caju, Rio de Janeiro/RJ. CPF/CNPJ: ____________________ [AJUSTAR]

CONTRATANTE (ALUNO): {{nome}}, CPF {{cpf}}, nascido(a) em {{data_nascimento}}, telefone {{telefone}}.

As partes acima acordam o seguinte:

1. OBJETO
O MFCT Estúdio prestará ao(à) aluno(a) serviço de treinamento físico com acompanhamento profissional, no {{plano}}, com {{vezes_semana}} aulas por semana, nos dias e horários agendados pelo sistema do estúdio.

2. VALOR E PAGAMENTO
2.1. O valor mensal do plano é de {{valor}}, com vencimento todo dia {{dia_vencimento}}.
2.2. O pagamento pode ser feito por Pix ou cartão, nos canais oficiais do estúdio. O acesso às aulas fica liberado após a confirmação do pagamento.
2.3. Em caso de atraso, o acesso aos horários (fixos ou avulsos) fica suspenso até a regularização. Se o atraso passar do prazo de carência do estúdio, o plano pode ser cancelado e os horários fixos liberados para outros alunos. [AJUSTAR: prazo de carência]

3. VIGÊNCIA
3.1. Este contrato vale por prazo indeterminado, renovando-se a cada pagamento mensal. Período atual: de {{data_inicio}} a {{data_fim}}.
3.2. O(a) aluno(a) pode cancelar a qualquer momento, avisando o estúdio. Valores já pagos referentes ao período em andamento não são devolvidos. [AJUSTAR]

4. AULAS, HORÁRIOS E REMARCAÇÕES
4.1. As aulas acontecem nos horários disponíveis na agenda do estúdio, respeitando o limite de vagas de cada horário.
4.2. O número de aulas por semana é o do plano contratado. Aulas não utilizadas na semana não acumulam para semanas seguintes. [AJUSTAR]
4.3. Cancelamentos e remarcações devem ser feitos com antecedência pelo WhatsApp do estúdio. [AJUSTAR: antecedência mínima]

5. OBRIGAÇÕES DO ALUNO
5.1. Seguir as orientações do professor e as regras de uso do espaço e dos equipamentos.
5.2. Informar ao estúdio qualquer alteração no seu estado de saúde.
5.3. Zelar pelos equipamentos, respondendo por danos causados por mau uso.

6. OBRIGAÇÕES DO ESTÚDIO
6.1. Oferecer acompanhamento profissional durante as aulas.
6.2. Manter o espaço e os equipamentos em condições adequadas de uso.

7. USO DE IMAGEM [AJUSTAR: manter ou retirar]
O(a) aluno(a) ( ) autoriza ( ) não autoriza o uso de sua imagem em fotos e vídeos feitos no estúdio para divulgação nas redes sociais do MFCT Estúdio, sem custo.

8. DADOS PESSOAIS
Os dados do(a) aluno(a) são usados somente para cadastro, agendamento, cobrança e acompanhamento da evolução, conforme a Lei Geral de Proteção de Dados (LGPD).

9. FORO
Fica eleito o foro da Comarca do Rio de Janeiro/RJ para resolver qualquer questão deste contrato.

Rio de Janeiro, {{data_hoje}}.


_____________________________________
{{nome}} — Aluno(a)


_____________________________________
MFCT Estúdio — Ronald Matheus Feitosa da Silva


==== QUEBRA DE PÁGINA ====


TERMO DE RESPONSABILIDADE E DECLARAÇÃO DE SAÚDE

Eu, {{nome}}, CPF {{cpf}}, declaro que:

1. Estou em condições de saúde adequadas para praticar atividade física e não tenho conhecimento de nenhuma restrição médica que me impeça de treinar, ou, se tenho, informei ao estúdio por escrito.

2. Fui orientado(a) a procurar um médico para avaliação antes de iniciar ou intensificar a prática de exercícios, especialmente em caso de doença cardíaca, pressão alta, diabetes, lesões, cirurgias recentes, gravidez ou uso de medicamentos contínuos.

3. Vou informar imediatamente ao professor qualquer dor, mal-estar, tontura, falta de ar ou outro sintoma durante o treino, e interromper o exercício quando orientado.

4. Respondi com verdade à ficha de anamnese do estúdio e vou atualizar essas informações sempre que houver mudança no meu estado de saúde.

5. Estou ciente de que a atividade física envolve esforço e riscos naturais, e assumo a responsabilidade por informações de saúde omitidas ou incorretas e por exercícios feitos por conta própria, sem orientação do professor.

Rio de Janeiro, {{data_hoje}}.


_____________________________________
{{nome}}`

export function preencherContrato(modelo: string, dados: Record<string, string>) {
  return modelo.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, chave: string) => {
    const v = dados[chave]
    return v && v.trim() ? v : '____________________'
  })
}
