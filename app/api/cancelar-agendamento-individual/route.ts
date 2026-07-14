import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tgpestsfhjrdahtzwodk.supabase.co'
const SUPA_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const EVO_URL = 'https://ribbitingshoebill-evolution.cloudfy.live'
const EVO_KEY = 'MMxqYf3msawylWCBW2PSU4uUdJAY6mL3'

export async function POST(req: NextRequest) {
  const { agendamento_id } = await req.json()
  if (!agendamento_id) return NextResponse.json({ error: 'agendamento_id required' }, { status: 400 })

  const supabase = createClient(SUPA_URL, SUPA_SERVICE_KEY)

  const { data: agendamento } = await supabase
    .from('agendamentos')
    .select('id, data, alunos(nome, telefone), horarios(horario)')
    .eq('id', agendamento_id)
    .single()

  if (!agendamento) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })

  await supabase.from('agendamentos').update({ status: 'cancelado' }).eq('id', agendamento_id)

  // Cancela o evento no Google Calendar
  try {
    await fetch('https://primary-production-4716.up.railway.app/webhook/mfct-sync-calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'cancelar', agendamento_id }),
    })
  } catch {}

  // Avisa o aluno
  type AlunoInfo = { nome: string; telefone: string }
  type HorarioInfo = { horario: string }
  const aluno = (Array.isArray(agendamento.alunos) ? agendamento.alunos[0] : agendamento.alunos) as AlunoInfo | null
  const horarioObj = (Array.isArray(agendamento.horarios) ? agendamento.horarios[0] : agendamento.horarios) as HorarioInfo | null

  if (aluno?.telefone) {
    const dataFmt = new Date(agendamento.data + 'T12:00:00').toLocaleDateString('pt-BR')
    const horaFmt = horarioObj?.horario?.slice(0, 5) || ''
    const msg = `Oi ${aluno.nome?.split(' ')[0] || ''}! Aqui é a Elen 🙏\n\nSua aula de ${dataFmt} às ${horaFmt} foi cancelada pelo Matheus. Se quiser remarcar pra outro dia, é só me chamar!`

    await supabase.from('mensagens_automaticas').insert({ telefone: aluno.telefone, origem: 'cancelar-agendamento-individual' })

    try {
      await fetch(`${EVO_URL}/message/sendText/MFCT-ESTUDIO`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
        body: JSON.stringify({ number: aluno.telefone, text: msg }),
      })
    } catch {}
  }

  return NextResponse.json({ ok: true })
}
