// Gera PDFs simples e bonitos (anamnese, avaliação) no servidor. (03/10/2026)
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'

export type Linha = { rotulo: string; valor: string; destaque?: 'alerta' | 'ok' }
export type Secao = { titulo: string; linhas: Linha[]; texto?: string }
export type Documento = { titulo: string; subtitulo: string; aluno: string; data: string; secoes: Secao[]; rodape?: string }

const A4 = { w: 595.28, h: 841.89 }
const M = 46 // margem
const COR = {
  escuro: rgb(0.055, 0.055, 0.055),
  texto: rgb(0.12, 0.13, 0.14),
  cinza: rgb(0.42, 0.45, 0.47),
  linha: rgb(0.86, 0.87, 0.88),
  azul: rgb(0.184, 0.435, 0.929),
  alerta: rgb(0.75, 0.22, 0.17),
  ok: rgb(0.2, 0.6, 0.3),
  fundo: rgb(0.965, 0.97, 0.975),
}

// A fonte padrão do PDF não tem emoji nem alguns símbolos: troca/remove pra não quebrar.
function limpar(t: string) {
  return (t || '')
    .replace(/[–—]/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
    .replace(/…/g, '...').replace(/ /g, ' ')
    .replace(/[^\x09\x0A\x0D\x20-\x7E -ÿ]/g, '')
}

function quebrar(texto: string, fonte: PDFFont, tam: number, largura: number): string[] {
  const linhas: string[] = []
  for (const paragrafo of limpar(texto).split('\n')) {
    let atual = ''
    for (const palavra of paragrafo.split(/\s+/)) {
      const teste = atual ? `${atual} ${palavra}` : palavra
      if (fonte.widthOfTextAtSize(teste, tam) > largura && atual) { linhas.push(atual); atual = palavra }
      else atual = teste
    }
    linhas.push(atual)
  }
  return linhas
}

export async function gerarPdf(doc: Documento): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle(limpar(`${doc.titulo} - ${doc.aluno}`))
  pdf.setAuthor('MFCT Estúdio')
  const normal = await pdf.embedFont(StandardFonts.Helvetica)
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold)

  let page: PDFPage = pdf.addPage([A4.w, A4.h])
  let y = A4.h

  function cabecalho(primeira: boolean) {
    const altura = primeira ? 118 : 46
    page.drawRectangle({ x: 0, y: A4.h - altura, width: A4.w, height: altura, color: COR.escuro })
    page.drawRectangle({ x: 0, y: A4.h - altura, width: A4.w, height: 3, color: COR.azul })
    page.drawText('MFCT ESTÚDIO', { x: M, y: A4.h - 28, size: 11, font: negrito, color: rgb(0.81, 0.85, 0.86) })
    if (primeira) {
      page.drawText(limpar(doc.titulo.toUpperCase()), { x: M, y: A4.h - 62, size: 22, font: negrito, color: rgb(1, 1, 1) })
      page.drawText(limpar(doc.subtitulo), { x: M, y: A4.h - 82, size: 10, font: normal, color: rgb(0.7, 0.73, 0.75) })
      page.drawText(limpar(doc.aluno), { x: M, y: A4.h - 102, size: 12, font: negrito, color: rgb(1, 1, 1) })
      const d = limpar(doc.data)
      page.drawText(d, { x: A4.w - M - normal.widthOfTextAtSize(d, 10), y: A4.h - 102, size: 10, font: normal, color: rgb(0.7, 0.73, 0.75) })
    } else {
      const t = limpar(`${doc.titulo} - ${doc.aluno}`)
      page.drawText(t, { x: A4.w - M - normal.widthOfTextAtSize(t, 9), y: A4.h - 28, size: 9, font: normal, color: rgb(0.7, 0.73, 0.75) })
    }
    y = A4.h - altura - 26
  }

  function novaPagina() { page = pdf.addPage([A4.w, A4.h]); cabecalho(false) }
  function garantir(alt: number) { if (y - alt < M + 20) novaPagina() }

  cabecalho(true)
  const larguraUtil = A4.w - 2 * M
  const colRotulo = 200

  for (const s of doc.secoes) {
    garantir(50)
    page.drawText(limpar(s.titulo.toUpperCase()), { x: M, y, size: 10, font: negrito, color: COR.azul })
    y -= 8
    page.drawRectangle({ x: M, y, width: larguraUtil, height: 0.8, color: COR.linha })
    y -= 16
    if (s.texto) {
      for (const l of quebrar(s.texto, normal, 10, larguraUtil)) { garantir(14); page.drawText(l, { x: M, y, size: 10, font: normal, color: COR.texto }); y -= 14 }
      y -= 6
    }
    for (const l of s.linhas) {
      const rot = quebrar(l.rotulo, normal, 9, colRotulo - 10)
      const val = quebrar(l.valor || '-', negrito, 10, larguraUtil - colRotulo)
      const alt = Math.max(rot.length * 12, val.length * 13) + 8
      garantir(alt)
      const cor = l.destaque === 'alerta' ? COR.alerta : l.destaque === 'ok' ? COR.ok : COR.texto
      rot.forEach((t, i) => page.drawText(t, { x: M, y: y - i * 12, size: 9, font: normal, color: COR.cinza }))
      val.forEach((t, i) => page.drawText(t, { x: M + colRotulo, y: y - i * 13, size: 10, font: negrito, color: cor }))
      y -= alt
    }
    y -= 12
  }

  const paginas = pdf.getPages()
  paginas.forEach((p, i) => {
    const r = limpar(doc.rodape || 'MFCT Estúdio - Rua Vila Nova Esperança, 58 - Caju, Rio de Janeiro')
    p.drawText(r, { x: M, y: 24, size: 8, font: normal, color: COR.cinza })
    const n = `${i + 1}/${paginas.length}`
    p.drawText(n, { x: A4.w - M - normal.widthOfTextAtSize(n, 8), y: 24, size: 8, font: normal, color: COR.cinza })
  })
  return pdf.save()
}
