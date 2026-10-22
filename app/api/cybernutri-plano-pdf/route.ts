import { NextRequest, NextResponse } from 'next/server'
import { gerarPdf, type Documento, type Linha, type Secao } from '@/lib/pdf'

// PDF do plano alimentar do CyberNutri (21/10/2026, pedido do Matheus).
// O workflow "CyberNutri" no n8n manda o plano já aprovado e recebe o PDF em base64
// para enviar ao aluno pelo WhatsApp. Mesmo visual dos PDFs de anamnese/avaliação.
// Não lê nem grava nenhum dado do estúdio: só desenha o que recebe.

type Item = { alimento?: string; quantidade_g?: number; medida_caseira?: string }
type Refeicao = { nome?: string; horario?: string; itens?: Item[]; trocas?: string[]; substituicoes?: string[] }
type Entrada = {
  aluno?: string
  data?: string
  objetivo?: string
  versao?: number
  refeicoes?: Refeicao[]
  orientacoes?: string[]
  totais?: { kcal?: number; proteina_g?: number; carboidrato_g?: number; gordura_g?: number }
  agua_l?: number
}

const txt = (v: unknown, max = 200) => String(v ?? '').slice(0, max)

export async function POST(req: NextRequest) {
  const raw = await req.text()
  if (raw.length > 80_000) return NextResponse.json({ error: 'conteúdo grande demais' }, { status: 413 })
  let b: Entrada
  try { b = JSON.parse(raw) } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  if (!b || !b.aluno || !Array.isArray(b.refeicoes) || b.refeicoes.length === 0 || b.refeicoes.length > 12) {
    return NextResponse.json({ error: 'envie aluno e refeicoes' }, { status: 400 })
  }

  const secoes: Secao[] = []
  const resumo: Secao = { titulo: 'Resumo do dia', linhas: [] }
  if (b.objetivo) resumo.linhas.push({ rotulo: 'Objetivo', valor: txt(b.objetivo) })
  const t = b.totais || {}
  if (t.kcal) resumo.linhas.push({ rotulo: 'Energia (aprox.)', valor: `${Math.round(t.kcal)} kcal` })
  if (t.proteina_g || t.carboidrato_g || t.gordura_g) {
    resumo.linhas.push({ rotulo: 'Proteína / Carboidrato / Gordura', valor: `${Math.round(t.proteina_g || 0)} g / ${Math.round(t.carboidrato_g || 0)} g / ${Math.round(t.gordura_g || 0)} g` })
  }
  if (b.agua_l) resumo.linhas.push({ rotulo: 'Água', valor: `cerca de ${String(b.agua_l).replace('.', ',')} L por dia` })
  if (resumo.linhas.length) secoes.push(resumo)

  for (const r of b.refeicoes) {
    const itens = (r.itens || []).slice(0, 15)
    const trocas = (r.trocas || r.substituicoes || []).slice(0, 4).map((x) => txt(x, 300))
    secoes.push({
      titulo: `${txt(r.nome, 60)}${r.horario ? ' - ' + txt(r.horario, 10) : ''}`,
      linhas: itens.map((i): Linha => ({
        rotulo: txt(i.alimento, 80),
        valor: `${Math.round(Number(i.quantidade_g) || 0)} g${i.medida_caseira ? ' (' + txt(i.medida_caseira, 60) + ')' : ''}`,
      })).concat(trocas.length ? [{ rotulo: 'Pode trocar', valor: trocas.join('\n'), destaque: 'ok' }] : []),
    })
  }

  const orient = (b.orientacoes || []).slice(0, 8).map((o) => '- ' + txt(o, 400))
  if (orient.length) secoes.push({ titulo: 'Orientações', linhas: [], texto: orient.join('\n') })
  secoes.push({
    titulo: 'Importante',
    linhas: [],
    texto: 'Este plano é uma sugestão alimentar montada a partir da sua avaliação física e da sua anamnese, revisada pelo MFCT Estúdio. Se algo mudar na sua rotina ou ficar difícil de seguir, fale com a gente pelo WhatsApp.',
  })

  const doc: Documento = {
    titulo: 'Plano alimentar',
    subtitulo: `CyberNutri - MFCT Estúdio${b.versao ? ' - versão ' + Math.round(b.versao) : ''}`,
    aluno: txt(b.aluno, 80),
    data: txt(b.data, 20),
    secoes,
  }
  const bytes = await gerarPdf(doc)
  const nome = txt(b.aluno, 80).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '')
  return NextResponse.json({ base64: Buffer.from(bytes).toString('base64'), fileName: `Plano_alimentar_${nome || 'aluno'}.pdf` })
}
