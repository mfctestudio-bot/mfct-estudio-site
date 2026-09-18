import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/api-auth'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tgpestsfhjrdahtzwodk.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function DELETE(req: NextRequest) {
  const authError = requireAdmin(req)
  if (authError) return authError
  if (!SERVICE_KEY) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor' }, { status: 500 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })

  const supabase = createClient(SUPA_URL, SERVICE_KEY)
  const { data: periodos, error: periodosError } = await supabase
    .from('planos_periodos')
    .select('id')
    .eq('pagamento_id', id)
    .limit(1)
  if (periodosError) return NextResponse.json({ error: periodosError.message }, { status: 500 })
  if (periodos && periodos.length > 0) {
    return NextResponse.json({ error: 'pagamento associado a período não pode ser excluído por esta operação' }, { status: 409 })
  }

  const { error } = await supabase.from('pagamentos').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}