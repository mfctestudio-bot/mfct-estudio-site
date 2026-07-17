'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseAdmin'

type Aluno = { id: string; nome: string; status_plano: string }

type Avaliacao = {
  id: string
  aluno_id: string
  data: string
  horario: string
  status: string
  peso: number | null
  imc: number | null
  gordura_corporal_pct: number | null
  gordura_visceral: number | null
  massa_muscular_pct: number | null
  idade_metabolica: number | null
  nivel_atividade: string
  observacoes: string | null
  valor: number
  pago: boolean
  created_at: string
}

type Foto = { id: string; avaliacao_id: string; foto_url: string }

const FATORES_ATIVIDADE: Record<string, { label: string; fator: number }> = {
  sedentario: { label: 'Sedentário (pouco ou nenhum exercício)', fator: 1.2 },
  leve: { label: 'Leve (1-3x/semana)', fator: 1.375 },
  moderado: { label: 'Moderado (3-5x/semana)', fator: 1.55 },
  intenso: { label: 'Intenso (6-7x/semana)', fator: 1.725 },
  muito_intenso: { label: 'Muito intenso (2x/dia ou trabalho físico)', fator: 1.9 },
}

// Fórmula de Katch-McArdle: usa massa magra (peso x % de gordura), ideal pra quem tem
// bioimpedância — mais precisa que fórmulas que só usam peso/altura/idade.
function calcularMetabolismo(peso: number | null, gorduraPct: number | null, nivelAtividade: string) {
  if (peso == null || gorduraPct == null) return null
  const massaMagra = peso * (1 - gorduraPct / 100)
  const tmb = 370 + 21.6 * massaMagra
  const fator = FATORES_ATIVIDADE[nivelAtividade]?.fator || 1.55
  const manutencao = tmb * fator
  return { massaMagra, tmb, manutencao }
}

const CAMPOS_OMRON: { chave: keyof Avaliacao; label: string; unidade: string; step: string }[] = [
  { chave: 'peso', label: 'Peso', unidade: 'kg', step: '0.1' },
  { chave: 'imc', label: 'IMC', unidade: '', step: '0.1' },
  { chave: 'gordura_corporal_pct', label: 'Gordura corporal', unidade: '%', step: '0.1' },
  { chave: 'gordura_visceral', label: 'Gordura visceral', unidade: '', step: '1' },
  { chave: 'massa_muscular_pct', label: 'Massa muscular', unidade: '%', step: '0.1' },
  { chave: 'idade_metabolica', label: 'Idade metabólica', unidade: 'anos', step: '1' },
]

export default function AvaliacoesPage() {
  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [alunoId, setAlunoId] = useState('')
  const [buscaAluno, setBuscaAluno] = useState('')
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([])
  const [fotos, setFotos] = useState<Foto[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingAluno, setLoadingAluno] = useState(false)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const [novaData, setNovaData] = useState(() => new Date().toISOString().slice(0, 10))
  const [novosValores, setNovosValores] = useState<Record<string, string>>({})
  const [novaObs, setNovaObs] = useState('')
  const [novoPago, setNovoPago] = useState(true)
  const [novoValorCobrado, setNovoValorCobrado] = useState('30')
  const [novoNivelAtividade, setNovoNivelAtividade] = useState('moderado')

  async function carregarAlunos() {
    setLoading(true)
    const { data } = await supabase
      .from('alunos')
      .select('id, nome, status_plano')
      .eq('status_plano', 'ativo')
      .order('nome')
    setAlunos((data as Aluno[]) || [])
    setLoading(false)
  }

  useEffect(() => { carregarAlunos() }, [])

  async function carregarHistorico(id: string) {
    if (!id) { setAvaliacoes([]); setFotos([]); return }
    setLoadingAluno(true)
    const { data: avals } = await supabase
      .from('avaliacoes')
      .select('*')
      .eq('aluno_id', id)
      .order('data', { ascending: true })
    const lista = (avals as Avaliacao[]) || []
    setAvaliacoes(lista)

    if (lista.length > 0) {
      const ids = lista.map(a => a.id)
      const { data: fotosData } = await supabase
        .from('avaliacao_fotos')
        .select('id, avaliacao_id, foto_url')
        .in('avaliacao_id', ids)
      setFotos((fotosData as Foto[]) || [])
    } else {
      setFotos([])
    }
    setLoadingAluno(false)
  }

  useEffect(() => { carregarHistorico(alunoId) }, [alunoId])

  async function salvarAvaliacao() {
    if (!alunoId) return
    setSalvando(true)

    const corpo: Record<string, unknown> = {
      aluno_id: alunoId,
      data: novaData,
      horario: '09:30:00',
      status: 'realizada',
      observacoes: novaObs || null,
      valor: Number(novoValorCobrado) || 30,
      pago: novoPago,
      pago_em: novoPago ? new Date().toISOString() : null,
      nivel_atividade: novoNivelAtividade,
    }
    for (const campo of CAMPOS_OMRON) {
      const v = novosValores[campo.chave as string]
      corpo[campo.chave as string] = v ? Number(v) : null
    }

    await supabase.from('avaliacoes').insert(corpo)

    setNovosValores({})
    setNovaObs('')
    setNovoPago(true)
    setNovoValorCobrado('30')
    setNovoNivelAtividade('moderado')
    setNovaData(new Date().toISOString().slice(0, 10))
    setMostrarForm(false)
    setSalvando(false)
    carregarHistorico(alunoId)
  }

  const alunosFiltrados = alunos.filter(a => a.nome.toLowerCase().includes(buscaAluno.toLowerCase()))
  const alunoAtual = alunos.find(a => a.id === alunoId)

  if (loading) return <p style={{ color: 'var(--text2)' }}>Carregando...</p>

  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Avaliações Físicas</h1>
      <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>
        Registre os dados da balança Omron pra cada avaliação. Valor padrão R$ 30 por avaliação. As fotos que o aluno manda pelo WhatsApp mencionando &quot;avaliação&quot; entram aqui automaticamente.
      </p>

      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, marginBottom: 6, display: 'block' }}>Aluno</label>
        <input
          placeholder="Buscar aluno..."
          value={buscaAluno}
          onChange={e => setBuscaAluno(e.target.value)}
          style={{ width: '100%', maxWidth: 320, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', marginBottom: 8, boxSizing: 'border-box' }}
        />
        <select
          value={alunoId}
          onChange={e => setAlunoId(e.target.value)}
          style={{ width: '100%', maxWidth: 320, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit' }}
        >
          <option value="">— selecione —</option>
          {alunosFiltrados.map(a => (
            <option key={a.id} value={a.id}>{a.nome}</option>
          ))}
        </select>
      </div>

      {!alunoId ? (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, padding: '1.5rem', color: 'var(--text2)', fontSize: 13 }}>
          Selecione um aluno pra ver o histórico ou registrar uma nova avaliação.
        </div>
      ) : loadingAluno ? (
        <p style={{ color: 'var(--text2)' }}>Carregando histórico...</p>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <h2 style={{ fontSize: 18 }}>{alunoAtual?.nome}</h2>
            <button onClick={() => setMostrarForm(v => !v)} style={{
              background: mostrarForm ? 'transparent' : '#3fb950', border: mostrarForm ? '1px solid var(--border2)' : 'none',
              color: mostrarForm ? 'var(--text2)' : '#fff', borderRadius: 6, padding: '9px 16px', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              {mostrarForm ? 'Cancelar' : '+ Registrar avaliação'}
            </button>
          </div>

          {mostrarForm && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginBottom: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, marginBottom: 6, display: 'block' }}>Data</label>
                  <input
                    type="date" value={novaData} onChange={e => setNovaData(e.target.value)}
                    style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }}
                  />
                </div>
                {CAMPOS_OMRON.map(campo => (
                  <div key={campo.chave as string}>
                    <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, marginBottom: 6, display: 'block' }}>
                      {campo.label}{campo.unidade ? ` (${campo.unidade})` : ''}
                    </label>
                    <input
                      type="number" step={campo.step} placeholder="—"
                      value={novosValores[campo.chave as string] || ''}
                      onChange={e => setNovosValores(prev => ({ ...prev, [campo.chave as string]: e.target.value }))}
                      style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }}
                    />
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, marginBottom: 6, display: 'block' }}>Nível de atividade (pra calcular a taxa de manutenção)</label>
                <select
                  value={novoNivelAtividade} onChange={e => setNovoNivelAtividade(e.target.value)}
                  style={{ width: '100%', maxWidth: 320, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit' }}
                >
                  {Object.entries(FATORES_ATIVIDADE).map(([chave, info]) => (
                    <option key={chave} value={chave}>{info.label}</option>
                  ))}
                </select>
              </div>

              {(() => {
                const peso = Number(novosValores.peso)
                const gordura = Number(novosValores.gordura_corporal_pct)
                const calc = peso && gordura ? calcularMetabolismo(peso, gordura, novoNivelAtividade) : null
                if (!calc) return (
                  <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 14 }}>
                    Preenche peso e % de gordura corporal pra ver a taxa de manutenção calculada.
                  </p>
                )
                return (
                  <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 14px', marginBottom: 14, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text3)' }}>Massa magra</div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{calc.massaMagra.toFixed(1)} kg</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text3)' }}>TMB (repouso)</div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{Math.round(calc.tmb)} kcal</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text3)' }}>Taxa de manutenção</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#3fb950', fontFamily: 'Anton, sans-serif' }}>{Math.round(calc.manutencao)} kcal/dia</div>
                    </div>
                  </div>
                )
              })()}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, marginBottom: 6, display: 'block' }}>Valor cobrado (R$)</label>
                  <input
                    type="number" step="0.01" value={novoValorCobrado} onChange={e => setNovoValorCobrado(e.target.value)}
                    style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                    <input type="checkbox" checked={novoPago} onChange={e => setNovoPago(e.target.checked)} />
                    Já foi pago
                  </label>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, marginBottom: 6, display: 'block' }}>Observações</label>
                <textarea
                  value={novaObs} onChange={e => setNovaObs(e.target.value)} rows={3}
                  style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>

              <button onClick={salvarAvaliacao} disabled={salvando} style={{
                background: '#3fb950', border: 'none', color: '#fff', borderRadius: 6,
                padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: salvando ? 0.6 : 1,
              }}>
                {salvando ? 'Salvando...' : '✅ Salvar avaliação'}
              </button>
            </div>
          )}

          {avaliacoes.length === 0 ? (
            <p style={{ color: 'var(--text2)', fontSize: 13 }}>Nenhuma avaliação registrada ainda pra esse aluno.</p>
          ) : (
            <>
              <EvolucaoCharts avaliacoes={avaliacoes} />

              <h3 style={{ fontSize: 13, color: 'var(--text2)', letterSpacing: '1px', textTransform: 'uppercase', margin: '24px 0 12px' }}>
                Histórico
              </h3>
              <div style={{ display: 'grid', gap: 10 }}>
                {[...avaliacoes].reverse().map(a => {
                  const fotosAval = fotos.filter(f => f.avaliacao_id === a.id)
                  const dataFmt = new Date(a.data + 'T12:00:00').toLocaleDateString('pt-BR')
                  return (
                    <div key={a.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, padding: '12px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{dataFmt}</span>
                        <span style={{ fontSize: 11, color: a.pago ? '#3fb950' : 'var(--accent2)' }}>
                          {a.pago ? `✅ Pago (R$ ${Number(a.valor).toFixed(2)})` : `⏳ Pendente (R$ ${Number(a.valor).toFixed(2)})`}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 12, color: 'var(--text2)' }}>
                        {a.peso != null && <span>Peso: <b style={{ color: 'var(--text)' }}>{a.peso} kg</b></span>}
                        {a.imc != null && <span>IMC: <b style={{ color: 'var(--text)' }}>{a.imc}</b></span>}
                        {a.gordura_corporal_pct != null && <span>Gordura: <b style={{ color: 'var(--text)' }}>{a.gordura_corporal_pct}%</b></span>}
                        {a.gordura_visceral != null && <span>G. visceral: <b style={{ color: 'var(--text)' }}>{a.gordura_visceral}</b></span>}
                        {a.massa_muscular_pct != null && <span>Massa muscular: <b style={{ color: 'var(--text)' }}>{a.massa_muscular_pct}%</b></span>}
                        {a.idade_metabolica != null && <span>Idade metabólica: <b style={{ color: 'var(--text)' }}>{a.idade_metabolica}</b></span>}
                      </div>
                      {(() => {
                        const calc = calcularMetabolismo(a.peso, a.gordura_corporal_pct, a.nivel_atividade)
                        if (!calc) return null
                        return (
                          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8 }}>
                            Taxa de manutenção: <b style={{ color: '#3fb950' }}>{Math.round(calc.manutencao)} kcal/dia</b>
                            <span style={{ color: 'var(--text3)' }}> (TMB {Math.round(calc.tmb)} kcal · {FATORES_ATIVIDADE[a.nivel_atividade]?.label || a.nivel_atividade})</span>
                          </div>
                        )
                      })()}
                      {a.observacoes && <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>{a.observacoes}</p>}
                      {fotosAval.length > 0 && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                          {fotosAval.map(f => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={f.id} src={f.foto_url} alt="Foto da avaliação" style={{ width: 70, height: 70, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function EvolucaoCharts({ avaliacoes }: { avaliacoes: Avaliacao[] }) {
  if (avaliacoes.length < 2) {
    return (
      <p style={{ fontSize: 12, color: 'var(--text3)' }}>
        Precisa de pelo menos 2 avaliações registradas pra mostrar o gráfico de evolução.
      </p>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
      <MiniLineChart titulo="Peso (kg)" avaliacoes={avaliacoes} campo="peso" cor="#4a90d9" />
      <MiniLineChart titulo="Gordura corporal (%)" avaliacoes={avaliacoes} campo="gordura_corporal_pct" cor="#e05656" />
      <MiniLineChart titulo="Massa muscular (%)" avaliacoes={avaliacoes} campo="massa_muscular_pct" cor="#3fb950" />
    </div>
  )
}

function MiniLineChart({ titulo, avaliacoes, campo, cor }: { titulo: string; avaliacoes: Avaliacao[]; campo: keyof Avaliacao; cor: string }) {
  const pontos = avaliacoes
    .map(a => ({ data: a.data, valor: a[campo] as number | null }))
    .filter(p => p.valor != null) as { data: string; valor: number }[]

  if (pontos.length < 2) {
    return (
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px' }}>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>{titulo}</div>
        <p style={{ fontSize: 11, color: 'var(--text3)' }}>Dados insuficientes pra esse gráfico ainda.</p>
      </div>
    )
  }

  const largura = 260
  const altura = 90
  const pad = 18
  const min = Math.min(...pontos.map(p => p.valor))
  const max = Math.max(...pontos.map(p => p.valor))
  const range = max - min || 1

  const coords = pontos.map((p, i) => {
    const x = pad + (i / (pontos.length - 1)) * (largura - pad * 2)
    const y = altura - pad - ((p.valor - min) / range) * (altura - pad * 2)
    return { x, y, valor: p.valor }
  })

  const linhaPath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')
  const primeiro = pontos[0].valor
  const ultimo = pontos[pontos.length - 1].valor
  const diff = ultimo - primeiro
  const melhorou = campo === 'massa_muscular_pct' ? diff >= 0 : diff <= 0

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--text2)' }}>{titulo}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: diff === 0 ? 'var(--text3)' : melhorou ? '#3fb950' : 'var(--accent2)' }}>
          {diff > 0 ? '+' : ''}{diff.toFixed(1)}
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${largura} ${altura}`} style={{ display: 'block' }}>
        <path d={linhaPath} fill="none" stroke={cor} strokeWidth={2} />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={3} fill={cor} />
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
        <span>{new Date(pontos[0].data + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
        <span>{new Date(pontos[pontos.length - 1].data + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
      </div>
    </div>
  )
}
