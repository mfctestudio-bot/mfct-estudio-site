// Dobras cutâneas — protocolos de Jackson & Pollock (3 e 7 dobras) + fórmula de Siri.
// Medidas em milímetros (mm). Idade em anos.

export type Sexo = 'M' | 'F'
export type Protocolo = 'jp3' | 'jp7'

export const DOBRAS: { chave: string; label: string; dica: string }[] = [
  { chave: 'peitoral', label: 'Peitoral', dica: 'Diagonal, entre a axila e o mamilo' },
  { chave: 'axilar', label: 'Axilar média', dica: 'Vertical, na linha do meio da axila, altura do esterno' },
  { chave: 'triceps', label: 'Tríceps', dica: 'Vertical, atrás do braço, no meio entre ombro e cotovelo' },
  { chave: 'subescapular', label: 'Subescapular', dica: 'Diagonal, logo abaixo da ponta da escápula' },
  { chave: 'abdominal', label: 'Abdominal', dica: 'Vertical, 2 cm ao lado do umbigo' },
  { chave: 'suprailiaca', label: 'Suprailíaca', dica: 'Diagonal, logo acima do osso do quadril' },
  { chave: 'coxa', label: 'Coxa', dica: 'Vertical, frente da coxa, no meio entre quadril e joelho' },
]

// Quais dobras cada protocolo usa
export function dobrasDoProtocolo(protocolo: Protocolo, sexo: Sexo): string[] {
  if (protocolo === 'jp7') return ['peitoral', 'axilar', 'triceps', 'subescapular', 'abdominal', 'suprailiaca', 'coxa']
  return sexo === 'M' ? ['peitoral', 'abdominal', 'coxa'] : ['triceps', 'suprailiaca', 'coxa']
}

export function calcularDobras(protocolo: Protocolo, sexo: Sexo, idade: number | null, valores: Record<string, number | null | undefined>) {
  if (!idade || idade <= 0) return null
  const usadas = dobrasDoProtocolo(protocolo, sexo)
  const nums = usadas.map(k => valores[k])
  if (nums.some(v => v == null || !(Number(v) > 0))) return null
  const S = nums.reduce<number>((t, v) => t + Number(v), 0)
  let D: number
  if (protocolo === 'jp7') {
    D = sexo === 'M'
      ? 1.112 - 0.00043499 * S + 0.00000055 * S * S - 0.00028826 * idade
      : 1.097 - 0.00046971 * S + 0.00000056 * S * S - 0.00012828 * idade
  } else {
    D = sexo === 'M'
      ? 1.10938 - 0.0008267 * S + 0.0000016 * S * S - 0.0002574 * idade
      : 1.0994921 - 0.0009929 * S + 0.0000023 * S * S - 0.0001392 * idade
  }
  const gorduraPct = (4.95 / D - 4.5) * 100
  return { soma: S, densidade: D, gorduraPct }
}

export function idadeEm(dataNascimento: string | null | undefined, naData: string) {
  if (!dataNascimento) return null
  const n = new Date(dataNascimento.slice(0, 10) + 'T12:00:00')
  const d = new Date(naData.slice(0, 10) + 'T12:00:00')
  let idade = d.getFullYear() - n.getFullYear()
  if (d.getMonth() < n.getMonth() || (d.getMonth() === n.getMonth() && d.getDate() < n.getDate())) idade--
  return idade > 0 && idade < 120 ? idade : null
}
