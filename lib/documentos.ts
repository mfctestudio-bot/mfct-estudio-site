// Monta o conteúdo dos PDFs de anamnese e avaliação (só no servidor). (03/10/2026)
import { createClient } from '@supabase/supabase-js'
import { ANAMNESE, ALERTAS, type Respostas } from '@/lib/anamnese'
import { DOBRAS } from '@/lib/dobras'
import type { Documento, Secao, Linha } from '@/lib/pdf'

export function servidor() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase não configurado no servidor')
  return createClient(url, key)
}

const dataBR = (iso: string) => new Date(iso.length <= 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
const num = (v: unknown, casas = 1) => (v == null || v === '' ? null : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: casas }))

type AlunoBasico = { id: string; nome: string; telefone: string | null; data_nascimento: string | null }

export async function docAnamnese(alunoId: string): Promise<{ doc: Documento; aluno: AlunoBasico } | null> {
  const sb = servidor()
  const [{ data: aluno }, { data: fichas }] = await Promise.all([
    sb.from('alunos').select('id, nome, telefone, data_nascimento').eq('id', alunoId).maybeSingle(),
    sb.from('anamneses').select('*').eq('aluno_id', alunoId).order('atualizado_em', { ascending: false }).limit(1),
  ])
  if (!aluno) return null
  const ficha = (fichas || [])[0] as { respostas: Respostas; atualizado_em: string; status: string } | undefined
  const r: Respostas = ficha?.respostas || {}
  const a = aluno as AlunoBasico
  const secoes: Secao[] = [
    {
      titulo: 'Identificação',
      linhas: [
        { rotulo: 'Nome', valor: a.nome },
        { rotulo: 'Data de nascimento', valor: a.data_nascimento ? dataBR(a.data_nascimento) : '-' },
        { rotulo: 'Telefone', valor: a.telefone || '-' },
      ],
    },
    ...ANAMNESE.map(g => ({
      titulo: g.titulo,
      linhas: g.perguntas.map<Linha>(p => {
        const v = (r[p.chave] || '').trim()
        const alerta = ALERTAS.includes(p.chave) && /^s/i.test(v)
        return { rotulo: p.pergunta, valor: v || '-', destaque: alerta ? 'alerta' : undefined }
      }),
    })),
  ]
  return {
    aluno: a,
    doc: {
      titulo: 'Ficha de anamnese',
      subtitulo: ficha ? `Situação: ${ficha.status === 'completa' ? 'completa' : 'em preenchimento'}` : 'Ainda não preenchida',
      aluno: a.nome,
      data: ficha ? `Atualizada em ${dataBR(ficha.atualizado_em)}` : '',
      secoes,
    },
  }
}

// Mesma conta da tela de Avaliações (Katch-McArdle + ajuste pelo objetivo).
const FATORES: Record<string, { label: string; fator: number }> = {
  sedentario: { label: 'Sedentário', fator: 1.2 }, leve: { label: 'Leve (1-3x/semana)', fator: 1.375 },
  moderado: { label: 'Moderado (3-5x/semana)', fator: 1.55 }, intenso: { label: 'Intenso (6-7x/semana)', fator: 1.725 },
  muito_intenso: { label: 'Muito intenso', fator: 1.9 },
}
const OBJETIVOS: Record<string, { label: string; ajuste: number; prot: number }> = {
  emagrecimento: { label: 'Emagrecimento', ajuste: -0.2, prot: 2.2 }, manutencao: { label: 'Manutenção', ajuste: 0, prot: 2.0 },
  hipertrofia: { label: 'Hipertrofia', ajuste: 0.15, prot: 1.8 },
}
const OMRON_EXTRA: { chave: string; label: string; un: string }[] = [
  { chave: 'metabolismo_repouso', label: 'Metabolismo de repouso', un: 'kcal' },
  { chave: 'gordura_sub_corpo', label: 'Gordura subcutânea - corpo inteiro', un: '%' },
  { chave: 'gordura_sub_tronco', label: 'Gordura subcutânea - tronco', un: '%' },
  { chave: 'gordura_sub_bracos', label: 'Gordura subcutânea - braços', un: '%' },
  { chave: 'gordura_sub_pernas', label: 'Gordura subcutânea - pernas', un: '%' },
  { chave: 'musculo_tronco', label: 'Músculo esquelético - tronco', un: '%' },
  { chave: 'musculo_bracos', label: 'Músculo esquelético - braços', un: '%' },
  { chave: 'musculo_pernas', label: 'Músculo esquelético - pernas', un: '%' },
]

type Aval = {
  id: string; aluno_id: string; data: string; peso: number | null; imc: number | null; gordura_corporal_pct: number | null
  gordura_visceral: number | null; massa_muscular_pct: number | null; idade_metabolica: number | null
  nivel_atividade: string; objetivo: string; observacoes: string | null
  medidas: { omron?: Record<string, number>; dobras?: { protocolo: string; sexo: string; valores: Record<string, number>; soma?: number; gordura_pct?: number } } | null
}

export async function docAvaliacao(avaliacaoId: string): Promise<{ doc: Documento; aluno: AlunoBasico } | null> {
  const sb = servidor()
  const { data: av } = await sb.from('avaliacoes').select('*').eq('id', avaliacaoId).maybeSingle()
  if (!av) return null
  const a = av as Aval
  const [{ data: aluno }, { data: anteriores }] = await Promise.all([
    sb.from('alunos').select('id, nome, telefone, data_nascimento, meta_peso, meta_gordura_pct').eq('id', a.aluno_id).maybeSingle(),
    sb.from('avaliacoes').select('data, peso, gordura_corporal_pct, massa_muscular_pct').eq('aluno_id', a.aluno_id).lt('data', a.data).order('data', { ascending: false }).limit(1),
  ])
  if (!aluno) return null
  const al = aluno as AlunoBasico & { meta_peso: number | null; meta_gordura_pct: number | null }
  const ant = (anteriores || [])[0] as { data: string; peso: number | null; gordura_corporal_pct: number | null; massa_muscular_pct: number | null } | undefined

  const dif = (atual: number | null, antes: number | null | undefined, un: string) => {
    if (atual == null || antes == null) return ''
    const d = Number(atual) - Number(antes)
    return ` (${d > 0 ? '+' : ''}${num(d)} ${un} desde ${dataBR(ant!.data)})`
  }
  const medicoes: Linha[] = [
    { rotulo: 'Peso', valor: a.peso != null ? `${num(a.peso)} kg${dif(a.peso, ant?.peso, 'kg')}` : '-' },
    { rotulo: 'IMC', valor: num(a.imc) || '-' },
    { rotulo: 'Gordura corporal', valor: a.gordura_corporal_pct != null ? `${num(a.gordura_corporal_pct)}%${dif(a.gordura_corporal_pct, ant?.gordura_corporal_pct, 'pts')}` : '-' },
    { rotulo: 'Gordura visceral', valor: num(a.gordura_visceral, 0) || '-' },
    { rotulo: 'Músculo esquelético', valor: a.massa_muscular_pct != null ? `${num(a.massa_muscular_pct)}%${dif(a.massa_muscular_pct, ant?.massa_muscular_pct, 'pts')}` : '-' },
    { rotulo: 'Idade corporal', valor: a.idade_metabolica != null ? `${num(a.idade_metabolica, 0)} anos` : '-' },
  ]
  const secoes: Secao[] = [{ titulo: 'Medições (balança Omron HBF-514C)', linhas: medicoes }]

  const extra = a.medidas?.omron || {}
  const linhasExtra = OMRON_EXTRA.filter(c => extra[c.chave] != null).map(c => ({ rotulo: c.label, valor: `${num(extra[c.chave])} ${c.un}` }))
  if (linhasExtra.length) secoes.push({ titulo: 'Detalhes por região', linhas: linhasExtra })

  const db = a.medidas?.dobras
  if (db && db.valores) {
    const linhas: Linha[] = DOBRAS.filter(d => db.valores[d.chave] != null).map(d => ({ rotulo: d.label, valor: `${num(db.valores[d.chave])} mm` }))
    if (db.soma != null) linhas.push({ rotulo: 'Soma das dobras', valor: `${num(db.soma)} mm` })
    if (db.gordura_pct != null) linhas.push({ rotulo: 'Gordura pelas dobras', valor: `${num(db.gordura_pct)}%` })
    secoes.push({ titulo: `Dobras cutâneas (Jackson & Pollock ${db.protocolo === 'jp7' ? '7' : '3'} dobras)`, linhas })
  }

  if (a.peso != null && a.gordura_corporal_pct != null) {
    const magra = a.peso * (1 - a.gordura_corporal_pct / 100)
    const tmb = 370 + 21.6 * magra
    const manut = tmb * (FATORES[a.nivel_atividade]?.fator || 1.55)
    const obj = OBJETIVOS[a.objetivo] || OBJETIVOS.manutencao
    const meta = manut * (1 + obj.ajuste)
    const prot = a.peso * obj.prot
    const gord = (meta * 0.25) / 9
    const carbo = Math.max(0, meta - prot * 4 - meta * 0.25) / 4
    secoes.push({
      titulo: 'Plano de calorias e macros',
      linhas: [
        { rotulo: 'Objetivo', valor: obj.label },
        { rotulo: 'Nível de atividade', valor: FATORES[a.nivel_atividade]?.label || '-' },
        { rotulo: 'Massa magra', valor: `${num(magra)} kg` },
        { rotulo: 'Gasto em repouso (TMB)', valor: `${Math.round(tmb)} kcal/dia` },
        { rotulo: 'Gasto do dia a dia', valor: `${Math.round(manut)} kcal/dia` },
        { rotulo: 'Meta de calorias', valor: `${Math.round(meta)} kcal/dia`, destaque: 'ok' },
        { rotulo: 'Proteína', valor: `${Math.round(prot)} g/dia` },
        { rotulo: 'Carboidrato', valor: `${Math.round(carbo)} g/dia` },
        { rotulo: 'Gordura', valor: `${Math.round(gord)} g/dia` },
        { rotulo: 'Água', valor: `${num(a.peso * 0.035)} litros/dia` },
      ],
    })
  }

  if (al.meta_peso != null || al.meta_gordura_pct != null) {
    secoes.push({
      titulo: 'Metas',
      linhas: [
        ...(al.meta_peso != null ? [{ rotulo: 'Meta de peso', valor: `${num(al.meta_peso)} kg` }] : []),
        ...(al.meta_gordura_pct != null ? [{ rotulo: 'Meta de gordura corporal', valor: `${num(al.meta_gordura_pct)}%` }] : []),
      ],
    })
  }
  if (a.observacoes) secoes.push({ titulo: 'Observações', linhas: [], texto: a.observacoes })

  return {
    aluno: al,
    doc: { titulo: 'Avaliação física', subtitulo: 'Resultado da sua avaliação no MFCT Estúdio', aluno: al.nome, data: dataBR(a.data), secoes },
  }
}

export function nomeArquivo(tipo: string, nome: string, data?: string) {
  const base = `${tipo}-${nome}`.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()
  return `${base}${data ? '-' + data : ''}.pdf`
}
