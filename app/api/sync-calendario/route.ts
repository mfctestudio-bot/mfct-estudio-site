import { NextRequest, NextResponse } from 'next/server'

const SYNC_URL = 'https://primary-production-4716.up.railway.app/webhook/mfct-sync-calendar'

export async function POST(req: NextRequest) {
  const body = await req.json()

  try {
    const resp = await fetch(SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await resp.json().catch(() => ({}))
    return NextResponse.json(data, { status: resp.status })
  } catch (e) {
    // Falha na sincronização com o Calendar não deve travar o agendamento em si
    return NextResponse.json({ ok: false, error: 'sync falhou' }, { status: 200 })
  }
}
