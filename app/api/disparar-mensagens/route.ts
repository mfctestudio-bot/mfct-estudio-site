import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Mensagens agendadas (12/10/2026): manda pelo WhatsApp do estúdio as mensagens que o
// Matheus agendou no painel (Alunos → Mensagens agendadas) e cujo horário já chegou.
// É chamado a cada poucos minutos por uma rotina do n8n. Não precisa de login: só
// envia o que o próprio admin já agendou, e cada mensagem é "reservada" antes de sair
// (status pendente → enviando), então duas chamadas ao mesmo tempo nunca mandam em dobro.
export const dynamic = 'force-dynamic'

const EVO_URL = process.env.EVO_URL || ''
const EVO_KEY = process.env.EVO_KEY || ''

type Agendada = { id: string; telefone: string; mensagem: string; nome: string | null }

async function disparar() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return NextResponse.json({ error: 'Supabase não configurado' }, { status: 500 })
  if (!EVO_URL || !EVO_KEY) return NextResponse.json({ error: 'WhatsApp (EVO_URL/EVO_KEY) não configurado' }, { status: 500 })
  const supabase = createClient(url, key)

  // Reserva as que já passaram do horário (no máximo 1 dia de atraso, pra nunca mandar coisa velha).
  const agora = new Date()
  const limiteAtraso = new Date(agora.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const { data: reservadas, error } = await supabase
    .from('mensagens_agendadas')
    .update({ status: 'enviando' })
    .eq('status', 'pendente')
    .lte('enviar_em', agora.toISOString())
    .gte('enviar_em', limiteAtraso)
    .select('id, telefone, mensagem, nome')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const resultado: { id: string; ok: boolean }[] = []
  for (const m of (reservadas || []) as Agendada[]) {
    let ok = false
    let erro: string | null = null
    try {
      // Avisa a Elen que essa mensagem do número do estúdio é automática (não pausa o bot).
      await supabase.from('mensagens_automaticas').insert({ telefone: m.telefone, origem: 'mensagem-agendada' })
      const resp = await fetch(`${EVO_URL}/message/sendText/MFCT-ESTUDIO`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
        body: JSON.stringify({ number: m.telefone, text: m.mensagem }),
      })
      ok = resp.ok
      if (!resp.ok) erro = `WhatsApp respondeu ${resp.status}: ${(await resp.text().catch(() => '')).slice(0, 300)}`
    } catch (e) {
      erro = e instanceof Error ? e.message : 'falha ao enviar'
    }
    if (ok) {
      // Fica no histórico da Elen: se o aluno responder, ela sabe do que se trata.
      await supabase.from('bot_historico_conversas').insert({ phone: m.telefone, role: 'assistant', message: m.mensagem })
    }
    await supabase
      .from('mensagens_agendadas')
      .update(ok ? { status: 'enviada', enviado_em: new Date().toISOString(), erro: null } : { status: 'erro', erro })
      .eq('id', m.id)
    resultado.push({ id: m.id, ok })
    if (reservadas && reservadas.length > 1) await new Promise(r => setTimeout(r, 1500))
  }
  return NextResponse.json({ ok: true, enviadas: resultado.filter(r => r.ok).length, falhas: resultado.filter(r => !r.ok).length })
}

export async function GET() { return disparar() }
export async function POST() { return disparar() }
