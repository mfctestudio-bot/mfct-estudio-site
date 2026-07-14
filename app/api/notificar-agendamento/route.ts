import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tgpestsfhjrdahtzwodk.supabase.co'
const SUPA_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const EVO_URL = 'https://ribbitingshoebill-evolution.cloudfy.live'
const EVO_KEY = 'MMxqYf3msawylWCBW2PSU4uUdJAY6mL3'

export async function POST(req: NextRequest) {
  const { telefone, nome, tipo, data, horario } = await req.json()
  if (!telefone || !tipo) return NextResponse.json({ error: 'telefone e tipo obrigatórios' }, { status: 400 })

  const supabase = createClient(SUPA_URL, SUPA_SERVICE_KEY)
  const primeiroNome = (nome || '').split(' ')[0] || ''
  const dataFmt = data ? new Date(data + 'T12:00:00').toLocaleDateString('pt-BR') : ''
  const horaFmt = horario || ''

  let msg = ''
  if (tipo === 'movido') {
    msg = `Oi ${primeiroNome}! Aqui é a Elen 🙏\n\nO Matheus mudou o horário da sua aula — agora ela fica marcada pra ${dataFmt} às ${horaFmt}. Qualquer dúvida é só chamar!`
  } else if (tipo === 'criado') {
    msg = `Oi ${primeiroNome}! Aqui é a Elen 🙏\n\nO Matheus marcou uma aula pra você: ${dataFmt} às ${horaFmt}. Te esperamos lá! 💪`
  } else {
    return NextResponse.json({ error: 'tipo inválido' }, { status: 400 })
  }

  await supabase.from('mensagens_automaticas').insert({ telefone, origem: `notificar-agendamento-${tipo}` })

  try {
    await fetch(`${EVO_URL}/message/sendText/MFCT-ESTUDIO`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
      body: JSON.stringify({ number: telefone, text: msg }),
    })
  } catch {}

  return NextResponse.json({ ok: true })
}
