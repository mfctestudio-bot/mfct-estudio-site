import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { normalizarTelefone } from '@/lib/phone'

// CyberNutri → sistema do estúdio (22/10/2026, pedido do Matheus).
// O CyberNutri avisa o estúdio quando alguém fala com ele ou avança no plano alimentar:
//  - se a pessoa ainda não existe, cria o cadastro como LEAD (as automações de cobrança/lembrete
//    só pegam 'ativo'/'vencido', então lead não recebe cobrança);
//  - se já existe, só atualiza a linha "[CyberNutri ...]" nas observações (sem mexer no status).
// A Elen lê as observações do cadastro, então fica sabendo da história com o CyberNutri.
// Protegido pelo header x-cybernutri-token (variável CYBERNUTRI_TOKEN na Vercel).

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tgpestsfhjrdahtzwodk.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const TOKEN = process.env.CYBERNUTRI_TOKEN || ''

// mesmo número com e sem o 9 do celular, com e sem o 55
function variantes(tel: string): string[] {
  const out = new Set<string>([tel])
  if (/^55\d{2}9\d{8}$/.test(tel)) out.add(tel.slice(0, 4) + tel.slice(5))
  if (/^55\d{2}[6-9]\d{7}$/.test(tel)) out.add(tel.slice(0, 4) + '9' + tel.slice(4))
  for (const t of [...out]) out.add(t.slice(2))
  return [...out]
}

export async function POST(req: NextRequest) {
  if (!TOKEN || !SERVICE_KEY) return NextResponse.json({ error: 'integração CyberNutri não configurada no servidor' }, { status: 503 })
  if (req.headers.get('x-cybernutri-token') !== TOKEN) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const b = await req.json().catch(() => null)
  const tel = normalizarTelefone(String(b?.telefone || ''))
  const etapa = String(b?.etapa || '').trim().slice(0, 160)
  if (!tel || !etapa) return NextResponse.json({ error: 'telefone e etapa são obrigatórios' }, { status: 400 })
  const detalhe = String(b?.detalhe || '').trim().slice(0, 240)
  const nome = String(b?.nome || '').trim().slice(0, 120)
  const nasc = /^\d{4}-\d{2}-\d{2}$/.test(String(b?.data_nascimento || '')) ? String(b.data_nascimento) : null

  const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' })
  const linha = `[CyberNutri ${hoje}] ${etapa}${detalhe ? ' - ' + detalhe : ''}`

  const sb = createClient(SUPA_URL, SERVICE_KEY)
  const { data: achados } = await sb.from('alunos').select('id, nome, observacoes, status_plano').in('telefone', variantes(tel)).limit(1)
  const aluno = achados && achados[0]

  if (aluno) {
    const outras = String(aluno.observacoes || '').split('\n').filter((l: string) => l.trim() && !l.startsWith('[CyberNutri'))
    const { error } = await sb.from('alunos').update({ observacoes: [...outras, linha].join('\n') }).eq('id', aluno.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, alunoId: aluno.id, criado: false, status_plano: aluno.status_plano })
  }

  if (!nome) return NextResponse.json({ error: 'nome é obrigatório para criar o lead' }, { status: 400 })
  const { data, error } = await sb.from('alunos')
    .insert({ nome, telefone: tel, data_nascimento: nasc, status_plano: 'lead', observacoes: linha })
    .select('id').single()
  if (error || !data) return NextResponse.json({ error: error?.message || 'não foi possível criar o lead' }, { status: 500 })
  return NextResponse.json({ ok: true, alunoId: data.id, criado: true, status_plano: 'lead' })
}
