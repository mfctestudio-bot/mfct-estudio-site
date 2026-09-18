import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tgpestsfhjrdahtzwodk.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

async function forward(req: NextRequest, path: string[]) {
  const authError = requireAdmin(req)
  if (authError) return authError
  const recurso = path[0]

  // DEBUG TEMPORARIO
  if (req.headers.get('x-debug-proxy') === '1') {
    return NextResponse.json({ path, recurso, method: req.method, joined: path.join('/') })
  }

  if (!['GET', 'HEAD'].includes(req.method) && ['agendamentos', 'horarios_fixos'].includes(recurso)) {
    return NextResponse.json({ error: 'mutações de agenda devem usar a API de domínio' }, { status: 403 })
  }
  if (!['GET', 'HEAD'].includes(req.method) && recurso === 'planos_periodos') {
    return NextResponse.json({ error: 'mutações de período devem usar a autoridade de ativação/renovação' }, { status: 403 })
  }
  if (req.method === 'DELETE' && recurso === 'pagamentos') {
    return NextResponse.json({ error: 'exclusão de pagamento deve usar a API financeira protegida' }, { status: 403 })
  }
  if (!SERVICE_KEY) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor' }, { status: 500 })
  }

  const url = `${SUPA_URL}/rest/v1/${path.join('/')}${req.nextUrl.search}`

  const headers: Record<string, string> = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': req.headers.get('content-type') || 'application/json',
  }
  const accept = req.headers.get('accept')
  if (accept) headers['Accept'] = accept
  const prefer = req.headers.get('prefer')
  if (prefer) headers['Prefer'] = prefer
  const range = req.headers.get('range')
  if (range) headers['Range'] = range
  const rangeUnit = req.headers.get('range-unit')
  if (rangeUnit) headers['Range-Unit'] = rangeUnit

  const hasBody = !['GET', 'HEAD'].includes(req.method)
  const body = hasBody ? await req.text() : undefined
  if (recurso === 'alunos' && hasBody && body) {
    try {
      const payload = JSON.parse(body) as Record<string, unknown>
      if ('status_plano' in payload || 'plano_id' in payload) {
        return NextResponse.json({ error: 'alterações de matrícula devem usar a API de domínio' }, { status: 403 })
      }
    } catch {
      return NextResponse.json({ error: 'payload JSON inválido' }, { status: 400 })
    }
  }

  const upstream = await fetch(url, {
    method: req.method,
    headers,
    body: body || undefined,
  })

  const resBody = await upstream.arrayBuffer()
  const resHeaders = new Headers()
  const contentType = upstream.headers.get('content-type')
  if (contentType) resHeaders.set('content-type', contentType)
  const contentRange = upstream.headers.get('content-range')
  if (contentRange) resHeaders.set('content-range', contentRange)

  const semCorpo = [204, 205, 304].includes(upstream.status)
  return new NextResponse(semCorpo ? null : resBody, { status: upstream.status, headers: resHeaders })
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await params).path)
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await params).path)
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await params).path)
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await params).path)
}
export async function HEAD(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await params).path)
}
