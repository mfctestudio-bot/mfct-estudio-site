import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tgpestsfhjrdahtzwodk.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = createClient(SUPA_URL, SERVICE_KEY)

const EVOLUTION_URL = 'https://ribbitingshoebill-evolution.cloudfy.live'
const EVOLUTION_INSTANCE = 'MFCT-ESTUDIO'
const EVOLUTION_API_KEY = 'MMxqYf3msawylWCBW2PSU4uUdJAY6mL3'

const DIAS_NOMES = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']

type AlunoRef = { nome: string; telefone: string } | { nome: string; telefone: string }[] | null

function pegarAluno(a: AlunoRef) {
  return Array.isArray(a) ? a[0] : a
}

export async function POST(req: NextRequest) {
  const { horario_id } = await req.json()
  if (!horario_id) {
    return NextResponse.json({ error: 'horario_id é obrigatório' }, { status: 400 })
  }

  const { data: horario } = await supabase.from('horarios').select('*').eq('id', horario_id).single()
  if (!horario) {
    return NextResponse.json({ error: 'horário não encontrado' }, { status: 404 })
  }

  const hoje = new Date().toISOString().slice(0, 10)

  const { data: agendamentos } = await supabase
    .from('agendamentos')
    .select('id, aluno_id, data, alunos(nome, telefone)')
    .eq('horario_id', horario_id)
    .eq('status', 'confirmado')
    .gte('data', hoje)

  if (agendamentos && agendamentos.length > 0) {
    await supabase
      .from('agendamentos')
      .update({ status: 'cancelado', cancelado_por: 'estudio' })
      .in('id', agendamentos.map(a => a.id))
  }

  const { data: fixos } = await supabase
    .from('horarios_fixos')
    .select('id, aluno_id, alunos(nome, telefone)')
    .eq('horario_id', horario_id)
    .eq('ativo', true)

  if (fixos && fixos.length > 0) {
    await supabase.from('horarios_fixos').update({ ativo: false }).eq('horario_id', horario_id)
  }

  await supabase.from('horarios').update({ ativo: false }).eq('id', horario_id)

  const afetadosMap = new Map<string, { nome: string; telefone: string }>()
  for (const a of agendamentos || []) {
    const aluno = pegarAluno(a.alunos as AlunoRef)
    if (aluno?.telefone) afetadosMap.set(aluno.telefone, aluno)
  }
  for (const f of fixos || []) {
    const aluno = pegarAluno(f.alunos as AlunoRef)
    if (aluno?.telefone) afetadosMap.set(aluno.telefone, aluno)
  }

  const diaTxt = DIAS_NOMES[horario.dia_semana]
  const horarioTxt = String(horario.horario).slice(0, 5)

  const resultados: { telefone: string; ok: boolean; erro: string | null }[] = []

  for (const [telefone, aluno] of afetadosMap) {
    const primeiroNome = aluno.nome?.split(' ')[0] || ''
    const msg = `Oi ${primeiroNome}! Preciso te avisar que o horário de ${diaTxt} às ${horarioTxt} foi encerrado e não vai mais existir na agenda. Me chama aqui que te ajudo a escolher outro horário que funcione pra você! Se a gente não achar nada que sirva, é só me falar que eu chamo o Matheus pra resolvermos juntos.`

    try {
      const resp = await fetch(`${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_API_KEY },
        body: JSON.stringify({ number: telefone, text: msg }),
      })
      let erro: string | null = null
      if (!resp.ok) {
        const corpo = await resp.text().catch(() => '')
        erro = `Evolution API respondeu ${resp.status}: ${corpo.slice(0, 300)}`
      }
      resultados.push({ telefone, ok: resp.ok, erro })
    } catch (e) {
      resultados.push({ telefone, ok: false, erro: e instanceof Error ? e.message : 'Falha desconhecida ao enviar WhatsApp' })
    }
  }

  return NextResponse.json({
    ok: true,
    afetados: afetadosMap.size,
    agendamentosCancelados: agendamentos?.length || 0,
    horariosFixosDesativados: fixos?.length || 0,
    resultados,
  })
}
