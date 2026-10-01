import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/api-auth'

// Correcao (23/09/2026): essas credenciais estavam fixas apontando pro Cloudfy ANTIGO
// (ribbitingshoebill), que foi abandonado quando o MFCT migrou pra uma conta nova do
// Cloudfy (wetgoose). Como esse dominio antigo nao existe mais, TODA mensagem daqui vinha
// falhando silenciosamente (o fetch falha, o chamador engole o erro com try/catch vazio) --
// inclusive o link da ficha de anamnese, que nunca mais chegou pro aluno depois da migracao.
// Agora usa as mesmas variaveis de ambiente (EVO_URL/EVO_KEY) que lib/planos.ts ja usa,
// configuradas certinho no Vercel apontando pro Cloudfy atual.
const EVO_URL = process.env.EVO_URL || ''
const EVO_KEY = process.env.EVO_KEY || ''

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tgpestsfhjrdahtzwodk.supabase.co'
const SUPA_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function POST(req: NextRequest) {
  const authError = requireAdmin(req)
  if (authError) return authError

  const { alunoId } = await req.json()
  if (!alunoId) return NextResponse.json({ error: 'alunoId required' }, { status: 400 })

  const supabase = createClient(SUPA_URL, SUPA_SERVICE_KEY)
  const { data: aluno, error: alunoError } = await supabase
    .from('alunos')
    .select('nome, telefone')
    .eq('id', alunoId)
    .single()
  if (alunoError || !aluno?.telefone) return NextResponse.json({ error: 'aluno não encontrado ou sem telefone' }, { status: 404 })

  const phone = aluno.telefone

  // Correcao (01/10/2026, pedido do Matheus): a ficha de anamnese so vai no PRIMEIRO pagamento
  // do aluno (quando ele entra no estudio). Antes ia em toda confirmacao, inclusive renovacoes.
  // Esta rota roda depois da ativarPlano(), entao o pagamento atual ja conta como 'pago':
  // mais de 1 pagamento pago = aluno ja era do estudio -> nao manda de novo.
  const { count: pagosAteAgora, error: countError } = await supabase
    .from('pagamentos')
    .select('id', { count: 'exact', head: true })
    .eq('aluno_id', alunoId)
    .eq('status', 'pago')
  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 })
  if ((pagosAteAgora || 0) > 1) return NextResponse.json({ ok: true, anamnese: 'nao_enviada_renovacao' })

  // Correcao (23/09/2026): removida a mensagem de "pagamento confirmado" daqui -- ela agora
  // e mandada direto por ativarPlano() (lib/planos.ts), que roda ANTES desta rota em toda tela
  // que chama as duas (pagamentos e mensalidades/[id]), e ja manda com a data de vencimento
  // certinha. Sem essa remocao, o aluno receberia a mesma confirmacao duas vezes.

  // Avisa a Eleniria que essa mensagem "fromMe" é automática, pra não pausar o bot por engano
  await supabase.from('mensagens_automaticas').insert({ telefone: phone, origem: 'confirmar-pagamento' })

  await fetch(`${EVO_URL}/message/sendText/MFCT-ESTUDIO`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
    body: JSON.stringify({
      number: phone,
      text: `Antes de começar a treinar, preciso que você preencha nossa ficha de anamnese. É rápido e importante para personalizarmos seu treino! 📋\n\nhttps://docs.google.com/forms/d/e/1FAIpQLSeMXI_m6xNT-X147yyJaZhfzDpU0Cl_2efeOggjHz8CCrLKSw/viewform?usp=header`
    }),
  })

  return NextResponse.json({ ok: true })
}
