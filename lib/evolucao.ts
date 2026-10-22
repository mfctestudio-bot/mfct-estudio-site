// Destaque de evolução (22/10/2026, pedido do Matheus): compara a 1ª, a penúltima e a última
// avaliação (ou só 1ª x última, quando são 2) e diz o que melhorou. Usado na página do aluno
// (/avaliacao/<token>) e no PDF da avaliação, pra mostrar a mesma coisa nos dois lugares.

export type AvalEvolucao = {
  data: string
  peso: number | null
  imc?: number | null
  gordura_corporal_pct: number | null
  gordura_visceral?: number | null
  massa_muscular_pct: number | null
  idade_metabolica?: number | null
  objetivo?: string | null
}

type Campo = 'peso' | 'gordura_corporal_pct' | 'massa_muscular_pct' | 'gordura_visceral' | 'idade_metabolica' | 'imc'

// melhor: 'menos' = cair é bom; 'mais' = subir é bom; 'objetivo' = depende do objetivo (peso).
const METRICAS: { campo: Campo; label: string; un: string; casas: number; melhor: 'menos' | 'mais' | 'objetivo' }[] = [
  { campo: 'peso', label: 'Peso', un: 'kg', casas: 1, melhor: 'objetivo' },
  { campo: 'gordura_corporal_pct', label: 'Gordura corporal', un: '%', casas: 1, melhor: 'menos' },
  { campo: 'massa_muscular_pct', label: 'Massa muscular', un: '%', casas: 1, melhor: 'mais' },
  { campo: 'gordura_visceral', label: 'Gordura visceral', un: '', casas: 0, melhor: 'menos' },
  { campo: 'idade_metabolica', label: 'Idade corporal', un: 'anos', casas: 0, melhor: 'menos' },
]

export type Marco = { data: string; rotulo: string }
export type LinhaEvolucao = {
  label: string
  un: string
  valores: (number | null)[] // um por marco
  diferenca: number | null    // última - primeira
  situacao: 'melhorou' | 'piorou' | 'igual' | 'neutro'
  texto: string               // ex.: "80 → 78,2 → 76,5 kg (−3,5 kg)"
}

const fmt = (v: number, casas: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: casas, minimumFractionDigits: 0 })
const dataBR = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')

/** Escolhe as avaliações a comparar: 1ª, penúltima e última (sem repetir). */
export function marcos<T extends AvalEvolucao>(avaliacoesEmOrdem: T[]): T[] {
  const n = avaliacoesEmOrdem.length
  if (n < 2) return []
  if (n === 2) return [avaliacoesEmOrdem[0], avaliacoesEmOrdem[1]]
  return [avaliacoesEmOrdem[0], avaliacoesEmOrdem[n - 2], avaliacoesEmOrdem[n - 1]]
}

export function evolucao(avaliacoesEmOrdem: AvalEvolucao[]) {
  const ms = marcos(avaliacoesEmOrdem)
  if (!ms.length) return null
  const ultima = ms[ms.length - 1]
  const objetivo = ultima.objetivo || ''
  const nomes = ms.length === 2 ? ['1ª', 'Última'] : ['1ª', 'Anterior', 'Última']
  const cabecalho: Marco[] = ms.map((m, i) => ({ data: m.data, rotulo: `${nomes[i]} (${dataBR(m.data)})` }))

  const linhas: LinhaEvolucao[] = []
  for (const mt of METRICAS) {
    const valores = ms.map(m => (m[mt.campo] == null ? null : Number(m[mt.campo])))
    const conhecidos = valores.filter((v): v is number => v != null)
    if (conhecidos.length < 2) continue
    const primeiro = valores.find(v => v != null) as number
    const ultimo = [...valores].reverse().find(v => v != null) as number
    const dif = Math.round((ultimo - primeiro) * 10) / 10
    let melhor = mt.melhor
    if (melhor === 'objetivo') melhor = objetivo === 'emagrecimento' ? 'menos' : objetivo === 'hipertrofia' ? 'mais' : 'menos'
    const limiar = mt.casas === 0 ? 1 : 0.1
    const situacao: LinhaEvolucao['situacao'] =
      Math.abs(dif) < limiar ? 'igual'
        : mt.campo === 'peso' && objetivo !== 'emagrecimento' && objetivo !== 'hipertrofia' ? 'neutro'
          : (melhor === 'menos' ? dif < 0 : dif > 0) ? 'melhorou' : 'piorou'
    const un = mt.un ? (mt.un === '%' ? '%' : ` ${mt.un}`) : ''
    const difUn = mt.un === '%' ? ' pts' : un
    const seq = valores.map(v => (v == null ? '–' : fmt(v, mt.casas))).join(' → ')
    const texto = `${seq}${un}  (${dif > 0 ? '+' : dif < 0 ? '−' : ''}${fmt(Math.abs(dif), mt.casas)}${difUn})`
    linhas.push({ label: mt.label, un: mt.un, valores, diferenca: dif, situacao, texto })
  }
  if (!linhas.length) return null

  const melhorou = linhas.filter(l => l.situacao === 'melhorou').map(l => l.label.toLowerCase())
  const resumo = melhorou.length
    ? `Desde a 1ª avaliação, melhorou: ${melhorou.join(', ')}.`
    : 'Continue firme: a evolução aparece com constância.'

  return { cabecalho, linhas, resumo }
}
