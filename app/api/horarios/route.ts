import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tgpestsfhjrdahtzwodk.supabase.co'
const SUPA_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function GET() {
  const supabase = createClient(SUPA_URL, SUPA_SERVICE_KEY)
  const { data, error } = await supabase
    .from('horarios')
    .select('*')
    .order('dia_semana')
    .order('horario')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ horarios: data })
}

export async function PATCH(req: NextRequest) {
  const { id, ativo } = await req.json()
  if (!id || typeof ativo !== 'boolean') {
    return NextResponse.json({ error: 'id e ativo são obrigatórios' }, { status: 400 })
  }

  const supabase = createClient(SUPA_URL, SUPA_SERVICE_KEY)
  const { error } = await supabase.from('horarios').update({ ativo }).eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
