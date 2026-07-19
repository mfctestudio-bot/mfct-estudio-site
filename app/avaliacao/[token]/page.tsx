const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tgpestsfhjrdahtzwodk.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

type Aluno = {
  id: string
  nome: string
  status_plano: string
  meta_peso: number | null
  meta_gordura_pct: number | null
}

type Avaliacao = {
  id: string
  data: string
  peso: number | null
  imc: number | null
  gordura_corporal_pct: number | null
  gordura_visceral: number | null
  massa_muscular_pct: number | null
  idade_metabolica: number | null
  nivel_atividade: string
  objetivo: string
}

const FATORES_ATIVIDADE: Record<string, { label: string; fator: number }> = {
  sedentario: { label: 'Sedentário', fator: 1.2 },
  leve: { label: 'Leve (1-3x/semana)', fator: 1.375 },
  moderado: { label: 'Moderado (3-5x/semana)', fator: 1.55 },
  intenso: { label: 'Intenso (6-7x/semana)', fator: 1.725 },
  muito_intenso: { label: 'Muito intenso', fator: 1.9 },
}

const OBJETIVOS: Record<string, { label: string; ajusteCalorico: number; proteinaGPorKg: number }> = {
  emagrecimento: { label: 'Emagrecimento', ajusteCalorico: -0.20, proteinaGPorKg: 2.2 },
  manutencao: { label: 'Manutenção', ajusteCalorico: 0, proteinaGPorKg: 2.0 },
  hipertrofia: { label: 'Hipertrofia', ajusteCalorico: 0.15, proteinaGPorKg: 1.8 },
}

// Katch-McArdle (usa massa magra, ideal com bioimpedância) — mesma fórmula do painel admin.
function calcularPlanoNutricional(peso: number | null, gorduraPct: number | null, nivelAtividade: string, objetivo: string) {
  if (peso == null || gorduraPct == null) return null
  const massaMagra = peso * (1 - gorduraPct / 100)
  const tmb = 370 + 21.6 * massaMagra
  const fator = FATORES_ATIVIDADE[nivelAtividade]?.fator || 1.55
  const manutencao = tmb * fator
  const obj = OBJETIVOS[objetivo] || OBJETIVOS.manutencao
  const metaCalorica = manutencao * (1 + obj.ajusteCalorico)
  const agua = peso * 0.035
  const proteinaG = peso * obj.proteinaGPorKg
  const proteinaCal = proteinaG * 4
  const gorduraCal = metaCalorica * 0.25
  const gorduraG = gorduraCal / 9
  const carboCal = Math.max(0, metaCalorica - proteinaCal - gorduraCal)
  const carboG = carboCal / 4
  return { massaMagra, tmb, manutencao, metaCalorica, agua, proteinaG, gorduraG, carboG, objetivoLabel: obj.label }
}

type Foto = { id: string; avaliacao_id: string; foto_url: string }

async function getDados(token: string) {
  if (!SERVICE_KEY) return { erro: 'config' as const }
  const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }

  const alunoResp = await fetch(
    `${SUPA_URL}/rest/v1/alunos?token_avaliacao=eq.${token}&select=id,nome,status_plano,meta_peso,meta_gordura_pct`,
    { headers, cache: 'no-store' }
  )
  const alunos: Aluno[] = await alunoResp.json().catch(() => [])
  if (!Array.isArray(alunos) || alunos.length === 0) return { erro: 'nao_encontrado' as const }
  const aluno = alunos[0]

  if (aluno.status_plano !== 'ativo') return { erro: 'plano_inativo' as const, aluno }

  const avalResp = await fetch(
    `${SUPA_URL}/rest/v1/avaliacoes?aluno_id=eq.${aluno.id}&status=eq.realizada&order=data.asc&select=id,data,peso,imc,gordura_corporal_pct,gordura_visceral,massa_muscular_pct,idade_metabolica,nivel_atividade,objetivo`,
    { headers, cache: 'no-store' }
  )
  const avaliacoes: Avaliacao[] = await avalResp.json().catch(() => [])

  let fotos: Foto[] = []
  if (avaliacoes.length > 0) {
    const ids = avaliacoes.map(a => a.id).join(',')
    const fotosResp = await fetch(
      `${SUPA_URL}/rest/v1/avaliacao_fotos?avaliacao_id=in.(${ids})&select=id,avaliacao_id,foto_url`,
      { headers, cache: 'no-store' }
    )
    fotos = await fotosResp.json().catch(() => [])
  }

  return { erro: null, aluno, avaliacoes, fotos }
}

export default async function AvaliacaoPublica({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const resultado = await getDados(token)

  if (resultado.erro === 'config') {
    return <Aviso titulo="Ops" texto="Erro de configuração do servidor. Fala com o Matheus." />
  }
  if (resultado.erro === 'nao_encontrado') {
    return <Aviso titulo="Link não encontrado" texto="Esse link não é válido. Confere com o estúdio se copiou certinho." />
  }
  if (resultado.erro === 'plano_inativo') {
    return (
      <Aviso
        titulo={`Oi, ${resultado.aluno!.nome.split(' ')[0]}!`}
        texto="Sua evolução fica disponível aqui enquanto seu plano está ativo. Fala com o Matheus pra regularizar e ver seus dados de novo."
      />
    )
  }

  const { aluno, avaliacoes, fotos } = resultado

  if (avaliacoes.length === 0) {
    return (
      <Aviso
        titulo={`Oi, ${aluno!.nome.split(' ')[0]}!`}
        texto="Você ainda não tem nenhuma avaliação registrada. Combina com o Matheus a sua primeira avaliação física!"
      />
    )
  }

  const ultima = avaliacoes[avaliacoes.length - 1]
  const primeira = avaliacoes[0]

  return (
    <div style={{ minHeight: '100vh', background: '#0a0e10', color: '#f2f4f5', fontFamily: 'system-ui, sans-serif', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>Sua evolução, {aluno!.nome.split(' ')[0]}</h1>
        <p style={{ fontSize: 13, color: '#9aa3a8', marginBottom: 24 }}>
          {avaliacoes.length} avaliaç{avaliacoes.length === 1 ? 'ão registrada' : 'ões registradas'} · última em {fmtData(ultima.data)}
        </p>

        <MetaCard aluno={aluno!} ultima={ultima} primeira={primeira} />

        <PlanoNutricionalCard ultima={ultima} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginTop: 20 }}>
          <GraficoEvolucao titulo="Peso (kg)" avaliacoes={avaliacoes} campo="peso" cor="#4a90d9" meta={aluno!.meta_peso} />
          <GraficoEvolucao titulo="Gordura corporal (%)" avaliacoes={avaliacoes} campo="gordura_corporal_pct" cor="#e05656" meta={aluno!.meta_gordura_pct} />
          <GraficoEvolucao titulo="Massa muscular (%)" avaliacoes={avaliacoes} campo="massa_muscular_pct" cor="#3fb950" meta={null} />
        </div>

        <h2 style={{ fontSize: 13, color: '#9aa3a8', letterSpacing: '1px', textTransform: 'uppercase', margin: '28px 0 12px' }}>Histórico</h2>
        <div style={{ display: 'grid', gap: 10 }}>
          {[...avaliacoes].reverse().map(a => {
            const fotosAval = fotos.filter(f => f.avaliacao_id === a.id)
            return (
              <div key={a.id} style={{ background: '#161c20', border: '1px solid #353e43', borderRadius: 8, padding: '12px 16px' }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{fmtData(a.data)}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 12, color: '#9aa3a8' }}>
                  {a.peso != null && <span>Peso: <b style={{ color: '#f2f4f5' }}>{a.peso} kg</b></span>}
                  {a.gordura_corporal_pct != null && <span>Gordura: <b style={{ color: '#f2f4f5' }}>{a.gordura_corporal_pct}%</b></span>}
                  {a.massa_muscular_pct != null && <span>Massa muscular: <b style={{ color: '#f2f4f5' }}>{a.massa_muscular_pct}%</b></span>}
                  {a.imc != null && <span>IMC: <b style={{ color: '#f2f4f5' }}>{a.imc}</b></span>}
                </div>
                {fotosAval.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    {fotosAval.map(f => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={f.id} src={f.foto_url} alt="Foto da avaliação" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6, border: '1px solid #353e43' }} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <p style={{ fontSize: 11, color: '#5e676c', marginTop: 28, textAlign: 'center' }}>MFCT Estúdio</p>
      </div>
    </div>
  )
}

function PlanoNutricionalCard({ ultima }: { ultima: Avaliacao }) {
  const plano = calcularPlanoNutricional(ultima.peso, ultima.gordura_corporal_pct, ultima.nivel_atividade, ultima.objetivo)
  if (!plano) return null

  return (
    <div style={{ background: '#161c20', border: '1px solid #353e43', borderRadius: 8, padding: '14px 16px', marginBottom: 4 }}>
      <div style={{ fontSize: 12, color: '#9aa3a8', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '1px' }}>
        Sua meta calórica e nutrientes ({plano.objetivoLabel})
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: '#3fb950', fontFamily: 'Georgia, serif', marginBottom: 2 }}>
        {Math.round(plano.metaCalorica)} kcal/dia
      </div>
      <p style={{ fontSize: 11, color: '#5e676c', marginBottom: 12 }}>
        Taxa de manutenção: {Math.round(plano.manutencao)} kcal · TMB: {Math.round(plano.tmb)} kcal
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 12 }}>
        <NutrienteBox label="Água" valor={`${plano.agua.toFixed(1)} L`} cor="#4a90d9" />
        <NutrienteBox label="Proteína" valor={`${Math.round(plano.proteinaG)} g`} cor="#e05656" />
        <NutrienteBox label="Carboidrato" valor={`${Math.round(plano.carboG)} g`} cor="#f0a500" />
        <NutrienteBox label="Gordura" valor={`${Math.round(plano.gorduraG)} g`} cor="#9aa3a8" />
      </div>
      <p style={{ fontSize: 10, color: '#5e676c', marginTop: 12 }}>
        Calculado a partir da sua última avaliação. Fala com o Matheus se quiser ajustar o objetivo ou o nível de atividade considerado.
      </p>
    </div>
  )
}

function NutrienteBox({ label, valor, cor }: { label: string; valor: string; cor: string }) {
  return (
    <div style={{ background: '#0a0e10', border: '1px solid #353e43', borderRadius: 6, padding: '8px 10px' }}>
      <div style={{ fontSize: 10, color: '#5e676c' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: cor }}>{valor}</div>
    </div>
  )
}

function fmtData(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0e10', color: '#f2f4f5', fontFamily: 'system-ui, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: 400, textAlign: 'center' }}>
        <h1 style={{ fontSize: 22, marginBottom: 10 }}>{titulo}</h1>
        <p style={{ fontSize: 14, color: '#9aa3a8' }}>{texto}</p>
      </div>
    </div>
  )
}

function MetaCard({ aluno, ultima, primeira }: { aluno: Aluno; ultima: Avaliacao; primeira: Avaliacao }) {
  const temMeta = aluno.meta_peso != null || aluno.meta_gordura_pct != null
  if (!temMeta) return null

  return (
    <div style={{ background: '#161c20', border: '1px solid #353e43', borderRadius: 8, padding: '14px 16px', marginBottom: 4 }}>
      <div style={{ fontSize: 12, color: '#9aa3a8', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '1px' }}>Sua meta</div>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        {aluno.meta_peso != null && ultima.peso != null && (
          <FaltaPara label="Peso" atual={ultima.peso} meta={aluno.meta_peso} unidade="kg" />
        )}
        {aluno.meta_gordura_pct != null && ultima.gordura_corporal_pct != null && (
          <FaltaPara label="Gordura corporal" atual={ultima.gordura_corporal_pct} meta={aluno.meta_gordura_pct} unidade="%" />
        )}
      </div>
    </div>
  )
}

function FaltaPara({ label, atual, meta, unidade }: { label: string; atual: number; meta: number; unidade: string }) {
  const diff = atual - meta
  const bateu = Math.abs(diff) < 0.1
  return (
    <div>
      <div style={{ fontSize: 11, color: '#9aa3a8' }}>{label} — meta {meta}{unidade}</div>
      {bateu ? (
        <div style={{ fontSize: 15, fontWeight: 700, color: '#3fb950' }}>🎉 Meta batida!</div>
      ) : (
        <div style={{ fontSize: 15, fontWeight: 700, color: '#f2f4f5' }}>
          Faltam <span style={{ color: '#3fb950' }}>{Math.abs(diff).toFixed(1)}{unidade}</span> {diff > 0 ? 'pra baixar' : 'pra subir'}
        </div>
      )}
    </div>
  )
}

function GraficoEvolucao({ titulo, avaliacoes, campo, cor, meta }: { titulo: string; avaliacoes: Avaliacao[]; campo: keyof Avaliacao; cor: string; meta: number | null }) {
  const pontos = avaliacoes
    .map(a => ({ data: a.data, valor: a[campo] as number | null }))
    .filter(p => p.valor != null) as { data: string; valor: number }[]

  if (pontos.length < 2) {
    return (
      <div style={{ background: '#161c20', border: '1px solid #353e43', borderRadius: 8, padding: '14px 16px' }}>
        <div style={{ fontSize: 12, color: '#9aa3a8', marginBottom: 8 }}>{titulo}</div>
        <p style={{ fontSize: 11, color: '#5e676c' }}>Precisa de mais avaliações pra mostrar esse gráfico.</p>
      </div>
    )
  }

  const largura = 260
  const altura = 90
  const pad = 18
  const valores = pontos.map(p => p.valor).concat(meta != null ? [meta] : [])
  const min = Math.min(...valores)
  const max = Math.max(...valores)
  const range = max - min || 1

  const coords = pontos.map((p, i) => {
    const x = pad + (i / (pontos.length - 1)) * (largura - pad * 2)
    const y = altura - pad - ((p.valor - min) / range) * (altura - pad * 2)
    return { x, y }
  })
  const linhaPath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')

  const metaY = meta != null ? altura - pad - ((meta - min) / range) * (altura - pad * 2) : null

  const primeiro = pontos[0].valor
  const ultimo = pontos[pontos.length - 1].valor
  const diff = ultimo - primeiro

  return (
    <div style={{ background: '#161c20', border: '1px solid #353e43', borderRadius: 8, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: '#9aa3a8' }}>{titulo}</span>
        <span style={{ fontSize: 12, fontWeight: 700 }}>{diff > 0 ? '+' : ''}{diff.toFixed(1)}</span>
      </div>
      <svg width="100%" viewBox={`0 0 ${largura} ${altura}`} style={{ display: 'block' }}>
        {metaY != null && (
          <line x1={pad} y1={metaY} x2={largura - pad} y2={metaY} stroke="#5e676c" strokeWidth={1} strokeDasharray="3,3" />
        )}
        <path d={linhaPath} fill="none" stroke={cor} strokeWidth={2} />
        {coords.map((c, i) => <circle key={i} cx={c.x} cy={c.y} r={3} fill={cor} />)}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#5e676c', marginTop: 4 }}>
        <span>{fmtData(pontos[0].data)}</span>
        <span>{fmtData(pontos[pontos.length - 1].data)}</span>
      </div>
    </div>
  )
}
