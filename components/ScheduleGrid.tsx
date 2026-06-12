const DIAS_SEMANA = [
  { key: 1, label: 'SEG' },
  { key: 2, label: 'TER' },
  { key: 3, label: 'QUA' },
  { key: 4, label: 'QUI' },
  { key: 5, label: 'SEX' },
]
const DIAS_FIM = [
  { key: 6, label: 'SÁB' },
  { key: 0, label: 'DOM' },
]

const HORARIOS_SEMANA = ['08:30', '09:30', '10:30', '17:00', '18:00', '19:00', '20:00', '21:00']
const HORARIOS_FIM = ['08:00', '09:00', '10:00', '11:00']

function GridTable({ dias, horarios, periodo }: { dias: { key: number; label: string }[]; horarios: string[]; periodo: string }) {
  return (
    <div>
      <h3 style={{ fontSize: 14, color: 'var(--accent)', letterSpacing: '1px', marginBottom: 10 }}>{periodo}</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 360, borderCollapse: 'collapse', background: 'var(--card)', border: '1px solid var(--border)' }}>
          <thead>
            <tr>
              <th style={cellStyle(true)}>Horário</th>
              {dias.map(d => <th key={d.key} style={cellStyle(true)}>{d.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {horarios.map(h => (
              <tr key={h}>
                <td style={{ ...cellStyle(false), fontWeight: 700, color: 'var(--text2)' }}>{h}</td>
                {dias.map(d => (
                  <td key={d.key} style={cellStyle(false)}>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'var(--accent)' }} title="Aula" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function ScheduleGrid() {
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <GridTable dias={DIAS_SEMANA} horarios={HORARIOS_SEMANA} periodo="SEGUNDA A SEXTA" />
      <GridTable dias={DIAS_FIM} horarios={HORARIOS_FIM} periodo="SÁBADO E DOMINGO" />
      <p style={{ fontSize: 12, color: 'var(--text3)' }}>
        Aulas de 1 hora. Pra agendar seu horário, fale com a gente no WhatsApp.
      </p>
    </div>
  )
}

function cellStyle(header: boolean): React.CSSProperties {
  return {
    border: '1px solid var(--border)',
    padding: '10px 8px',
    textAlign: 'center',
    fontSize: header ? 12 : 14,
    fontWeight: header ? 800 : 400,
    color: header ? 'var(--accent)' : 'var(--text)',
    letterSpacing: header ? '1px' : 0,
    background: header ? 'var(--bg2)' : 'transparent',
  }
}
