import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { montarPacote, enviarParaCyberNutri } from '@/lib/cybernutri'
import { normalizarTelefone } from '@/lib/phone'

// Elen → CyberNutri, passando pelo site (23/10/2026).
// O CyberNutri passou a exigir a senha do estúdio (x-cybernutri-token) na porta de entrada, e a
// Elen chamava ele direto, sem senha -> as indicações eram recusadas ("unauthorized", caso Sol).
// Agora a Elen chama esta rota e o site repassa com a senha (que fica só na Vercel).
//
// Sem login, mas só repassa se a pessoa falou com a Elen nos últimos 30 minutos (mensagem dela
// no histórico) -- ninguém consegue usar isto pra fazer o CyberNutri chamar números aleatórios.
export const dynamic = 'force-dynamic'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tgpestsfhjrdahtzwodk.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const INTERESSES = ['plano_direto', 'duvida_alimentacao', 'avaliacao']

export async function POST(req: NextRequest) {
  if (!SERVICE_KEY) return NextResponse.json({ error: 'servidor sem SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  // Aceita {telefone, interesse, nome} ou o mesmo formato que a Elen já montava pro CyberNutri
  // ({aluno: {telefone, nome}, interesse, avaliacao_agendada}).
  const b = await req.json().catch(() => null) as { telefone?: string; interesse?: string; nome?: string; aluno?: { telefone?: string; nome?: string }; avaliacao_agendada?: unknown } | null
  const tel = normalizarTelefone(String(b?.telefone || b?.aluno?.telefone || ''))
  if (!tel) return NextResponse.json({ error: 'telefone obrigatório' }, { status: 400 })
  const nomeInformado = String(b?.nome || b?.aluno?.nome || '')
  const interesse = INTERESSES.includes(String(b?.interesse)) ? String(b?.interesse) : (b?.avaliacao_agendada ? 'avaliacao' : 'plano_direto')

  const sb = createClient(SUPA_URL, SERVICE_KEY)
  const desde = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { data: recente } = await sb.from('bot_historico_conversas')
    .select('id').eq('phone', tel).eq('role', 'user').gte('created_at', desde).limit(1)
  if (!recente || !recente.length) return NextResponse.json({ error: 'sem conversa recente com a Elen' }, { status: 403 })

  const { data: aluno } = await sb.from('alunos').select('id').eq('telefone', tel).maybeSingle()
  let pacote: Record<string, unknown> | null = aluno ? await montarPacote(sb, aluno.id) : null
  if (!pacote) {
    pacote = {
      aluno: { studio_student_id: null, nome: nomeInformado.slice(0, 120) || null, telefone: tel, data_nascimento: null },
      anamnese: null,
      avaliacao: null,
    }
  }
  let avaliacaoAgendada = null
  if (aluno) {
    const { data: av } = await sb.from('avaliacoes').select('data, horario')
      .eq('aluno_id', aluno.id).eq('status', 'agendada').order('data', { ascending: false }).limit(1)
    if (av && av.length) avaliacaoAgendada = { data: av[0].data, horario: String(av[0].horario || '09:30').slice(0, 5), marcada_por: 'elen' }
  }

  const r = await enviarParaCyberNutri('indicacao', { ...pacote, interesse, avaliacao_agendada: avaliacaoAgendada })
  if (!r.ok) return NextResponse.json({ error: `CyberNutri não recebeu (${r.erro || r.status || 'sem resposta'})` }, { status: 502 })
  return NextResponse.json({ ok: true })
}
