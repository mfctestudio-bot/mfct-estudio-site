import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/api-auth'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tgpestsfhjrdahtzwodk.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// Correcao (23/09/2026): apontava pro Cloudfy antigo (ribbitingshoebill), abandonado --
// essa mensagem vinha falhando silenciosamente desde a migracao. Agora usa as mesmas
// variaveis de ambiente (EVO_URL/EVO_KEY) ja configuradas certinho no Vercel.
const EVO_URL = process.env.EVO_URL || ''
const EVO_KEY = process.env.EVO_KEY || ''
const SYNC_URL = 'https://wetgoose-n8n.cloudfy.live/webhook/mfct-sync-calendar'

const DIAS_NOMES = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

function somarDias(dataISO: string, dias: number) {
  const d = new Date(dataISO + 'T12:00:00')
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

type AlunoRef = { nome: string; telefone: string } | { nome: string; telefone: string }[] | null
function pegarAluno(a: AlunoRef) {
  return Array.isArray(a) ? a[0] : a
}

// Move o dia da semana de um horário INTEIRO, levando junto as aulas já
// confirmadas e os horários fixos que dependem dele. É a única rota
// autorizada a fazer isso -- não mexe direto em `agendamentos`/`horarios_fixos`
// por fora daqui, e reaproveita a mesma checagem de matrícula/período que o
// resto do sistema usa antes de confirmar cada aula na nova data.
export async function POST(req: NextRequest) {
  const authError = requireAdmin(req)
  if (authError) return authError
  if (!SERVICE_KEY) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor' }, { status: 500 })

  const { horario_id, novo_dia, avisar } = await req.json()
  if (!horario_id || novo_dia === undefined || novo_dia === null) {
    return NextResponse.json({ error: 'horario_id e novo_dia são obrigatórios' }, { status: 400 })
  }

  const supabase = createClient(SUPA_URL, SERVICE_KEY)

  const { data: horario } = await supabase.from('horarios').select('*').eq('id', horario_id).single()
  if (!horario) return NextResponse.json({ error: 'horário não encontrado' }, { status: 404 })
  if (horario.dia_semana === novo_dia) return NextResponse.json({ error: 'o horário já está nesse dia' }, { status: 400 })

  // Não deixa mover pra cima de um horário que já existe no dia de destino
  const { data: conflito } = await supabase
    .from('horarios')
    .select('id')
    .eq('dia_semana', novo_dia)
    .eq('horario', horario.horario)
    .neq('id', horario_id)
    .maybeSingle()
  if (conflito) {
    return NextResponse.json({ error: `já existe um horário das ${String(horario.horario).slice(0, 5)} em ${DIAS_NOMES[novo_dia]}` }, { status: 409 })
  }

  const hoje = hojeISO()
  const deltaDias = novo_dia - horario.dia_semana

  const { data: agendamentos } = await supabase
    .from('agendamentos')
    .select('id, aluno_id, data, tipo, google_event_id, alunos(nome, telefone)')
    .eq('horario_id', horario_id)
    .eq('status', 'confirmado')
    .gte('data', hoje)

  const movidos: { id: string; novaData: string; nome: string; telefone: string }[] = []
  const naoMovidos: { id: string; nome: string; motivo: string }[] = []

  for (const ag of agendamentos || []) {
    const aluno = pegarAluno(ag.alunos as AlunoRef)
    const novaData = somarDias(ag.data, deltaDias)

    if (novaData < hoje) {
      naoMovidos.push({ id: ag.id, nome: aluno?.nome || '?', motivo: 'nova data cairia no passado' })
      continue
    }

    // Confirma matrícula ativa + período vigente do aluno na nova data,
    // do mesmo jeito que qualquer remarcação manual já valida.
    const [{ data: alunoRow }, { data: periodos }] = await Promise.all([
      supabase.from('alunos').select('status_plano').eq('id', ag.aluno_id).single(),
      supabase.from('planos_periodos').select('data_inicio, data_fim').eq('aluno_id', ag.aluno_id),
    ])
    const periodoVigente = (periodos || []).some((p: { data_inicio: string; data_fim: string }) => p.data_inicio <= novaData && p.data_fim >= novaData)
    if (!alunoRow || alunoRow.status_plano !== 'ativo' || !periodoVigente) {
      naoMovidos.push({ id: ag.id, nome: aluno?.nome || '?', motivo: 'matrícula/período não cobre a nova data' })
      continue
    }

    const { error: updError } = await supabase.from('agendamentos').update({ data: novaData }).eq('id', ag.id)
    if (updError) {
      naoMovidos.push({ id: ag.id, nome: aluno?.nome || '?', motivo: updError.message })
      continue
    }

    try {
      await fetch(SYNC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'criar',
          agendamento_id: ag.id,
          aluno_nome: aluno?.nome || '',
          telefone: aluno?.telefone || '',
          data: novaData,
          horario: String(horario.horario).slice(0, 5),
          tipo: ag.tipo,
          origem: 'admin (horário movido de dia)',
        }),
      })
    } catch {}

    if (aluno?.telefone) movidos.push({ id: ag.id, novaData, nome: aluno.nome, telefone: aluno.telefone })
  }

  await supabase.from('horarios').update({ dia_semana: novo_dia }).eq('id', horario_id)

  const avisos: { telefone: string; ok: boolean; erro: string | null }[] = []
  if (avisar) {
    for (const m of movidos) {
      const dataFmt = new Date(m.novaData + 'T12:00:00').toLocaleDateString('pt-BR')
      const horaFmt = String(horario.horario).slice(0, 5)
      const msg = `Oi ${m.nome.split(' ')[0]}! Aqui é a Elen 🙏\n\nO Matheus mudou o dia da sua aula fixa das ${horaFmt} — a partir de agora ela passa a ser ${DIAS_NOMES[novo_dia]}. Sua próxima aula já fica marcada pra ${dataFmt} às ${horaFmt}. Qualquer dúvida é só chamar!`

      await supabase.from('mensagens_automaticas').insert({ telefone: m.telefone, origem: 'mover-horario-dia' })

      try {
        const resp = await fetch(`${EVO_URL}/message/sendText/MFCT-ESTUDIO`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
          body: JSON.stringify({ number: m.telefone, text: msg }),
        })
        let erro: string | null = null
        if (!resp.ok) {
          const corpo = await resp.text().catch(() => '')
          erro = `Evolution API respondeu ${resp.status}: ${corpo.slice(0, 300)}`
        } else {
          await supabase.from('bot_historico_conversas').insert({ phone: m.telefone, message: msg, role: 'assistant' })
        }
        avisos.push({ telefone: m.telefone, ok: resp.ok, erro })
      } catch (e) {
        avisos.push({ telefone: m.telefone, ok: false, erro: e instanceof Error ? e.message : 'falha desconhecida ao enviar WhatsApp' })
      }
    }
  }

  return NextResponse.json({
    ok: true,
    aulasMovidas: movidos.length,
    aulasNaoMovidas: naoMovidos,
    avisosEnviados: avisar ? avisos.filter(a => a.ok).length : 0,
  })
}
