'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseAdmin'
import { Cabecalho } from '@/components/ui/Cabecalho'

// Mensagens agendadas (12/10/2026): o Matheus escreve a mensagem, escolhe os alunos e a
// hora, e o sistema manda sozinho pelo WhatsApp do estúdio no horário (rotina a cada 5 min).
// A mensagem enviada entra no histórico da Elen, então ela entende se o aluno responder.

type Aluno = { id: string; nome: string; telefone: string | null; status_plano: string | null }
type Agendada = {
  id: string; aluno_id: string | null; nome: string | null; telefone: string; mensagem: string
  enviar_em: string; status: string; erro: string | null; enviado_em: string | null; criado_em: string
}
type Filtro = 'pendente' | 'enviada' | 'erro' | 'todas'

const hojeISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const primeiroNome = (n: string | null) => (n || '').trim().split(/\s+/)[0] || ''
const ETIQUETA: Record<string, { txt: string; cor: string }> = {
  pendente: { txt: 'Agendada', cor: '#e0a020' },
  enviando: { txt: 'Enviando...', cor: '#e0a020' },
  enviada: { txt: 'Enviada', cor: '#3fb950' },
  erro: { txt: 'Não foi', cor: 'var(--danger)' },
  cancelada: { txt: 'Cancelada', cor: 'var(--text3)' },
}

export default function MensagensAgendadasPage() {
  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [lista, setLista] = useState<Agendada[]>([])
  const [carregando, setCarregando] = useState(true)
  const [filtro, setFiltro] = useState<Filtro>('pendente')

  const [busca, setBusca] = useState('')
  const [escolhidos, setEscolhidos] = useState<Set<string>>(new Set())
  const [texto, setTexto] = useState('')
  const [dia, setDia] = useState(hojeISO())
  const [hora, setHora] = useState('07:00')
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState('')

  const carregar = useCallback(async () => {
    const [{ data: al }, { data: ms }] = await Promise.all([
      supabase.from('alunos').select('id, nome, telefone, status_plano').order('nome'),
      supabase.from('mensagens_agendadas').select('*').order('enviar_em', { ascending: false }).limit(200),
    ])
    setAlunos(((al as Aluno[]) || []).filter(a => a.telefone))
    setLista((ms as Agendada[]) || [])
    setCarregando(false)
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar() }, [carregar])

  const filtrados = useMemo(() => {
    const sem = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    const b = sem(busca.trim())
    if (!b) return []
    return alunos.filter(a => sem(a.nome).includes(b)).slice(0, 12)
  }, [alunos, busca])

  const selecionados = alunos.filter(a => escolhidos.has(a.id))

  function alternar(id: string) {
    const s = new Set(escolhidos)
    if (s.has(id)) s.delete(id); else s.add(id)
    setEscolhidos(s)
  }

  function mostrar(t: string) { setAviso(t); setTimeout(() => setAviso(''), 4000) }

  async function agendar(agora: boolean) {
    if (!selecionados.length) { alert('Escolha pelo menos um aluno.'); return }
    if (!texto.trim()) { alert('Escreva a mensagem.'); return }
    const enviarEm = agora ? new Date() : new Date(`${dia}T${hora}:00`)
    if (isNaN(enviarEm.getTime())) { alert('Dia ou hora inválidos.'); return }
    if (!agora && enviarEm.getTime() < new Date().getTime() - 60 * 1000) { alert('Esse horário já passou. Escolha um horário futuro ou use "Mandar agora".'); return }
    const linhas = selecionados.map(a => ({
      aluno_id: a.id, nome: a.nome, telefone: a.telefone as string,
      mensagem: texto.trim().replace(/\{nome\}/gi, primeiroNome(a.nome)),
      enviar_em: enviarEm.toISOString(),
    }))
    const resumo = agora ? 'nos próximos minutos' : `em ${quando(enviarEm.toISOString())}`
    if (!confirm(`Mandar essa mensagem pra ${linhas.length} aluno${linhas.length > 1 ? 's' : ''} ${resumo}?`)) return
    setSalvando(true)
    const { error } = await supabase.from('mensagens_agendadas').insert(linhas)
    setSalvando(false)
    if (error) { alert('Não consegui agendar: ' + error.message); return }
    setEscolhidos(new Set()); setTexto(''); setBusca('')
    mostrar(`✅ Agendada pra ${linhas.length} aluno${linhas.length > 1 ? 's' : ''} ${resumo}`)
    setFiltro('pendente')
    carregar()
  }

  async function cancelar(m: Agendada) {
    if (!confirm(`Cancelar a mensagem pra ${m.nome || m.telefone}?`)) return
    const { error } = await supabase.from('mensagens_agendadas').update({ status: 'cancelada' }).eq('id', m.id).eq('status', 'pendente')
    if (error) { alert('Não consegui cancelar: ' + error.message); return }
    carregar()
  }

  const contagem = {
    pendente: lista.filter(m => m.status === 'pendente' || m.status === 'enviando').length,
    enviada: lista.filter(m => m.status === 'enviada').length,
    erro: lista.filter(m => m.status === 'erro').length,
    todas: lista.length,
  }
  const visiveis = lista
    .filter(m => filtro === 'todas' ? true : filtro === 'pendente' ? (m.status === 'pendente' || m.status === 'enviando') : m.status === filtro)
    .sort((a, b) => filtro === 'pendente' ? a.enviar_em.localeCompare(b.enviar_em) : b.enviar_em.localeCompare(a.enviar_em))

  return (
    <div>
      <Cabecalho
        titulo="Mensagens agendadas"
        subtitulo="Escreva, escolha os alunos e a hora. O sistema manda sozinho pelo WhatsApp do estúdio, e a Elen fica sabendo da conversa."
        acoes={aviso ? <span className="etiqueta" style={{ color: '#3fb950' }}>{aviso}</span> : null}
      />

      <div className="pilha">
        <div className="card bloco">
          <div className="secao-titulo">Nova mensagem</div>
          <div className="form-grade">
            <div className="inteiro">
              <label className="rotulo">Pra quem</label>
              <input className="campo busca" placeholder="Digite o nome do aluno..." value={busca} onChange={e => setBusca(e.target.value)} />
              {filtrados.length > 0 && (
                <div className="lista" style={{ marginTop: 8 }}>
                  {filtrados.map(a => (
                    <button key={a.id} type="button" onClick={() => alternar(a.id)} className="card card-hover item-lista" style={{ textAlign: 'left', width: '100%' }}>
                      <div>
                        <div className="item-titulo">{a.nome}</div>
                        <div className="item-sub">{a.status_plano === 'ativo' ? 'Plano ativo' : a.status_plano === 'lead' ? 'Interessado (ainda não é aluno)' : (a.status_plano || '—')}</div>
                      </div>
                      <div className="item-acoes"><span className="etiqueta" style={{ color: escolhidos.has(a.id) ? '#3fb950' : 'var(--text3)' }}>{escolhidos.has(a.id) ? '✓ Escolhido' : 'Escolher'}</span></div>
                    </button>
                  ))}
                </div>
              )}
              {selecionados.length > 0 && (
                <div className="chips" style={{ marginTop: 10 }}>
                  {selecionados.map(a => (
                    <button key={a.id} type="button" className="chip ativo" onClick={() => alternar(a.id)} title="Tirar">{a.nome} ✕</button>
                  ))}
                </div>
              )}
            </div>

            <div className="inteiro">
              <label className="rotulo">Mensagem</label>
              <textarea className="campo" rows={4} value={texto} onChange={e => setTexto(e.target.value)} placeholder="Bom dia, {nome}! ..." />
              <p className="ajuda">Escreva <b>{'{nome}'}</b> que o sistema troca pelo primeiro nome de cada aluno.</p>
            </div>

            <div>
              <label className="rotulo">Dia</label>
              <input className="campo" type="date" value={dia} onChange={e => setDia(e.target.value)} />
            </div>
            <div>
              <label className="rotulo">Hora</label>
              <input className="campo" type="time" value={hora} onChange={e => setHora(e.target.value)} />
            </div>
          </div>
          <div className="form-acoes">
            <button className="btn btn-ghost" disabled={salvando} onClick={() => agendar(true)}>Mandar agora</button>
            <button className="btn btn-primary" disabled={salvando} onClick={() => agendar(false)}>{salvando ? 'Agendando...' : 'Agendar'}</button>
          </div>
          <p className="ajuda" style={{ marginTop: 8 }}>O envio sai em até 5 minutos depois do horário escolhido.</p>
        </div>

        <div>
          <div className="chips">
            <button onClick={() => setFiltro('pendente')} className={`chip${filtro === 'pendente' ? ' ativo' : ''}`}>Agendadas ({contagem.pendente})</button>
            <button onClick={() => setFiltro('enviada')} className={`chip${filtro === 'enviada' ? ' ativo' : ''}`}>Enviadas ({contagem.enviada})</button>
            <button onClick={() => setFiltro('erro')} className={`chip${filtro === 'erro' ? ' ativo' : ''}`}>Não foram ({contagem.erro})</button>
            <button onClick={() => setFiltro('todas')} className={`chip${filtro === 'todas' ? ' ativo' : ''}`}>Todas ({contagem.todas})</button>
          </div>
          {carregando ? <p className="vazio">Carregando...</p> : !visiveis.length ? (
            <p className="vazio">Nenhuma mensagem aqui.</p>
          ) : (
            <div className="lista">
              {visiveis.map(m => {
                const e = ETIQUETA[m.status] || { txt: m.status, cor: 'var(--text3)' }
                return (
                  <div key={m.id} className="card item-lista">
                    <div style={{ minWidth: 0 }}>
                      <div className="item-titulo">{m.nome || m.telefone}</div>
                      <div className="item-sub">
                        {m.status === 'enviada' && m.enviado_em ? `Enviada em ${quando(m.enviado_em)}` : `Pra ${quando(m.enviar_em)}`}
                      </div>
                      <div className="item-sub" style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{m.mensagem}</div>
                      {m.erro && <div className="item-sub" style={{ color: 'var(--danger)', marginTop: 4 }}>{m.erro}</div>}
                    </div>
                    <div className="item-acoes">
                      <span className="etiqueta" style={{ color: e.cor }}>{e.txt}</span>
                      {m.status === 'pendente' && <button className="btn btn-outline-danger btn-sm" onClick={() => cancelar(m)}>Cancelar</button>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
