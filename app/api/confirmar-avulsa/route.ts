import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/api-auth'

// Correcao (23/09/2026): apontava pro Cloudfy antigo (ribbitingshoebill), abandonado --
// essa mensagem vinha falhando silenciosamente desde a migracao. Agora usa as mesmas
// variaveis de ambiente (EVO_URL/EVO_KEY) ja configuradas certinho no Vercel.
const EVO_URL = process.env.EVO_URL || ''
const EVO_KEY = process.env.EVO_KEY || ''

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tgpestsfhjrdahtzwodk.supabase.co'
const SUPA_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function POST(req: NextRequest) {
  const authError = requireAdmin(req)
  if (authError) return authError

  const { phone, nomeAluno, prazo } = await req.json()
  if (!phone) return NextResponse.json({ error: 'phone required' }, { status: 400 })

  const supabase = createClient(SUPA_URL, SUPA_SERVICE_KEY)

  const dataPrazo = prazo ? new Date(prazo).toLocaleDateString('pt-BR') : null

  const msg = `✅ *Pagamento da aula avulsa confirmado!*\n\nOlá ${nomeAluno?.split(' ')[0] || ''}! Já pode marcar sua aula pra quando quiser${dataPrazo ? ` — só até *${dataPrazo}*, senão o crédito vence` : ''}. É só me falar o dia! 💪`

  await supabase.from('mensagens_automaticas').insert({ telefone: phone, origem: 'confirmar-avulsa' })

  await fetch(`${EVO_URL}/message/sendText/MFCT-ESTUDIO`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
    body: JSON.stringify({ number: phone, text: msg }),
  })

  return NextResponse.json({ ok: true })
}
