import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { gerarPdf } from '@/lib/pdf'
import { docAnamnese, docAvaliacao, nomeArquivo, servidor } from '@/lib/documentos'

// Manda o PDF da anamnese ou da avaliação pro WhatsApp do aluno (só admin, só quando você clica). (03/10/2026)
const EVO_URL = process.env.EVO_URL || ''
const EVO_KEY = process.env.EVO_KEY || ''

export async function POST(req: NextRequest) {
  const authError = requireAdmin(req)
  if (authError) return authError
  if (!EVO_URL || !EVO_KEY) return NextResponse.json({ error: 'WhatsApp não configurado no servidor' }, { status: 500 })

  const { tipo, id } = await req.json()
  const r = tipo === 'anamnese' ? await docAnamnese(id) : tipo === 'avaliacao' ? await docAvaliacao(id) : null
  if (!r) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })
  if (!r.aluno.telefone) return NextResponse.json({ error: 'aluno sem telefone cadastrado' }, { status: 400 })

  const bytes = await gerarPdf(r.doc)
  const primeiroNome = r.aluno.nome.split(' ')[0]
  const legenda = tipo === 'anamnese'
    ? `Oi, ${primeiroNome}! Segue a sua ficha de anamnese do MFCT Estúdio. 📋`
    : `Oi, ${primeiroNome}! Segue o resultado da sua avaliação física no MFCT Estúdio. 💪`

  // Avisa a Elen que essa mensagem é automática, pra ela não pausar achando que foi conversa humana.
  await servidor().from('mensagens_automaticas').insert({ telefone: r.aluno.telefone, origem: `enviar-pdf-${tipo}` })

  const resp = await fetch(`${EVO_URL}/message/sendMedia/MFCT-ESTUDIO`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
    body: JSON.stringify({
      number: r.aluno.telefone,
      mediatype: 'document',
      mimetype: 'application/pdf',
      caption: legenda,
      media: Buffer.from(bytes).toString('base64'),
      fileName: nomeArquivo(tipo, r.aluno.nome),
    }),
  })
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '')
    return NextResponse.json({ error: `WhatsApp recusou o envio (${resp.status}) ${txt.slice(0, 200)}` }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
