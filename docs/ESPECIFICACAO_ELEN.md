# Especificação MFCT Estúdio + Elen IA

Documento de referência do sistema completo. Atualizado em 2026-06-13.

## Status geral por bloco

### ✅ Pronto e funcionando
- Status granular de lead/aluno (lead, experimental_oferecida/agendada/realizada, faltou_experimental, em_negociacao, perdido, ativo, vencido, cancelado) — Eleniria transiciona automaticamente
- Fluxo de aula experimental completo: lembrete 30min antes (cron) → follow-up pós-aula perguntando o que achou → marca experimental_realizada → Eleniria interpreta resposta (apresenta planos / marca perdido / oferece remarcar se faltou)
- Distinguir ex-aluno/lead retornando: quando telefone já tem cadastro cancelado/vencido/perdido/faltou_experimental, Eleniria recebe contexto "EX-ALUNO/LEAD RETORNANDO" e o backend protege contra regressão de status (ex-aluno pagante não pode ser rebaixado para "experimental_oferecida")
### ✅ Pronto e funcionando
- Status granular de lead/aluno (lead, experimental_oferecida/agendada/realizada, faltou_experimental, em_negociacao, perdido, ativo, vencido, cancelado) — Eleniria transiciona automaticamente
- Fluxo de aula experimental completo: lembrete 30min antes (cron) → follow-up pós-aula perguntando o que achou → marca experimental_realizada → Eleniria interpreta resposta (apresenta planos / marca perdido / oferece remarcar se faltou)
- Distinguir ex-aluno/lead retornando: quando telefone já tem cadastro cancelado/vencido/perdido/faltou_experimental, Eleniria recebe contexto "EX-ALUNO/LEAD RETORNANDO" e o backend protege contra regressão de status (ex-aluno pagante não pode ser rebaixado para "experimental_oferecida")
- Cobranças escalonadas: lembrete -7 dias, lembrete -3 dias, cobrança no dia do vencimento (gera link MP), atraso +1/+7 dias (reenvia link existente), +15 dias marca aluno como "vencido" e alerta o Matheus
- Campanha de recuperação 30/60/90 dias: aluno vencido/cancelado recebe mensagem de "sentimos sua falta" (30d), oferta de novos horários (60d), condição especial com desconto (90d) — controlado por status_desde (atualizado automaticamente por trigger) e etapa_recuperacao
- Lista de espera na agenda: se horário está cheio (capacidade real verificada no backend), aluno entra na lista_espera; ao cancelar uma aula, o primeiro da fila é notificado automaticamente
- Detecção de "chamar humano": reclamação grave, cobrança errada, pedido de reembolso/desconto fora do padrão, ou pedido explícito de atendente → Eleniria responde com frase curta e empática (sem investigar/prometer), aciona pausa automática (30min, mesmo mecanismo do takeover manual) e avisa o Matheus via WhatsApp com o motivo
- Matrícula direta (planos, coleta de dados, link Mercado Pago, ativação)
- Aluno ativo: agendar, cancelar, desmarcar, consultar vagas
- Financeiro: cobrança Mercado Pago, webhook de confirmação, painel com caixa mensal + gráfico anual
- Bloqueio de agendamento por mensalidade vencida (com geração automática de link)
- Bloqueio de agendamento de aula NORMAL para quem não tem plano ativo (status_plano != 'ativo'): Elen explica e oferece reativação/escolha de plano. Aula experimental nunca é bloqueada. Trava de segurança no backend independente da resposta do modelo (capacidade de 5 vagas por horário, valor padrão atualizado)
- Alunos ausentes: aviso após 7 dias sem agendar
- Horário fixo recorrente + lembrete de confirmação 2h antes
- Site institucional com captação de leads, posts/notícias
- Painel admin: agenda, alunos, financeiro, cancelamento de aula, grade de horários

### ⏳ Pendente
Nenhum item do roadmap original em aberto. Próximos passos ficam a critério de novas necessidades que surgirem no uso real.

### Notas técnicas importantes
- Há DOIS bancos distintos: Supabase (dados de negócio: alunos, agendamentos, pagamentos, lista_espera, etc.) e Postgres self-hosted da Cloudfy (apenas tabela bot_conversation_state, controla pausa humana — schema: bot_name, phone, last_human_reply_at, last_incoming_message, last_incoming_at). Não confundir os dois ao adicionar novas integrações.
- Pausa automática (chamar_humano) usa o node Postgres "Marcar Pausa Automatica" conectado em paralelo após "Executar Acoes Agenda", acionado via campo _pausarTelefone.

### Notas de qualidade do modelo
- O modelo (Llama 3.3 70B via Groq/OpenRouter) segue a maior parte das instruções de tom/contexto, mas não 100% consistentemente (ex: nem sempre menciona explicitamente "você já foi aluno"). Onde a transição de status é crítica para não perder dados (ex: ex-aluno pagante não regredir para lead novo), há trava de segurança no backend (Executar Acoes Agenda) independente do texto gerado.

## Mapa de fluxos (original)

flowchart TD
A[Entrada do contato] --> B[Elen IA identifica o tipo de pessoa]
B --> C{Tipo de contato}
C -->|Lead novo| D[Fluxo de captação]
C -->|Quer matrícula direta| E[Fluxo de matrícula direta]
C -->|Ex-aluno querendo voltar| F[Fluxo de reativação]
C -->|Aluno ativo| G[Fluxo de aluno ativo]
C -->|Aluno vencido/inativo| H[Fluxo de recuperação]
C -->|Caso complexo| I[Supervisor humano assume]

### 1. Tipos de usuários

**Leads** (ainda não são alunos): Novo lead, Aula experimental oferecida, Aula experimental agendada, Aula experimental realizada, Faltou experimental, Em negociação, Convertido em aluno, Perdido

**Alunos ativos**: Pagamento em dia, Horário fixo, Horário flexível, Aulas restantes, Frequência normal, Pouca frequência

**Alunos inadimplentes**: Vence hoje, 1/3/7/15 dias vencido, Bloqueado

**Alunos inativos/vencidos**: Cancelou, Não renovou, Sumiu, Ex-aluno recuperável, Reativado

### 2. Fluxo do lead novo

flowchart TD
A[Lead chama no WhatsApp/site/Instagram] --> B[Elen atende]
B --> C[Elen pergunta objetivo]
C --> D[Elen explica o estúdio]
D --> E[Elen oferece aula experimental]
E --> F[Elen consulta agenda]
F --> G[Oferece horário mais próximo disponível]
G --> H[Lead confirma]
H --> I[Sistema cria pré-cadastro]
I --> J[Elen envia confirmação]
J --> K[Elen lembra 30 min antes]
K --> L{Lead compareceu?}
L -->|Sim| M[Elen chama no mesmo dia]
M --> N[Pergunta o que achou]
N --> O{Gostou?}
O -->|Sim| P[Elen apresenta planos]
O -->|Não/dúvida| Q[Elen tira dúvidas ou chama humano]
L -->|Não| R[Elen oferece remarcar experimental]
R --> F

### 3. Fluxo de matrícula direta

flowchart TD
A[Pessoa quer se cadastrar de cara] --> B[Elen apresenta planos]
B --> C[Pessoa escolhe plano]
C --> D[Elen coleta dados]
D --> E[Sistema cria cadastro]
E --> F[Elen gera link Mercado Pago]
F --> G[Pessoa paga]
G --> H[Mercado Pago confirma]
H --> I[Sistema ativa aluno]
I --> J[Elen envia boas-vindas]
J --> K[Elen pergunta sobre horários fixos]
K --> L{Quer horário fixo?}
L -->|Sim| M[Sistema fixa dias e horários]
L -->|Não| N[Aluno agenda quando quiser]
M --> O[Elen envia link do grupo]
N --> O

### 4. Fluxo do ex-aluno querendo voltar

flowchart TD
A[Ex-aluno chama] --> B[Elen busca cadastro pelo telefone]
B --> C{Cadastro encontrado?}
C -->|Sim| D[Elen verifica histórico]
C -->|Não| E[Elen cria novo cadastro]
D --> F{Tem pendência?}
F -->|Sim| G[Elen informa pendência e envia link]
F -->|Não| H[Elen oferece retorno]
H --> I[Consulta horários antigos]
I --> J{Horários ainda disponíveis?}
J -->|Sim| K[Oferece mesmos horários]
J -->|Não| L[Oferece horários próximos]
K --> M[Escolhe plano]
L --> M
M --> N[Elen envia link Mercado Pago]
N --> O[Pagamento aprovado]
O --> P[Sistema reativa aluno]
P --> Q[Elen dá boas-vindas de volta]

### 5. Fluxo do aluno ativo

flowchart TD
A[Aluno ativo fala com Elen] --> B[Elen identifica solicitação]
B --> C{O que o aluno quer?}
C -->|Agendar aula| D[Elen consulta agenda]
D --> E[Marca aula]
C -->|Cancelar aula| F[Elen cancela]
F --> G[Libera vaga na agenda]
C -->|Remarcar aula| H[Elen cancela antiga]
H --> I[Oferece novos horários]
C -->|Ver aulas restantes| J[Elen consulta pacote/plano]
J --> K[Informa quantidade restante]
C -->|Informações| L[Elen responde usando base do sistema]
C -->|Problema especial| M[Humano assume]

### 6. Fluxo financeiro

flowchart TD
A[Plano escolhido] --> B[Elen gera cobrança]
B --> C[Mercado Pago]
C --> D{Pagamento aprovado?}
D -->|Sim| E[Sistema registra pagamento]
E --> F[Aluno ativo/liberado]
F --> G[Caixa mensal atualizado]
G --> H[Painel financeiro atualizado]
D -->|Não| I[Elen avisa pagamento pendente]
I --> J[Elen reenvia link]

Cobranças automáticas:

flowchart TD
A[Mensalidade próxima do vencimento] --> B[7 dias antes: lembrete]
B --> C[3 dias antes: lembrete]
C --> D[No dia: aviso de vencimento]
D --> E{Pagou?}
E -->|Sim| F[Sistema renova aluno]
E -->|Não| G[1 dia após: cobrança amigável]
G --> H[7 dias após: aviso mais firme]
H --> I[15 dias após: alerta administrativo]
I --> J[Possível bloqueio]

### 7. Fluxo de recuperação de alunos vencidos

flowchart TD
A[Aluno ficou inativo/vencido] --> B[Sistema move para área de vencidos]
B --> C[Elen inicia campanha]
C --> D[30 dias: sentimos sua falta]
D --> E[60 dias: oferece novos horários]
E --> F[90 dias: oferece condição especial]
F --> G{Aluno quer voltar?}
G -->|Sim| H[Fluxo de reativação]
G -->|Não| I[Mantém como inativo]

### 8. Agenda

A agenda precisa controlar: dias disponíveis, horários disponíveis, professor responsável, capacidade por horário, alunos fixos, alunos avulsos, aulas experimentais, cancelamentos, remarcações, lista de espera.

flowchart TD
A[Elen consulta agenda] --> B[Verifica vagas]
B --> C[Verifica professor]
C --> D[Verifica capacidade]
D --> E[Oferece melhor horário]
E --> F[Confirma agendamento]
F --> G[Registra no sistema]
G --> H[Envia lembrete automático]

### 9. Site integrado

Admin publica: notícias, novidades, promoções, eventos, fotos, depoimentos, informações do estúdio, página de captação de leads.

flowchart TD
A[Admin acessa painel] --> B[Publica notícia/promoção]
B --> C[Site exibe conteúdo]
C --> D[Visitante vê]
D --> E[Visitante chama no WhatsApp]
E --> F[Elen inicia atendimento]

### 10. Google Docs / Drive / Calendar

Apoio opcional (Docs: regras/contratos, Sheets: planilhas, Calendar: agenda, Drive: arquivos). Ideal é o sistema principal ter banco próprio (já temos via Supabase).

### 11. Painel administrativo

Deve mostrar: total de leads, leads em negociação, experimentais marcadas/realizadas, conversões, alunos ativos/vencidos, inadimplentes, receita do mês, lucro, caixa diário/mensal, aulas do dia, horários cheios/vagos.

### 12. O que a Elen faz

Atender leads, explicar planos, oferecer experimental, consultar agenda, agendar/cancelar/remarcar aula, lembrar 30min antes, fazer pós-aula, apresentar planos, enviar link Mercado Pago, confirmar pagamento, ativar aluno, dar boas-vindas, fixar horários, enviar link do grupo, cobrar mensalidade, avisar aulas restantes, dar parabéns, recuperar alunos vencidos, encaminhar para humano.

### 13. Quando chamar humano

Reclamação, pedido de desconto, problema no pagamento, reembolso, briga/situação delicada, aluno irritado, dúvida fora do padrão, negociação especial.

## Resumo final

flowchart TD
A[Lead / Aluno / Ex-aluno] --> B[Elen IA]
B --> C{Identifica situação}
C -->|Lead novo| D[Aula experimental]
C -->|Matrícula direta| E[Pagamento e ativação]
C -->|Aluno ativo| F[Agenda e suporte]
C -->|Inadimplente| G[Cobrança]
C -->|Ex-aluno| H[Reativação]
C -->|Caso complexo| I[Humano]
D --> J[Conversão]
J --> E
E --> K[Aluno ativo]
F --> K
G --> K
H --> K
K --> L[Retenção]
L --> M[Renovação mensal]
M --> N[Painel financeiro]
N --> O[Lucro / Caixa / Relatórios]
