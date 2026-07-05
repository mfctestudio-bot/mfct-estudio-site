import { NextRequest, NextResponse } from 'next/server'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tgpestsfhjrdahtzwodk.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function isAdmin(req: NextRequest) {
  const cookie = req.cookies.get('admin_auth')?.value
  const adminUser = process.env.ADMIN_USER || 'ronynsc5'
  const adminPass = process.env.ADMIN_PASSWORD || '@Miudinho123'
  const expected = Buffer.from(`${adminUser}:${adminPass}`).toString('base64')
  return cookie === expected
}

async function forward(req: NextRequest, path: string[]) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
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

  // Respostas 204/205/304 não podem ter corpo, mesmo vazio, ou o Response() quebra
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
