// Data de "hoje" no fuso de São Paulo, no formato AAAA-MM-DD (22/10/2026).
// Antes várias telas usavam new Date().toISOString().slice(0, 10), que é a data em UTC:
// das 21h à meia-noite isso já dava o dia SEGUINTE (pagamento confirmado à noite caía
// com a data de amanhã, mensalidade que vence hoje aparecia como vencida etc.).
export function hojeSP(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

/** Data em São Paulo daqui a N dias (N pode ser negativo). */
export function diasAPartirDeHojeSP(n: number): string {
  return hojeSP(new Date(Date.now() + n * 24 * 60 * 60 * 1000))
}
