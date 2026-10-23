import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/api-auth'
import { montarPacote, enviarParaCyberNutri } from '@/lib/cybernutri'

// Botão "🥗 Finalizar → CyberNutri" na avaliação (21/10/2026): manda a avaliação + a
// anamnese do aluno pro CyberNutri, que chama o aluno pra oferecer o plano alimentar.
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tgpestsfhjrdahtzwodk.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function POST(req: NextRequest) {
  const authError = requireAdmin(req)
  if (authError) return authError
  if (!SERVICE_KEY) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada' }, { status: 500 })

  const { avaliacaoId } = await req.json().catch(() => ({}))
  if (!avaliacaoId) return NextResponse.json({ error: 'avaliacaoId obrigatório' }, { status: 400 })

  const sb = createClient(SUPA_URL, SERVICE_KEY)
  const { data: av } = await sb.from('avaliacoes').select('aluno_id').eq('id', avaliacaoId).maybeSingle()
  if (!av) return NextResponse.json({ error: 'avaliação não encontrada' }, { status: 404 })
  const pacote = await montarPacote(sb, av.aluno_id, avaliacaoId)
  if (!pacote) return NextResponse.json({ error: 'aluno não encontrado' }, { status: 404 })
  if (!pacote.aluno.telefone) return NextResponse.json({ error: 'aluno sem telefone' }, { status: 400 })

  const r = await enviarParaCyberNutri('avaliacao_finalizada', pacote)
  if (!r.ok) return NextResponse.json({ error: `CyberNutri não recebeu (${r.erro || r.status || 'sem resposta'})` }, { status: 502 })
  return NextResponse.json({ ok: true, temAnamnese: !!pacote.anamnese })
}
