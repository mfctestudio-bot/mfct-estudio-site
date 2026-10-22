'use client'
import { use, useEffect, useState } from 'react'
import { ANAMNESE, OPCIONAIS, obrigatoriasPendentes, type Respostas } from '@/lib/anamnese'

// Anamnese pelo link (21/10/2026): o aluno preenche no celular e cai direto na ficha dele
// (menu Alunos → Anamneses). Substitui o Formulário do Google que a Elen mandava.

const estilo = {
  pagina: { minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', padding: '24px 16px 64px' } as React.CSSProperties,
  caixa: { maxWidth: 620, margin: '0 auto' } as React.CSSProperties,
  grupo: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 16px', marginBottom: 16 } as React.CSSProperties,
  titulo: { fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text2)', margin: '0 0 14px' } as React.CSSProperties,
  pergunta: { display: 'block', fontSize: 15, marginBottom: 6, lineHeight: 1.35 } as React.CSSProperties,
  campo: { width: '100%', boxSizing: 'border-box', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 8, padding: '11px 12px', fontSize: 16, fontFamily: 'inherit' } as React.CSSProperties,
  detalhe: { fontSize: 12, color: 'var(--text3)', marginTop: 4 } as React.CSSProperties,
  falta: { borderColor: 'var(--danger)' } as React.CSSProperties,
}

export default function AnamnesePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [estado, setEstado] = useState<'carregando' | 'erro' | 'form' | 'pronto'>('carregando')
  const [nome, setNome] = useState('')
  const [r, setR] = useState<Respostas>({})
  const [faltam, setFaltam] = useState<string[]>([])
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    fetch(`/api/anamnese/${token}`).then(async res => {
      const j = await res.json().catch(() => null)
      if (!res.ok || !j) { setEstado('erro'); return }
      setNome(j.nome || '')
      setR(j.respostas || {})
      setEstado(j.completa ? 'pronto' : 'form')
    }).catch(() => setEstado('erro'))
  }, [token])

  const feminino = /^f/i.test((r.sexo || '').trim())
  const set = (k: string, v: string) => { setR(prev => ({ ...prev, [k]: v })); if (faltam.includes(k)) setFaltam(faltam.filter(f => f !== k)) }

  async function salvar(finalizar: boolean) {
    if (finalizar) {
      const pend = obrigatoriasPendentes(r).map(p => p.chave)
      if (pend.length) {
        setFaltam(pend)
        setAviso(`Faltam ${pend.length} resposta${pend.length > 1 ? 's' : ''} (marcadas em vermelho).`)
        document.getElementById(`q-${pend[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return
      }
    }
    setEnviando(true); setAviso('')
    const res = await fetch(`/api/anamnese/${token}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ respostas: r, finalizar }),
    })
    const j = await res.json().catch(() => null)
    setEnviando(false)
    if (!res.ok) { setAviso(j?.error === 'Faltam respostas' ? 'Ainda faltam algumas respostas.' : 'Não consegui salvar. Tenta de novo, por favor.'); if (j?.faltam) setFaltam(j.faltam); return }
    if (finalizar) { setEstado('pronto'); window.scrollTo({ top: 0 }) } else setAviso('Salvo! Pode continuar depois pelo mesmo link.')
  }

  if (estado === 'carregando') return <div style={estilo.pagina}><div style={estilo.caixa}>Carregando...</div></div>
  if (estado === 'erro') return (
    <div style={estilo.pagina}><div style={estilo.caixa}>
      <h1 style={{ fontSize: 22 }}>Link inválido</h1>
      <p style={{ color: 'var(--text2)' }}>Não encontrei essa ficha. Pede o link de novo pra Elen no WhatsApp do estúdio.</p>
    </div></div>
  )
  if (estado === 'pronto') return (
    <div style={estilo.pagina}><div style={estilo.caixa}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Prontinho{nome ? `, ${nome}` : ''}! ✅</h1>
      <p style={{ color: 'var(--text2)', lineHeight: 1.5 }}>Sua anamnese foi enviada para o MFCT Estúdio. Obrigado por responder! Pode voltar para o WhatsApp.</p>
    </div></div>
  )

  return (
    <div style={estilo.pagina}>
      <div style={estilo.caixa}>
        <p style={{ fontSize: 12, letterSpacing: '0.12em', color: 'var(--text3)', margin: 0 }}>MFCT ESTÚDIO</p>
        <h1 style={{ fontSize: 26, margin: '6px 0 8px' }}>Ficha de anamnese</h1>
        <p style={{ color: 'var(--text2)', lineHeight: 1.5, marginBottom: 24 }}>
          {nome ? `Oi, ${nome}! ` : ''}Essas respostas ajudam a montar um treino seguro e do seu jeito. Leva uns 5 minutos.
        </p>

        {ANAMNESE.map(g => (
          <section key={g.titulo} style={estilo.grupo}>
            <h2 style={estilo.titulo}>{g.titulo}</h2>
            {g.perguntas.filter(p => p.chave !== 'gestante' || feminino).map(p => {
              const marcado = faltam.includes(p.chave)
              const opcional = OPCIONAIS.includes(p.chave) && p.chave !== 'gestante'
              return (
                <div key={p.chave} id={`q-${p.chave}`} style={{ marginBottom: 16 }}>
                  <label style={estilo.pergunta} htmlFor={`c-${p.chave}`}>
                    {p.pergunta}{opcional ? <span style={{ color: 'var(--text3)', fontSize: 13 }}> (opcional)</span> : null}
                  </label>
                  {p.tipo === 'sim_nao' || p.chave === 'sexo' ? (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {(p.chave === 'sexo' ? ['Feminino', 'Masculino'] : ['Não', 'Sim']).map(op => {
                        const v = (r[p.chave] || '').trim()
                        const ativo = v.toLowerCase().startsWith(op.toLowerCase().slice(0, 1)) && (p.chave === 'sexo' || /^(s|n)/i.test(v))
                        return (
                          <button key={op} type="button" onClick={() => set(p.chave, op)}
                            style={{ ...estilo.campo, width: 'auto', minWidth: 96, cursor: 'pointer', ...(ativo ? { background: 'var(--accent)', color: '#000', borderColor: 'var(--accent)' } : {}), ...(marcado ? estilo.falta : {}) }}>
                            {op}
                          </button>
                        )
                      })}
                    </div>
                  ) : p.tipo === 'longo' ? (
                    <textarea id={`c-${p.chave}`} rows={3} value={r[p.chave] || ''} onChange={e => set(p.chave, e.target.value)} style={{ ...estilo.campo, resize: 'vertical', ...(marcado ? estilo.falta : {}) }} />
                  ) : (
                    <input id={`c-${p.chave}`} value={r[p.chave] || ''} onChange={e => set(p.chave, e.target.value)} style={{ ...estilo.campo, ...(marcado ? estilo.falta : {}) }} />
                  )}
                  {p.tipo === 'sim_nao' && /^s/i.test((r[p.chave] || '').trim()) && (
                    <input placeholder="Se quiser, explica um pouco" value={(r[p.chave] || '').replace(/^sim[\s,.:-]*/i, '')}
                      onChange={e => set(p.chave, e.target.value ? `Sim, ${e.target.value}` : 'Sim')} style={{ ...estilo.campo, marginTop: 8 }} />
                  )}
                  {p.detalhe && p.chave !== 'gestante' && p.chave !== 'sexo' && <div style={estilo.detalhe}>{p.detalhe}</div>}
                </div>
              )
            })}
          </section>
        ))}

        {aviso && <p style={{ color: aviso.startsWith('Salvo') ? '#3fb950' : 'var(--danger)', marginBottom: 12 }}>{aviso}</p>}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" disabled={enviando} onClick={() => salvar(true)} style={{ flex: '1 1 200px', padding: '14px 18px', fontSize: 16 }}>
            {enviando ? 'Enviando...' : 'Enviar anamnese'}
          </button>
          <button className="btn btn-ghost" disabled={enviando} onClick={() => salvar(false)} style={{ flex: '0 1 auto', padding: '14px 18px' }}>
            Salvar e terminar depois
          </button>
        </div>
      </div>
    </div>
  )
}
