'use client'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseAdmin'
import { Cabecalho } from '@/components/ui/Cabecalho'
import { ANAMNESE, TODAS_PERGUNTAS, alertasDe, respondidas, type Respostas } from '@/lib/anamnese'

// Ficha de anamnese de um aluno (03/10/2026). O [id] é o id do ALUNO.
type Aluno = { id: string; nome: string; telefone: string | null }
type Ficha = { id: string; status: string; origem: string; respostas: Respostas; atualizado_em: string }

export default function AnamneseAlunoPage() {
  const { id } = useParams<{ id: string }>()
  const [aluno, setAluno] = useState<Aluno | null>(null)
  const [ficha, setFicha] = useState<Ficha | null>(null)
  const [r, setR] = useState<Respostas>({})
  const [completa, setCompleta] = useState(false)
  const [salvo, setSalvo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState('')
  const [naoAchou, setNaoAchou] = useState(false)
  const mudou = JSON.stringify({ r, c: completa }) !== salvo

  const carregar = useCallback(async () => {
    const [{ data: al }, { data: fi }] = await Promise.all([
      supabase.from('alunos').select('id, nome, telefone').eq('id', id).maybeSingle(),
      supabase.from('anamneses').select('*').eq('aluno_id', id).order('atualizado_em', { ascending: false }).limit(1),
    ])
    if (!al) { setNaoAchou(true); return }
    setAluno(al as Aluno)
    const f = ((fi as Ficha[]) || [])[0] || null
    setFicha(f)
    setR(f?.respostas || {})
    setCompleta(f?.status === 'completa')
    setSalvo(JSON.stringify({ r: f?.respostas || {}, c: f?.status === 'completa' }))
  }, [id])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar() }, [carregar])

  function mostrar(t: string) { setAviso(t); setTimeout(() => setAviso(''), 3000) }

  async function salvar() {
    setSalvando(true)
    const corpo = { respostas: r, status: completa ? 'completa' : 'parcial', atualizado_em: new Date().toISOString() }
    const { error } = ficha
      ? await supabase.from('anamneses').update(corpo).eq('id', ficha.id)
      : await supabase.from('anamneses').insert({ aluno_id: id, origem: 'admin', ...corpo })
    setSalvando(false)
    if (error) { alert('Não consegui salvar: ' + error.message); return }
    mostrar('✅ Salvo')
    carregar()
  }

  async function enviar() {
    if (!aluno?.telefone) { alert('Esse aluno não tem telefone cadastrado.'); return }
    if (mudou) { alert('Salve as alterações antes de mandar.'); return }
    if (!confirm(`Mandar o PDF da anamnese pro WhatsApp de ${aluno.nome}?`)) return
    setEnviando(true)
    const resp = await fetch('/api/enviar-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo: 'anamnese', id }) })
    setEnviando(false)
    const j = await resp.json().catch(() => ({}))
    if (!resp.ok) { alert('Não consegui mandar: ' + (j.error || resp.status)); return }
    mostrar('✅ PDF enviado no WhatsApp')
  }

  if (naoAchou) return <p className="vazio">Aluno não encontrado. <Link href="/admin/anamneses">Voltar</Link></p>
  if (!aluno) return <p className="vazio">Carregando...</p>

  const alertas = alertasDe(r)
  const total = TODAS_PERGUNTAS.length
  const feitas = respondidas(r)

  return (
    <div>
      <Cabecalho
        voltar={{ href: '/admin/anamneses', label: 'Anamneses' }}
        titulo={aluno.nome}
        subtitulo={ficha
          ? `${feitas} de ${total} respostas · preenchida ${ficha.origem === 'elen' ? 'pela Elen' : 'pelo admin'} · atualizada em ${new Date(ficha.atualizado_em).toLocaleDateString('pt-BR')}`
          : 'Ainda não preenchida. Você pode preencher aqui ou esperar a Elen conversar com o aluno.'}
        acoes={<>
          {aviso && <span className="etiqueta" style={{ color: '#3fb950' }}>{aviso}</span>}
          {mudou && !aviso && <span className="etiqueta" style={{ color: '#e0a020' }}>Alterações não salvas</span>}
          <a href={`/api/pdf?tipo=anamnese&id=${id}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">📄 Ver PDF</a>
          <button onClick={enviar} disabled={enviando || !ficha} className="btn btn-outline-whatsapp btn-sm">{enviando ? 'Enviando...' : '📲 Mandar pro aluno'}</button>
          <button onClick={salvar} disabled={salvando || !mudou} className="btn btn-primary">{salvando ? 'Salvando...' : 'Salvar'}</button>
        </>}
      />

      <div className="pilha">
        {alertas.length > 0 && (
          <div className="aviso aviso-erro" style={{ marginBottom: 0 }}>
            ⚠️ Atenção antes de treinar: {alertas.map(a => a.pergunta.replace(/\?$/, '')).join(' · ')}.
          </div>
        )}

        <div className="lado-a-lado">
          {ANAMNESE.map(g => (
            <div key={g.titulo} className="card bloco">
              <div className="secao-titulo">{g.titulo}</div>
              <div style={{ display: 'grid', gap: 14 }}>
                {g.perguntas.map(p => (
                  <div key={p.chave}>
                    <label className="rotulo">{p.pergunta}{p.detalhe ? <span style={{ color: 'var(--text3)', fontWeight: 400 }}> — {p.detalhe}</span> : null}</label>
                    {p.tipo === 'sim_nao' ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <div className="segmento" style={{ flex: '0 0 auto' }}>
                          <button type="button" style={{ flex: '0 0 64px' }} className={/^s/i.test(r[p.chave] || '') ? 'ativo' : ''} onClick={() => setR({ ...r, [p.chave]: 'Sim' })}>Sim</button>
                          <button type="button" style={{ flex: '0 0 64px' }} className={/^n/i.test(r[p.chave] || '') ? 'ativo' : ''} onClick={() => setR({ ...r, [p.chave]: 'Não' })}>Não</button>
                        </div>
                        <input className="campo" placeholder="Detalhe (opcional)" value={r[p.chave] || ''} onChange={e => setR({ ...r, [p.chave]: e.target.value })} />
                      </div>
                    ) : p.tipo === 'longo' ? (
                      <textarea className="campo" rows={2} value={r[p.chave] || ''} onChange={e => setR({ ...r, [p.chave]: e.target.value })} />
                    ) : (
                      <input className="campo" value={r[p.chave] || ''} onChange={e => setR({ ...r, [p.chave]: e.target.value })} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="card bloco">
          <div className="secao-titulo">Situação da ficha</div>
          <div className="segmento" style={{ maxWidth: 420 }}>
            <button type="button" className={!completa ? 'ativo' : ''} onClick={() => setCompleta(false)}>Em preenchimento</button>
            <button type="button" className={completa ? 'ativo' : ''} onClick={() => setCompleta(true)}>Completa</button>
          </div>
          <p className="ajuda" style={{ marginTop: 8 }}>Marque como completa quando estiver tudo certo. As fichas não completas aparecem em “Pendentes”.</p>
          <div className="form-acoes">
            <button onClick={salvar} disabled={salvando || !mudou} className="btn btn-primary">{salvando ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
