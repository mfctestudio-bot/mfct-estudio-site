import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { TODAS_PERGUNTAS, obrigatoriasPendentes, type Respostas } from '@/lib/anamnese'

// Anamnese pelo link (21/10/2026, pedido do Matheus): substitui o Formulário do Google.
// Cada aluno tem o próprio link (/anamnese/<token_avaliacao>), preenche no celular e as
// respostas caem na mesma ficha do menu Alunos → Anamneses (tabela anamneses, mesmas chaves
// de lib/anamnese.ts). Quando a ficha fica completa pela primeira vez, a Elen agradece no
// WhatsApp e pergunta se o aluno quer fazer a avaliação física (a conversa segue com ela).
export const dynamic = 'force-dynamic'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tgpestsfhjrdahtzwodk.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const EVO_URL = process.env.EVO_URL || ''
const EVO_KEY = process.env.EVO_KEY || ''

const TOKEN_OK = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CHAVES = new Set(TODAS_PERGUNTAS.map(p => p.chave))

type Ficha = { id: string; respostas: Respostas; status: string }

async function carregar(token: string) {
  if (!SERVICE_KEY) return { erro: 'Sistema não configurado', status: 500 as const }
  if (!TOKEN_OK.test(token)) return { erro: 'Link inválido', status: 404 as const }
  const supabase = createClient(SUPA_URL, SERVICE_KEY)
  const { data: aluno } = await supabase.from('alunos').select('id, nome, telefone').eq('token_avaliacao', token).maybeSingle()
  if (!aluno) return { erro: 'Link inválido', status: 404 as const }
  const { data: ficha } = await supabase
    .from('anamneses').select('id, respostas, status').eq('aluno_id', aluno.id)
    .order('atualizado_em', { ascending: false }).limit(1).maybeSingle()
  return { supabase, aluno: aluno as { id: string; nome: string; telefone: string | null }, ficha: (ficha as Ficha | null) }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const r = await carregar(token)
  if ('erro' in r) return NextResponse.json({ error: r.erro }, { status: r.status })
  return NextResponse.json({
    nome: (r.aluno.nome || '').split(' ')[0],
    respostas: r.ficha?.respostas || {},
    completa: r.ficha?.status === 'completa',
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const r = await carregar(token)
  if ('erro' in r) return NextResponse.json({ error: r.erro }, { status: r.status })
  const { supabase, aluno, ficha } = r

  const body = await req.json().catch(() => null) as { respostas?: Record<string, unknown>; finalizar?: boolean } | null
  if (!body || typeof body.respostas !== 'object' || !body.respostas) return NextResponse.json({ error: 'respostas obrigatórias' }, { status: 400 })

  // Só aceita as chaves da ficha, texto limitado. Junta com o que já existia (nunca apaga).
  const novas: Respostas = {}
  for (const [k, v] of Object.entries(body.respostas)) {
    if (CHAVES.has(k) && typeof v === 'string') novas[k] = v.slice(0, 2000)
  }
  const respostas: Respostas = { ...(ficha?.respostas || {}), ...novas }
  const pendentes = obrigatoriasPendentes(respostas)
  if (body.finalizar && pendentes.length) {
    return NextResponse.json({ error: 'Faltam respostas', faltam: pendentes.map(p => p.chave) }, { status: 400 })
  }
  const jaEraCompleta = ficha?.status === 'completa'
  const completa = jaEraCompleta || (!!body.finalizar && pendentes.length === 0)
  const corpo = { respostas, status: completa ? 'completa' : 'parcial', atualizado_em: new Date().toISOString() }

  const { error } = ficha
    ? await supabase.from('anamneses').update(corpo).eq('id', ficha.id)
    : await supabase.from('anamneses').insert({ aluno_id: aluno.id, origem: 'elen', ...corpo })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // A data de nascimento também vai pro cadastro do aluno (campo que já existe), se for uma data válida.
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((respostas.data_nascimento || '').trim())
  if (m) {
    const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
    if (!isNaN(new Date(iso + 'T12:00:00').getTime())) await supabase.from('alunos').update({ data_nascimento: iso }).eq('id', aluno.id)
  }

  // Acabou de completar: a Elen agradece e pergunta da avaliação física.
  if (completa && !jaEraCompleta && aluno.telefone && EVO_URL && EVO_KEY) {
    const nome = (aluno.nome || '').split(' ')[0]
    const msg = `Oi ${nome}! Recebi sua anamnese, muito obrigada por responder ✅\n\nAgora, que tal fazer uma *avaliação física*? Com ela a gente vê seu ponto de partida (peso, gordura, massa muscular) e consegue acompanhar sua evolução. E com a avaliação e a anamnese dá até pra montar um plano alimentar pensado pra você 🍽️\n\nQuer marcar a sua?`
    try {
      await supabase.from('mensagens_automaticas').insert({ telefone: aluno.telefone, origem: 'anamnese-completa' })
      const resp = await fetch(`${EVO_URL}/message/sendText/MFCT-ESTUDIO`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
        body: JSON.stringify({ number: aluno.telefone, text: msg }),
      })
      if (resp.ok) await supabase.from('bot_historico_conversas').insert({ phone: aluno.telefone, role: 'assistant', message: msg })
    } catch {}
  }

  return NextResponse.json({ ok: true, completa, faltam: pendentes.map(p => p.chave) })
}
