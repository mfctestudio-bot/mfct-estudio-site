import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { gerarPdf } from '@/lib/pdf'
import { docAnamnese, docAvaliacao, nomeArquivo } from '@/lib/documentos'

// Baixar/ver o PDF da anamnese ou da avaliação (só admin). (03/10/2026)
// /api/pdf?tipo=anamnese&id=<aluno_id>   |   /api/pdf?tipo=avaliacao&id=<avaliacao_id>
export async function GET(req: NextRequest) {
  const authError = requireAdmin(req)
  if (authError) return authError
  const tipo = req.nextUrl.searchParams.get('tipo')
  const id = req.nextUrl.searchParams.get('id') || ''
  const r = tipo === 'anamnese' ? await docAnamnese(id) : tipo === 'avaliacao' ? await docAvaliacao(id) : null
  if (!r) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })
  const bytes = await gerarPdf(r.doc)
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${nomeArquivo(tipo!, r.aluno.nome)}"`,
      'Cache-Control': 'no-store',
    },
  })
}
