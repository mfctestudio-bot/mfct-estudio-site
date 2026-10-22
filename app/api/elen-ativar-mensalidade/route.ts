import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ativarPlano, enviarWhatsAppAluno } from '@/lib/planos'
import { hojeSP } from '@/lib/hoje'

// Mensalidade confirmada pela Elen (22/10/2026, auditoria — porta lateral fechada).
// Antes, quando o Matheus respondia "ok" no WhatsApp pro comprovante de mensalidade, a própria
// Elen gravava pagamento + período + status direto no banco, sempre como "plano 3x / R$ 129,90",
// sem passar pela ativarPlano(). Agora a Elen só marca o comprovante como aprovado e chama esta
// rota, que usa a ativarPlano() (única autoridade de ativação/renovação), com o plano do aluno.
//
// Sem login: só age sobre um comprovante que o Matheus JÁ aprovou (status 'aprovado'), recente
// e ainda não lançado (não existe pagamento com aquele comprovante). Chamar duas vezes não
// duplica nada.
export const dynamic = 'force-dynamic'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tgpestsfhjrdahtzwodk.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const PLANO_PADRAO = '904a1d47-3748-4ddc-980f-cab5979be18e' // plano 3x (o que a Elen usava fixo)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest) {
  if (!SERVICE_KEY) return NextResponse.json({ error: 'servidor sem SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  const { comprovanteId } = await req.json().catch(() => ({}))
  if (!comprovanteId || !UUID.test(String(comprovanteId))) return NextResponse.json({ error: 'comprovanteId inválido' }, { status: 400 })

  const sb = createClient(SUPA_URL, SERVICE_KEY)
  const { data: comp } = await sb.from('comprovante_pendente_autorizacao')
    .select('id, aluno_id, foto_url, status, tipo, created_at').eq('id', comprovanteId).maybeSingle()
  if (!comp) return NextResponse.json({ error: 'comprovante não encontrado' }, { status: 404 })
  if (comp.status !== 'aprovado') return NextResponse.json({ error: 'comprovante ainda não foi aprovado pelo Matheus' }, { status: 409 })
  if (comp.tipo && comp.tipo !== 'mensalidade') return NextResponse.json({ error: `comprovante é de ${comp.tipo}, não de mensalidade` }, { status: 409 })
  if (!comp.aluno_id) return NextResponse.json({ error: 'comprovante sem aluno ligado' }, { status: 409 })
  if (Date.now() - new Date(comp.created_at).getTime() > 15 * 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: 'comprovante antigo demais (mais de 15 dias) — confirme pelo painel' }, { status: 409 })
  }

  // Já lançado? (mesmo comprovante) -> não duplica.
  if (comp.foto_url) {
    const { data: ja } = await sb.from('pagamentos').select('id').eq('aluno_id', comp.aluno_id).eq('comprovante_url', comp.foto_url).limit(1)
    if (ja && ja.length) return NextResponse.json({ ok: true, jaProcessado: true, pagamentoId: ja[0].id })
  }

  const { data: aluno } = await sb.from('alunos')
    .select('id, plano_id, desconto_individual_valor, desconto_individual_motivo').eq('id', comp.aluno_id).maybeSingle()
  if (!aluno) return NextResponse.json({ error: 'aluno não encontrado' }, { status: 404 })
  const planoId = aluno.plano_id || PLANO_PADRAO
  const { data: plano } = await sb.from('planos').select('id, valor').eq('id', planoId).maybeSingle()
  if (!plano) return NextResponse.json({ error: 'plano do aluno não encontrado' }, { status: 404 })
  const valorOriginal = Number(plano.valor)

  // Desconto: mesmo critério que a Elen usava (pontual pendente primeiro, senão o individual recorrente).
  let desconto = 0
  let motivo: string | null = null
  let recorrente = false
  const { data: pontual } = await sb.from('desconto_pendente_aplicacao')
    .select('id, valor, motivo').eq('aluno_id', comp.aluno_id).eq('status', 'pendente').order('created_at', { ascending: false }).limit(1)
  if (pontual && pontual.length) {
    desconto = Number(pontual[0].valor) || 0
    motivo = pontual[0].motivo || null
  } else if (aluno.desconto_individual_valor) {
    desconto = Number(aluno.desconto_individual_valor) || 0
    motivo = aluno.desconto_individual_motivo || null
    recorrente = true
  }
  desconto = Math.min(Math.max(0, desconto), valorOriginal)

  let resultado
  try {
    resultado = await ativarPlano({
      alunoId: comp.aluno_id,
      planoId,
      valor: Math.round((valorOriginal - desconto) * 100) / 100,
      valorOriginal,
      desconto,
      dataPagamento: hojeSP(),
      metodoPagamento: 'pix',
      observacao: 'Comprovante pelo WhatsApp (Elen), aprovado pelo Matheus',
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'falha ao ativar plano' }, { status: 500 })
  }

  // Detalhes que a ativarPlano não grava: comprovante e desconto.
  await sb.from('pagamentos').update({
    comprovante_url: comp.foto_url || null,
    motivo_desconto: motivo,
    desconto_recorrente: recorrente,
  }).eq('id', resultado.pagamentoId)
  if (pontual && pontual.length) await sb.from('desconto_pendente_aplicacao').update({ status: 'aplicado' }).eq('id', pontual[0].id)

  // Primeiro pagamento do aluno: manda o link da anamnese (mesma regra do painel).
  const { count } = await sb.from('pagamentos').select('id', { count: 'exact', head: true }).eq('aluno_id', comp.aluno_id).eq('status', 'pago')
  if ((count || 0) <= 1) {
    const { data: a2 } = await sb.from('alunos').select('telefone, token_avaliacao').eq('id', comp.aluno_id).maybeSingle()
    if (a2?.telefone && a2.token_avaliacao) {
      const texto = `Antes de começar a treinar, preciso que você preencha nossa ficha de anamnese. É rápido e importante para personalizarmos seu treino! 📋\n\nhttps://mfct-estudio-site.vercel.app/anamnese/${a2.token_avaliacao}`
      await sb.from('mensagens_automaticas').insert({ telefone: a2.telefone, origem: 'elen-ativar-mensalidade' })
      await enviarWhatsAppAluno(a2.telefone, texto)
      await sb.from('bot_historico_conversas').insert({ phone: a2.telefone, role: 'assistant', message: texto })
    }
  }

  return NextResponse.json({ ok: true, pagamentoId: resultado.pagamentoId, dataInicio: resultado.dataInicio, dataFim: resultado.dataFim })
}
