import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tgpestsfhjrdahtzwodk.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

async function forward(req: NextRequest, path: string[]) {
  const authError = requireAdmin(req)
  if (authError) return authError
  if (!SERVICE_KEY) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor' }, { status: 500 })
  }

  const url = `${SUPA_URL}/storage/v1/${path.join('/')}${req.nextUrl.search}`

  const headers: Record<string, string> = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': req.headers.get('content-type') || 'application/octet-stream',
  }
  const cacheControl = req.headers.get('cache-control')
  if (cacheControl) headers['cache-control'] = cacheControl
  const xUpsert = req.headers.get('x-upsert')
  if (xUpsert) headers['x-upsert'] = xUpsert

  const hasBody = !['GET', 'HEAD'].includes(req.method)
  const body = hasBody ? await req.arrayBuffer() : undefined

  const upstream = await fetch(url, {
    method: req.method,
    headers,
    body: body || undefined,
  })

  const resBody = await upstream.arrayBuffer()
  const resHeaders = new Headers()
  const contentType = upstream.headers.get('content-type')
  if (contentType) resHeaders.set('content-type', contentType)

  const semCorpo = [204, 205, 304].includes(upstream.status)
  return new NextResponse(semCorpo ? null : resBody, { status: upstream.status, headers: resHeaders })
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await params).path)
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await params).path)
}
export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await params).path)
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await params).path)
}
