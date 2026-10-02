'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseAdmin'
import { periodoAtualHoje } from '@/lib/periodos'
import { DOBRAS, dobrasDoProtocolo, calcularDobras, idadeEm, type Sexo, type Protocolo } from '@/lib/dobras'

type Aluno = { id: string; nome: string; status_plano: string; meta_peso: number | null; meta_gordura_pct: number | null; token_avaliacao: string; data_nascimento: string | null }

type Medidas = {
  omron?: Record<string, number>
  dobras?: { protocolo: Protocolo; sexo: Sexo; idade: number | null; valores: Record<string, number>; soma?: number; densidade?: number; gordura_pct?: number }
}

type ServicoAvaliacao = { id: string; nome: string; valor: number }

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
  objetivo: string
  observacoes: string | null
  valor: number
  pago: boolean
  medidas: Medidas | null
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

const OBJETIVOS: Record<string, { label: string; ajusteCalorico: number; proteinaGPorKg: number }> = {
  emagrecimento: { label: 'Emagrecimento (déficit)', ajusteCalorico: -0.20, proteinaGPorKg: 2.2 },
  manutencao: { label: 'Manutenção', ajusteCalorico: 0, proteinaGPorKg: 2.0 },
  hipertrofia: { label: 'Hipertrofia (superávit)', ajusteCalorico: 0.15, proteinaGPorKg: 1.8 },
}

// Meta calórica ajustada pelo objetivo (déficit de 20% ou superávit de 15% sobre a manutenção),
// proteína em g/kg de peso total (mais alta no déficit pra preservar massa magra),
// gordura fixada em 25% das calorias totais, carboidrato preenche o resto.
function calcularPlanoNutricional(peso: number | null, gorduraPct: number | null, nivelAtividade: string, objetivo: string) {
  const base = calcularMetabolismo(peso, gorduraPct, nivelAtividade)
  if (!base || peso == null) return null
  const obj = OBJETIVOS[objetivo] || OBJETIVOS.manutencao
  const metaCalorica = base.manutencao * (1 + obj.ajusteCalorico)
  const agua = peso * 0.035
  const proteinaG = peso * obj.proteinaGPorKg
  const proteinaCal = proteinaG * 4
  const gorduraCal = metaCalorica * 0.25
  const gorduraG = gorduraCal / 9
  const carboCal = Math.max(0, metaCalorica - proteinaCal - gorduraCal)
  const carboG = carboCal / 4
  return { ...base, metaCalorica, agua, proteinaG, gorduraG, carboG }
}

const CAMPOS_OMRON: { chave: keyof Avaliacao; label: string; unidade: string; step: string }[] = [
  { chave: 'peso', label: 'Peso', unidade: 'kg', step: '0.1' },
  { chave: 'imc', label: 'IMC', unidade: '', step: '0.1' },
  { chave: 'gordura_corporal_pct', label: 'Gordura corporal', unidade: '%', step: '0.1' },
  { chave: 'gordura_visceral', label: 'Gordura visceral', unidade: '', step: '1' },
  { chave: 'massa_muscular_pct', label: 'Músculo esquelético', unidade: '%', step: '0.1' },
  { chave: 'idade_metabolica', label: 'Idade corporal', unidade: 'anos', step: '1' },
]

// Dados extras que a Omron HBF-514C mostra (ficam em avaliacoes.medidas.omron)
const CAMPOS_OMRON_EXTRA: { chave: string; label: string; unidade: string; step: string; grupo: string }[] = [
  { chave: 'metabolismo_repouso', label: 'Metabolismo de repouso', unidade: 'kcal', step: '1', grupo: 'Geral' },
  { chave: 'gordura_sub_corpo', label: 'Corpo inteiro', unidade: '%', step: '0.1', grupo: 'Gordura subcutânea' },
  { chave: 'gordura_sub_tronco', label: 'Tronco', unidade: '%', step: '0.1', grupo: 'Gordura subcutânea' },
  { chave: 'gordura_sub_bracos', label: 'Braços', unidade: '%', step: '0.1', grupo: 'Gordura subcutânea' },
  { chave: 'gordura_sub_pernas', label: 'Pernas', unidade: '%', step: '0.1', grupo: 'Gordura subcutânea' },
  { chave: 'musculo_tronco', label: 'Tronco', unidade: '%', step: '0.1', grupo: 'Músculo esquelético' },
  { chave: 'musculo_bracos', label: 'Braços', unidade: '%', step: '0.1', grupo: 'Músculo esquelético' },
  { chave: 'musculo_pernas', label: 'Pernas', unidade: '%', step: '0.1', grupo: 'Músculo esquelético' },
]

// Marca usada na observação da venda pra ligar a venda à avaliação (sem coluna nova)
const tagVenda = (avaliacaoId: string) => `[avaliacao:${avaliacaoId}]`

export default function AvaliacoesPage() {
  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [alunoId, setAlunoId] = useState('')
  const [buscaAluno, setBuscaAluno] = useState('')
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([])
  const [fotos, setFotos] = useState<Foto[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingAluno, setLoadingAluno] = useState(false)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [metaPesoInput, setMetaPesoInput] = useState('')
  const [metaGorduraInput, setMetaGorduraInput] = useState('')
  const [salvando, setSalvando] = useState(false)

  const [novaData, setNovaData] = useState(() => new Date().toISOString().slice(0, 10))
  const [novosValores, setNovosValores] = useState<Record<string, string>>({})
  const [novaObs, setNovaObs] = useState('')
  const [novoPago, setNovoPago] = useState(true)
  const [novoValorCobrado, setNovoValorCobrado] = useState('30')
  const [novoNivelAtividade, setNovoNivelAtividade] = useState('moderado')
  const [novoObjetivo, setNovoObjetivo] = useState('manutencao')
  const [servicoAval, setServicoAval] = useState<ServicoAvaliacao | null>(null)
  const [omronExtra, setOmronExtra] = useState<Record<string, string>>({})
  const [usarDobras, setUsarDobras] = useState(false)
  const [protocolo, setProtocolo] = useState<Protocolo>('jp7')
  const [sexo, setSexo] = useState<Sexo>('F')
  const [dobras, setDobras] = useState<Record<string, string>>({})
  const [idadeManual, setIdadeManual] = useState('')

  async function carregarAlunos() {
    setLoading(true)
    const { data } = await supabase
      .from('alunos')
      .select('id, nome, status_plano, meta_peso, meta_gordura_pct, token_avaliacao, data_nascimento')
      .order('nome')
    const ids = (data || []).map(a => a.id)
    const { data: periodos } = ids.length > 0
      ? await supabase.from('planos_periodos').select('aluno_id, data_inicio, data_fim, status').in('aluno_id', ids)
      : { data: [] }
    const periodosPorAluno = new Map<string, { data_inicio: string; data_fim: string; status: string }[]>()
    for (const periodo of periodos || []) {
      const lista = periodosPorAluno.get(periodo.aluno_id) || []
      lista.push(periodo)
      periodosPorAluno.set(periodo.aluno_id, lista)
    }
    setAlunos(((data as Aluno[]) || []).filter(a => periodoAtualHoje(periodosPorAluno.get(a.id) || [])))
    setLoading(false)
  }

  useEffect(() => {
    carregarAlunos()
    // Serviço "Avaliação Física" (categoria Avaliação) — dá o valor padrão e liga a venda ao serviço
    supabase.from('servicos').select('id, nome, valor, servicos_categorias(nome)').then(({ data }) => {
      const lista = (data as unknown as (ServicoAvaliacao & { servicos_categorias: { nome: string } | { nome: string }[] | null })[]) || []
      const cat = (s: typeof lista[number]) => {
        const c = Array.isArray(s.servicos_categorias) ? s.servicos_categorias[0] : s.servicos_categorias
        return (c?.nome || '').toLowerCase()
      }
      const s = lista.find(x => cat(x).startsWith('avalia')) || lista.find(x => x.nome.toLowerCase().includes('avalia'))
      if (s) {
        setServicoAval({ id: s.id, nome: s.nome, valor: Number(s.valor) })
        setNovoValorCobrado(v => (v === '30' ? String(Number(s.valor)) : v))
      }
    })
  }, [])

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
  useEffect(() => {
    const a = alunos.find(x => x.id === alunoId)
    setMetaPesoInput(a?.meta_peso != null ? String(a.meta_peso) : '')
    setMetaGorduraInput(a?.meta_gordura_pct != null ? String(a.meta_gordura_pct) : '')
  }, [alunoId, alunos])

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
      objetivo: novoObjetivo,
    }
    for (const campo of CAMPOS_OMRON) {
      const v = novosValores[campo.chave as string]
      corpo[campo.chave as string] = v ? Number(v) : null
    }

    // Medidas extras (Omron segmentar + dobras) vão no campo medidas (jsonb)
    const medidas: Medidas = {}
    const extra: Record<string, number> = {}
    for (const c of CAMPOS_OMRON_EXTRA) if (omronExtra[c.chave]) extra[c.chave] = Number(omronExtra[c.chave])
    if (Object.keys(extra).length) medidas.omron = extra
    const resDobras = resultadoDobras()
    if (usarDobras) {
      const valores: Record<string, number> = {}
      for (const k of dobrasDoProtocolo(protocolo, sexo)) if (dobras[k]) valores[k] = Number(dobras[k])
      if (Object.keys(valores).length) {
        medidas.dobras = { protocolo, sexo, idade: idadeAvaliacao(), valores }
        if (resDobras) Object.assign(medidas.dobras, { soma: resDobras.soma, densidade: Number(resDobras.densidade.toFixed(5)), gordura_pct: Number(resDobras.gorduraPct.toFixed(1)) })
      }
    }
    corpo.medidas = Object.keys(medidas).length ? medidas : null

    let avaliacaoId = editandoId
    if (editandoId) {
      const { error } = await supabase.from('avaliacoes').update(corpo).eq('id', editandoId)
      if (error) { alert('Não consegui salvar: ' + error.message); setSalvando(false); return }
    } else {
      const { data, error } = await supabase.from('avaliacoes').insert(corpo).select('id').single()
      if (error || !data) { alert('Não consegui salvar: ' + (error?.message || '')); setSalvando(false); return }
      avaliacaoId = (data as { id: string }).id
    }
    if (avaliacaoId) await sincronizarVenda(avaliacaoId, corpo.valor as number, novoPago, novaData)

    fecharForm()
    setSalvando(false)
    carregarHistorico(alunoId)
  }

  // Liga a avaliação ao serviço "Avaliação Física": paga = 1 venda do serviço (entra nos Relatórios); não paga = sem venda.
  async function sincronizarVenda(avaliacaoId: string, valor: number, pago: boolean, data: string) {
    const tag = tagVenda(avaliacaoId)
    const { data: existentes } = await supabase.from('vendas_servicos').select('id').like('observacao', `%${tag}%`)
    const ids = ((existentes as { id: string }[]) || []).map(v => v.id)
    if (!pago) {
      if (ids.length) await supabase.from('vendas_servicos').delete().in('id', ids)
      return
    }
    const venda = {
      servico_id: servicoAval?.id || null,
      servico_nome: servicoAval?.nome || 'Avaliação Física',
      aluno_id: alunoId,
      cliente_nome: alunoAtual?.nome || null,
      valor,
      data_venda: `${data}T12:00:00-03:00`,
      observacao: `Avaliação física ${tag}`,
    }
    const { error } = ids.length
      ? await supabase.from('vendas_servicos').update(venda).eq('id', ids[0])
      : await supabase.from('vendas_servicos').insert(venda)
    if (error) alert('A avaliação foi salva, mas não consegui lançar a venda nos relatórios: ' + error.message)
    if (ids.length > 1) await supabase.from('vendas_servicos').delete().in('id', ids.slice(1))
  }

  function idadeAvaliacao() {
    return idadeManual ? Number(idadeManual) : idadeEm(alunoAtual?.data_nascimento, novaData)
  }

  function resultadoDobras() {
    if (!usarDobras) return null
    const valores: Record<string, number | null> = {}
    for (const k of Object.keys(dobras)) valores[k] = dobras[k] ? Number(dobras[k]) : null
    return calcularDobras(protocolo, sexo, idadeAvaliacao(), valores)
  }

  function fecharForm() {
    setNovosValores({})
    setNovaObs('')
    setNovoPago(true)
    setNovoValorCobrado(servicoAval ? String(servicoAval.valor) : '30')
    setOmronExtra({})
    setUsarDobras(false)
    setDobras({})
    setIdadeManual('')
    setNovoNivelAtividade('moderado')
    setNovoObjetivo('manutencao')
    setNovaData(new Date().toISOString().slice(0, 10))
    setMostrarForm(false)
    setEditandoId(null)
  }

  function abrirEdicao(a: Avaliacao) {
    setEditandoId(a.id)
    setNovaData(a.data)
    const valores: Record<string, string> = {}
    for (const campo of CAMPOS_OMRON) {
      const v = a[campo.chave] as number | null
      if (v != null) valores[campo.chave as string] = String(v)
    }
    setNovosValores(valores)
    setNovaObs(a.observacoes || '')
    setNovoPago(a.pago)
    setNovoValorCobrado(String(a.valor))
    setNovoNivelAtividade(a.nivel_atividade)
    setNovoObjetivo(a.objetivo)
    const ext: Record<string, string> = {}
    for (const [k, v] of Object.entries(a.medidas?.omron || {})) ext[k] = String(v)
    setOmronExtra(ext)
    const d = a.medidas?.dobras
    setUsarDobras(!!d)
    if (d) {
      setProtocolo(d.protocolo); setSexo(d.sexo)
      const dv: Record<string, string> = {}
      for (const [k, v] of Object.entries(d.valores || {})) dv[k] = String(v)
      setDobras(dv)
      setIdadeManual(d.idade != null && d.idade !== idadeEm(alunoAtual?.data_nascimento, a.data) ? String(d.idade) : '')
    } else { setDobras({}); setIdadeManual('') }
    setMostrarForm(true)
  }

  async function apagarAvaliacao(id: string) {
    if (!confirm('Apagar essa avaliação? As fotos vinculadas a ela também vão junto. Isso não pode ser desfeito.')) return
    await supabase.from('avaliacoes').delete().eq('id', id)
    await supabase.from('vendas_servicos').delete().like('observacao', `%${tagVenda(id)}%`)
    carregarHistorico(alunoId)
  }

  async function salvarMetas(metaPeso: string, metaGordura: string) {
    if (!alunoId) return
    await supabase.from('alunos').update({
      meta_peso: metaPeso ? Number(metaPeso) : null,
      meta_gordura_pct: metaGordura ? Number(metaGordura) : null,
    }).eq('id', alunoId)
    carregarAlunos()
  }

  const alunosFiltrados = alunos.filter(a => a.nome.toLowerCase().includes(buscaAluno.toLowerCase()))
  const alunoAtual = alunos.find(a => a.id === alunoId)

  if (loading) return <p style={{ color: 'var(--text2)' }}>Carregando...</p>

  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Avaliações Físicas</h1>
      <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>
        Registre os dados da balança Omron HBF-514C e, se quiser, as dobras cutâneas. O valor vem do serviço {servicoAval ? `“${servicoAval.nome}” (R$ ${servicoAval.valor.toFixed(2).replace('.', ',')})` : '“Avaliação Física”'} — avaliação marcada como paga entra automaticamente nos Relatórios como venda desse serviço. As fotos que o aluno manda pelo WhatsApp mencionando &quot;avaliação&quot; entram aqui automaticamente.
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
            <button onClick={() => mostrarForm ? fecharForm() : setMostrarForm(true)} className={mostrarForm ? 'btn btn-neutral' : 'btn btn-success'}>
              {mostrarForm ? 'Cancelar' : '+ Registrar avaliação'}
            </button>
          </div>

          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 10 }}>
              <h3 style={{ fontSize: 12, color: 'var(--text2)', letterSpacing: '1px', textTransform: 'uppercase' }}>Meta e link de acesso do aluno</h3>
              <button
                onClick={() => {
                  const url = `https://mfct-estudio-site.vercel.app/avaliacao/${alunoAtual?.token_avaliacao}`
                  navigator.clipboard.writeText(url)
                  alert('Link copiado! ' + url)
                }}
                style={{ background: 'transparent', border: '1px solid #4a90d9', color: '#4a90d9', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                🔗 Copiar link de evolução do aluno
              </button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>
              Esse link só mostra dados se o aluno estiver com o plano ativo. Manda pra ele quando quiser.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, marginBottom: 6, display: 'block' }}>Meta de peso (kg)</label>
                <input
                  type="number" step="0.1" placeholder="—" value={metaPesoInput}
                  onChange={e => setMetaPesoInput(e.target.value)}
                  onBlur={() => salvarMetas(metaPesoInput, metaGorduraInput)}
                  style={{ width: 110, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, marginBottom: 6, display: 'block' }}>Meta de gordura corporal (%)</label>
                <input
                  type="number" step="0.1" placeholder="—" value={metaGorduraInput}
                  onChange={e => setMetaGorduraInput(e.target.value)}
                  onBlur={() => salvarMetas(metaPesoInput, metaGorduraInput)}
                  style={{ width: 110, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit' }}
                />
              </div>
            </div>
          </div>

          {mostrarForm && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginBottom: 24 }}>
              {editandoId && (
                <p style={{ fontSize: 12, color: '#4a90d9', marginBottom: 10, fontWeight: 700 }}>✏️ Editando avaliação existente</p>
              )}              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 14 }}>
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

              <details open={Object.keys(omronExtra).length > 0} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 14px', marginBottom: 14 }}>
                <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>⚖️ Mais dados da Omron HBF-514C (opcional)</summary>
                {['Geral', 'Gordura subcutânea', 'Músculo esquelético'].map(grupo => (
                  <div key={grupo} style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{grupo}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
                      {CAMPOS_OMRON_EXTRA.filter(c => c.grupo === grupo).map(c => (
                        <div key={c.chave}>
                          <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, marginBottom: 4, display: 'block' }}>{c.label} ({c.unidade})</label>
                          <input type="number" step={c.step} placeholder="—" value={omronExtra[c.chave] || ''}
                            onChange={e => setOmronExtra(prev => ({ ...prev, [c.chave]: e.target.value }))}
                            style={{ width: '100%', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </details>

              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 14px', marginBottom: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  <input type="checkbox" checked={usarDobras} onChange={e => setUsarDobras(e.target.checked)} />
                  📏 Dobras cutâneas (adipômetro) — opcional
                </label>
                {usarDobras && (() => {
                  const res = resultadoDobras()
                  const idade = idadeAvaliacao()
                  const usadas = dobrasDoProtocolo(protocolo, sexo)
                  const sel: React.CSSProperties = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit' }
                  const gordBalanca = Number(novosValores.gordura_corporal_pct)
                  return (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 10 }}>
                        <div>
                          <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, marginBottom: 4, display: 'block' }}>Protocolo</label>
                          <select value={protocolo} onChange={e => setProtocolo(e.target.value as Protocolo)} style={sel}>
                            <option value="jp7">Jackson & Pollock — 7 dobras</option>
                            <option value="jp3">Jackson & Pollock — 3 dobras</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, marginBottom: 4, display: 'block' }}>Sexo</label>
                          <select value={sexo} onChange={e => setSexo(e.target.value as Sexo)} style={sel}>
                            <option value="F">Feminino</option>
                            <option value="M">Masculino</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, marginBottom: 4, display: 'block' }}>Idade</label>
                          <input type="number" value={idadeManual} placeholder={idadeEm(alunoAtual?.data_nascimento, novaData)?.toString() || 'anos'}
                            onChange={e => setIdadeManual(e.target.value)} style={{ ...sel, width: 80 }} />
                        </div>
                      </div>
                      {!idade && <p style={{ fontSize: 11, color: '#e0a020', marginBottom: 8 }}>Aluno sem data de nascimento no cadastro — digite a idade pra calcular.</p>}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                        {DOBRAS.filter(d => usadas.includes(d.chave)).map(d => (
                          <div key={d.chave}>
                            <label title={d.dica} style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, marginBottom: 4, display: 'block' }}>{d.label} (mm)</label>
                            <input type="number" step="0.5" placeholder="—" value={dobras[d.chave] || ''}
                              onChange={e => setDobras(prev => ({ ...prev, [d.chave]: e.target.value }))}
                              style={{ ...sel, width: '100%', boxSizing: 'border-box' }} />
                            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{d.dica}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text2)' }}>
                        {res ? (
                          <>Soma: <b style={{ color: 'var(--text)' }}>{res.soma.toFixed(1)} mm</b> · Gordura pelas dobras: <b style={{ color: '#e05656', fontSize: 14 }}>{res.gorduraPct.toFixed(1)}%</b>
                            {gordBalanca > 0 && <span style={{ color: 'var(--text3)' }}> (balança: {gordBalanca}%)</span>}</>
                        ) : <span style={{ color: 'var(--text3)' }}>Preencha todas as dobras acima pra calcular o % de gordura.</span>}
                      </div>
                    </div>
                  )
                })()}
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

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, marginBottom: 6, display: 'block' }}>Objetivo (pra calcular água e macronutrientes)</label>
                <select
                  value={novoObjetivo} onChange={e => setNovoObjetivo(e.target.value)}
                  style={{ width: '100%', maxWidth: 320, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit' }}
                >
                  {Object.entries(OBJETIVOS).map(([chave, info]) => (
                    <option key={chave} value={chave}>{info.label}</option>
                  ))}
                </select>
              </div>

              {(() => {
                const peso = Number(novosValores.peso)
                const gordura = Number(novosValores.gordura_corporal_pct)
                const plano = peso && gordura ? calcularPlanoNutricional(peso, gordura, novoNivelAtividade, novoObjetivo) : null
                if (!plano) return (
                  <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 14 }}>
                    Preenche peso e % de gordura corporal pra ver a taxa de manutenção e o plano nutricional calculados.
                  </p>
                )
                return (
                  <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 14px', marginBottom: 14 }}>
                    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text3)' }}>Massa magra</div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{plano.massaMagra.toFixed(1)} kg</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text3)' }}>TMB (repouso)</div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{Math.round(plano.tmb)} kcal</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text3)' }}>Manutenção</div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{Math.round(plano.manutencao)} kcal</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text3)' }}>Meta calórica ({OBJETIVOS[novoObjetivo].label})</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#3fb950', fontFamily: 'Anton, sans-serif' }}>{Math.round(plano.metaCalorica)} kcal/dia</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text3)' }}>Água</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#4a90d9' }}>{plano.agua.toFixed(1)} L/dia</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text3)' }}>Proteína</div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{Math.round(plano.proteinaG)} g</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text3)' }}>Carboidrato</div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{Math.round(plano.carboG)} g</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text3)' }}>Gordura</div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{Math.round(plano.gorduraG)} g</div>
                      </div>
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

              <button onClick={salvarAvaliacao} disabled={salvando} className="btn btn-success">
                {salvando ? 'Salvando...' : editandoId ? '✅ Atualizar avaliação' : '✅ Salvar avaliação'}
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
                    <div key={a.id} className="card card-hover" style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{dataFmt}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 11, color: a.pago ? '#3fb950' : 'var(--danger)' }}>
                            {a.pago ? `✅ Pago (R$ ${Number(a.valor).toFixed(2)})` : `⏳ Pendente (R$ ${Number(a.valor).toFixed(2)})`}
                          </span>
                          <button onClick={() => abrirEdicao(a)} style={{ background: 'transparent', border: '1px solid #4a90d9', color: '#4a90d9', borderRadius: 4, padding: '3px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                            ✏️ Editar
                          </button>
                          <button onClick={() => apagarAvaliacao(a.id)} className="btn btn-outline-danger btn-sm">
                            🗑️
                          </button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 12, color: 'var(--text2)' }}>
                        {a.peso != null && <span>Peso: <b style={{ color: 'var(--text)' }}>{a.peso} kg</b></span>}
                        {a.imc != null && <span>IMC: <b style={{ color: 'var(--text)' }}>{a.imc}</b></span>}
                        {a.gordura_corporal_pct != null && <span>Gordura: <b style={{ color: 'var(--text)' }}>{a.gordura_corporal_pct}%</b></span>}
                        {a.gordura_visceral != null && <span>G. visceral: <b style={{ color: 'var(--text)' }}>{a.gordura_visceral}</b></span>}
                        {a.massa_muscular_pct != null && <span>Massa muscular: <b style={{ color: 'var(--text)' }}>{a.massa_muscular_pct}%</b></span>}
                        {a.idade_metabolica != null && <span>Idade corporal: <b style={{ color: 'var(--text)' }}>{a.idade_metabolica}</b></span>}
                        {a.medidas?.omron?.metabolismo_repouso != null && <span>Metab. repouso: <b style={{ color: 'var(--text)' }}>{a.medidas.omron.metabolismo_repouso} kcal</b></span>}
                      </div>
                      {a.medidas?.omron && (() => {
                        const o = a.medidas.omron
                        const seg = (pref: string) => ['tronco', 'bracos', 'pernas'].map(p => o[`${pref}_${p}`] != null ? `${p === 'bracos' ? 'braços' : p} ${o[`${pref}_${p}`]}%` : null).filter(Boolean).join(' · ')
                        const g = seg('gordura_sub'), m = seg('musculo')
                        if (!g && !m && o.gordura_sub_corpo == null) return null
                        return (
                          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 6 }}>
                            {(o.gordura_sub_corpo != null || g) && <div>Gordura subcutânea: <b style={{ color: 'var(--text)' }}>{o.gordura_sub_corpo != null ? `${o.gordura_sub_corpo}%` : ''}</b>{g && <span style={{ color: 'var(--text3)' }}> ({g})</span>}</div>}
                            {m && <div>Músculo esquelético: <span style={{ color: 'var(--text)' }}>{m}</span></div>}
                          </div>
                        )
                      })()}
                      {a.medidas?.dobras && (() => {
                        const d = a.medidas.dobras
                        const lista = DOBRAS.filter(x => d.valores?.[x.chave] != null).map(x => `${x.label} ${d.valores[x.chave]}`).join(' · ')
                        return (
                          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 6 }}>
                            Dobras ({d.protocolo === 'jp7' ? 'J&P 7' : 'J&P 3'}): {d.gordura_pct != null && <b style={{ color: '#e05656' }}>{d.gordura_pct}% gordura</b>}
                            {d.soma != null && <span> · soma {d.soma} mm</span>}
                            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{lista} (mm)</div>
                          </div>
                        )
                      })()}
                      {(() => {
                        const plano = calcularPlanoNutricional(a.peso, a.gordura_corporal_pct, a.nivel_atividade, a.objetivo)
                        if (!plano) return null
                        return (
                          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8 }}>
                            <div>
                              Meta calórica ({OBJETIVOS[a.objetivo]?.label || a.objetivo}): <b style={{ color: '#3fb950' }}>{Math.round(plano.metaCalorica)} kcal/dia</b>
                              <span style={{ color: 'var(--text3)' }}> (manutenção {Math.round(plano.manutencao)} kcal · TMB {Math.round(plano.tmb)} kcal · {FATORES_ATIVIDADE[a.nivel_atividade]?.label || a.nivel_atividade})</span>
                            </div>
                            <div style={{ marginTop: 4 }}>
                              Água: <b style={{ color: '#4a90d9' }}>{plano.agua.toFixed(1)} L</b>
                              {' · '}Proteína: <b style={{ color: 'var(--text)' }}>{Math.round(plano.proteinaG)}g</b>
                              {' · '}Carboidrato: <b style={{ color: 'var(--text)' }}>{Math.round(plano.carboG)}g</b>
                              {' · '}Gordura: <b style={{ color: 'var(--text)' }}>{Math.round(plano.gorduraG)}g</b>
                            </div>
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
      <div className="card card-hover" style={{ padding: '14px 16px' }}>
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
    <div className="card card-hover" style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--text2)' }}>{titulo}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: diff === 0 ? 'var(--text3)' : melhorou ? '#3fb950' : 'var(--danger)' }}>
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
