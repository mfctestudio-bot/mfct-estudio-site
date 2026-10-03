// Cartão de número grande (ex.: "R$ 1.200,00 — A pagar esse mês").
export function CardNumero({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="card card-hover" style={{ padding: '1.25rem' }}>
      <div style={{ fontFamily: 'Anton, sans-serif', fontSize: 28, color: accent || 'var(--accent)' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 6 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}
