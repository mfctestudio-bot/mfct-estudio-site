import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tgpestsfhjrdahtzwodk.supabase.co'
const SUPA_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const EVOLUTION_URL = process.env.EVOLUTION_URL || 'https://ribbitingshoebill-evolution.cloudfy.live'
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'MFCT-ESTUDIO'
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || ''

export async function POST(req: NextRequest) {
  const { data, horario_id, mensagem } = await req.json()

  if (!data || !horario_id) {
    return NextResponse.json({ error: 'data e horario_id são obrigatórios' }, { status: 400 })
  }

  const supabase = createClient(SUPA_URL, SUPA_SERVICE_KEY)

  // Buscar agendamentos confirmados desse dia/horário, com dados do aluno
  const { data: agendamentos, error } = await supabase
    .from('agendamentos')
    .select('id, alunos(nome, telefone)')
    .eq('data', data)
    .eq('horario_id', horario_id)
    .eq('status', 'confirmado')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const lista = agendamentos || []

  // Marcar como cancelado
  if (lista.length > 0) {
    await supabase
      .from('agendamentos')
      .update({ status: 'cancelado' })
      .eq('data', data)
      .eq('horario_id', horario_id)
      .eq('status', 'confirmado')
  }

  // Enviar mensagem pra cada aluno via Evolution API
  const textoBase = mensagem || 'Oi! Passando pra avisar que a aula de hoje nesse horário foi cancelada. Desculpa o transtorno, qualquer coisa é só chamar aqui 🙏'

  const resultados: { telefone: string; ok: boolean }[] = []

  for (const ag of lista) {
    const aluno = Array.isArray(ag.alunos) ? ag.alunos[0] : ag.alunos
    const telefone = aluno?.telefone
    if (!telefone) continue

    try {
      const resp = await fetch(`${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          number: telefone,
          text: `Oi ${aluno?.nome?.split(' ')[0] || ''}! ${textoBase}`,
        }),
      })
      resultados.push({ telefone, ok: resp.ok })
    } catch {
      resultados.push({ telefone, ok: false })
    }
  }

  return NextResponse.json({ ok: true, canceladas: lista.length, avisos: resultados })
}
