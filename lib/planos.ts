const SUPA_URL = "https://tgpestsfhjrdahtzwodk.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRncGVzdHNmaGpyZGFodHp3b2RrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTI3NDcxMSwiZXhwIjoyMDk2ODUwNzExfQ.3IV7c7sFgbaYanjCqrSXXh6RVzBgsh4nU-2jPbWXTdE";
const headers = { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json' };

async function supaGet(path) {
  return await this.helpers.httpRequest({ method: 'GET', url: `${SUPA_URL}${path}`, headers, json: true });
}
async function supaPatch(path, body) {
  return await this.helpers.httpRequest({ method: 'PATCH', url: `${SUPA_URL}${path}`, headers, body, json: true });
}

const tzNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const hojeStr = fmt(tzNow);
const amanha = new Date(tzNow); amanha.setDate(amanha.getDate() + 1);
const amanhaStr = fmt(amanha);

const resultados = [];

// ===== 1) LEMBRETE 30MIN ANTES DA EXPERIMENTAL =====
try {
  const experimentaisHoje = await supaGet.call(this, `/rest/v1/agendamentos?tipo=eq.experimental&status=eq.confirmado&data=eq.${hojeStr}&lembrete_30min_enviado=eq.false&select=id,aluno_id,horarios(horario),alunos(nome,telefone)`);
  for (const ag of (Array.isArray(experimentaisHoje) ? experimentaisHoje : [])) {
    const horarioObj = Array.isArray(ag.horarios) ? ag.horarios[0] : ag.horarios;
    const alunoObj = Array.isArray(ag.alunos) ? ag.alunos[0] : ag.alunos;
    if (!horarioObj || !alunoObj || !alunoObj.telefone) continue;

    const [h, m] = horarioObj.horario.split(':').map(Number);
    const horarioAula = new Date(tzNow); horarioAula.setHours(h, m, 0, 0);
    const minutosParaAula = (horarioAula.getTime() - tzNow.getTime()) / 60000;

    if (minutosParaAula > 0 && minutosParaAula <= 35) {
      const primeiroNome = alunoObj.nome ? alunoObj.nome.split(' ')[0] : '';
      resultados.push({
        telefone: alunoObj.telefone,
        mensagem: `Oi ${primeiroNome}! Passando pra lembrar que sua aula experimental é daqui a pouco, às ${horarioObj.horario.slice(0,5)}. Te esperamos no MFCT Estúdio! 💪`,
      });
      await supaPatch.call(this, `/rest/v1/agendamentos?id=eq.${ag.id}`, { lembrete_30min_enviado: true });
    }
  }
} catch (e) {}

// ===== 2) FOLLOW-UP APÓS A EXPERIMENTAL (mesmo dia, 2h depois de terminar) =====
try {
  const experimentaisPassadas = await supaGet.call(this, `/rest/v1/agendamentos?tipo=eq.experimental&status=eq.confirmado&data=eq.${hojeStr}&follow_up_enviado=eq.false&select=id,aluno_id,horarios(horario),alunos(nome,telefone)`);
  for (const ag of (Array.isArray(experimentaisPassadas) ? experimentaisPassadas : [])) {
    const horarioObj = Array.isArray(ag.horarios) ? ag.horarios[0] : ag.horarios;
    const alunoObj = Array.isArray(ag.alunos) ? ag.alunos[0] : ag.alunos;
    if (!horarioObj || !alunoObj || !alunoObj.telefone) continue;

    const [h, m] = horarioObj.horario.split(':').map(Number);
    const horarioAula = new Date(tzNow); horarioAula.setHours(h, m, 0, 0);
    const minutosDesdeAula = (tzNow.getTime() - horarioAula.getTime()) / 60000;

    if (minutosDesdeAula >= 120) {
      const primeiroNome = alunoObj.nome ? alunoObj.nome.split(' ')[0] : '';
      resultados.push({
        telefone: alunoObj.telefone,
        mensagem: `Oi ${primeiroNome}! E aí, gostou da experimental de hoje? 😊 Se quiser continuar treinando com a gente, posso te mostrar os planos disponíveis. Qualquer dúvida, só chamar!`,
      });
      await supaPatch.call(this, `/rest/v1/agendamentos?id=eq.${ag.id}`, { follow_up_enviado: true });
    }
  }
} catch (e) {}

// ===== 3) CONFIRMAÇÃO DE AULA FIXA (avisa no dia anterior à noite) =====
if (tzNow.getHours() >= 18) {
  try {
    const aulasAmanha = await supaGet.call(this, `/rest/v1/agendamentos?tipo=eq.aula&status=eq.confirmado&data=eq.${amanhaStr}&confirmacao_enviada=eq.false&select=id,aluno_id,horarios(horario),alunos(nome,telefone)`);
    for (const ag of (Array.isArray(aulasAmanha) ? aulasAmanha : [])) {
      const horarioObj = Array.isArray(ag.horarios) ? ag.horarios[0] : ag.horarios;
      const alunoObj = Array.isArray(ag.alunos) ? ag.alunos[0] : ag.alunos;
      if (!horarioObj || !alunoObj || !alunoObj.telefone) continue;

      const primeiroNome = alunoObj.nome ? alunoObj.nome.split(' ')[0] : '';
      resultados.push({
        telefone: alunoObj.telefone,
        mensagem: `Oi ${primeiroNome}! Lembrete da sua aula amanhã às ${horarioObj.horario.slice(0,5)}. Te esperamos! Se não puder ir, me avisa por aqui 🙏`,
      });
      await supaPatch.call(this, `/rest/v1/agendamentos?id=eq.${ag.id}`, { confirmacao_enviada: true });
    }
  } catch (e) {}
}

// ===== 4) AVISO PRO MATHEUS: COMPROVANTE ESPERANDO CONFIRMAÇÃO HÁ MUITO TEMPO =====
// Novo (23/09/2026): avisa uma unica vez (aviso_atraso_confirmacao_enviado) quando um
// comprovante fica mais de 6h esperando confirmacao manual, pra nao depender do Matheus
// lembrar de checar a tela de pagamentos sozinho.
const NUMERO_MATHEUS = "5521981037108";
try {
  const seisHorasAtras = new Date(tzNow.getTime() - 6 * 60 * 60 * 1000).toISOString();
  const pendentes = await supaGet.call(this, `/rest/v1/pagamentos?status=eq.aguardando_confirmacao&aviso_atraso_confirmacao_enviado=eq.false&comprovante_recebido_em=lt.${seisHorasAtras}&select=id,valor,comprovante_recebido_em,alunos(nome)`);
  for (const p of (Array.isArray(pendentes) ? pendentes : [])) {
    const aluno = Array.isArray(p.alunos) ? p.alunos[0] : p.alunos;
    const horasEsperando = Math.floor((tzNow.getTime() - new Date(p.comprovante_recebido_em).getTime()) / 3600000);
    resultados.push({
      telefone: NUMERO_MATHEUS,
      mensagem: `⏳ Comprovante de ${aluno?.nome || 'aluno'} (R$${p.valor}) esperando confirmação há ${horasEsperando}h. Dá uma olhada na tela de Pagamentos.`,
    });
    await supaPatch.call(this, `/rest/v1/pagamentos?id=eq.${p.id}`, { aviso_atraso_confirmacao_enviado: true });
  }
} catch (e) {}

// ===== 5) SUGESTÃO DE REAVALIAÇÃO FÍSICA (proativo, 1x/dia às 10h) =====
// Novo (23/09/2026): mesma regra de 60 dias que a Elen ja usa pra sugerir reavaliacao
// quando o aluno chama no chat (ver Montar Contexto Agenda) -- so que agora manda por
// iniciativa propria, em vez de esperar o aluno mandar mensagem primeiro.
if (tzNow.getHours() === 10) {
  try {
    const ativosAval = await supaGet.call(this, `/rest/v1/alunos?status_plano=eq.ativo&select=id,nome,telefone,ultimo_lembrete_avaliacao_em`);
    for (const aluno of (Array.isArray(ativosAval) ? ativosAval : [])) {
      if (!aluno.telefone) continue;
      if (aluno.ultimo_lembrete_avaliacao_em === hojeStr) continue;

      const ultimaAval = await supaGet.call(this, `/rest/v1/avaliacoes?aluno_id=eq.${aluno.id}&status=eq.realizada&order=data.desc&limit=1&select=data`);
      let devesSugerir = false;
      if (!Array.isArray(ultimaAval) || !ultimaAval.length) {
        devesSugerir = true; // nunca fez avaliacao
      } else {
        const diasDesdeUltima = Math.floor((tzNow.getTime() - new Date(ultimaAval[0].data + 'T00:00:00').getTime()) / 86400000);
        devesSugerir = diasDesdeUltima > 60;
      }
      if (!devesSugerir) continue;

      const primeiroNome = aluno.nome ? aluno.nome.split(' ')[0] : '';
      resultados.push({
        telefone: aluno.telefone,
        mensagem: `Oi ${primeiroNome}! Já faz um tempo desde sua última avaliação física (ou você ainda não fez uma) 🙂 Quer marcar uma pra acompanhar sua evolução? É só me falar um dia que funciona pra você.`,
      });
      await supaPatch.call(this, `/rest/v1/alunos?id=eq.${aluno.id}`, { ultimo_lembrete_avaliacao_em: hojeStr });
    }
  } catch (e) {}
}

// ===== 6) PARABÉNS DE ANIVERSÁRIO (proativo, 1x/dia às 9h) =====
if (tzNow.getHours() === 9) {
  try {
    const mesHoje = String(tzNow.getMonth() + 1).padStart(2, '0');
    const diaHoje = String(tzNow.getDate()).padStart(2, '0');
    const ativosAniv = await supaGet.call(this, `/rest/v1/alunos?status_plano=eq.ativo&data_nascimento=not.is.null&select=id,nome,telefone,data_nascimento,ultimo_parabens_enviado`);
    for (const aluno of (Array.isArray(ativosAniv) ? ativosAniv : [])) {
      if (!aluno.telefone || !aluno.data_nascimento) continue;
      if (aluno.ultimo_parabens_enviado === hojeStr) continue;
      const [, mesNasc, diaNasc] = aluno.data_nascimento.split('-');
      if (mesNasc !== mesHoje || diaNasc !== diaHoje) continue;

      const primeiroNome = aluno.nome ? aluno.nome.split(' ')[0] : '';
      resultados.push({
        telefone: aluno.telefone,
        mensagem: `Parabéns, ${primeiroNome}! 🎉🎂 Toda a equipe do MFCT Estúdio deseja um feliz aniversário pra você. Continue treinando firme! 💪`,
      });
      await supaPatch.call(this, `/rest/v1/alunos?id=eq.${aluno.id}`, { ultimo_parabens_enviado: hojeStr });
    }
  } catch (e) {}
}

return resultados.map(r => ({ json: r }));
