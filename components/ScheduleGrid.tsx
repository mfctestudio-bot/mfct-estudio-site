import { supabase, Horario } from '@/lib/supabase'

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

function GridTable({ dias, horarios, periodo, porHorarioDia }: {
  dias: { key: number; label: string }[]
  horarios: string[]
  periodo: string
  porHorarioDia: Map<string, boolean>
}) {
  if (horarios.length === 0) {
    return (
      <div>
        <h3 style={{ fontSize: 14, color: 'var(--accent)', letterSpacing: '1px', marginBottom: 10 }}>{periodo}</h3>
        <p style={{ fontSize: 13, color: 'var(--text3)' }}>Nenhum horário disponível nesse período no momento.</p>
      </div>
    )
  }
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
                    {porHorarioDia.get(`${d.key}-${h}`) && (
                      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'var(--accent)' }} title="Aula" />
                    )}
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

export default async function ScheduleGrid() {
  const { data } = await supabase
    .from('horarios')
    .select('*')
    .eq('ativo', true)
    .order('horario')

  const horarios: Horario[] = data || []

  // Mapa "diaSemana-horario" -> existe e ativo
  const porHorarioDia = new Map<string, boolean>()
  for (const h of horarios) {
    porHorarioDia.set(`${h.dia_semana}-${h.horario.slice(0, 5)}`, true)
  }

  // Union de horarios distintos, separados por periodo (seg-sex vs fim de semana)
  const diasSemanaKeys = new Set(DIAS_SEMANA.map(d => d.key))
  const diasFimKeys = new Set(DIAS_FIM.map(d => d.key))

  const horariosSemana = Array.from(new Set(
    horarios.filter(h => diasSemanaKeys.has(h.dia_semana)).map(h => h.horario.slice(0, 5))
  )).sort()

  const horariosFim = Array.from(new Set(
    horarios.filter(h => diasFimKeys.has(h.dia_semana)).map(h => h.horario.slice(0, 5))
  )).sort()

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <GridTable dias={DIAS_SEMANA} horarios={horariosSemana} periodo="SEGUNDA A SEXTA" porHorarioDia={porHorarioDia} />
      <GridTable dias={DIAS_FIM} horarios={horariosFim} periodo="SÁBADO E DOMINGO" porHorarioDia={porHorarioDia} />
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
