'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabaseAdmin'

type Notificacao = {
  id: string
  tipo: string
  aluno_id: string | null
  aluno_nome: string | null
  mensagem: string
  lida: boolean
  created_at: string
}

const COR_TIPO: Record<string, string> = {
  cadastro_novo: '#3fb950',
  agendamento_novo: 'var(--accent)',
  comprovante_recebido: '#f0a500',
  chamar_humano: 'var(--accent2)',
}

function tempoRelativo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `${min} min atrás`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h atrás`
  const d = Math.floor(h / 24)
  return `${d}d atrás`
}

export default function NotificationBell() {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  async function carregar() {
    const { data } = await supabase
      .from('notificacoes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30)
    setNotificacoes((data as Notificacao[]) || [])
  }

  useEffect(() => {
    carregar()
    const interval = setInterval(carregar, 20000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function onClickFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', onClickFora)
    return () => document.removeEventListener('mousedown', onClickFora)
  }, [])

  const naoLidas = notificacoes.filter(n => !n.lida).length

  async function marcarTodasLidas() {
    const idsNaoLidas = notificacoes.filter(n => !n.lida).map(n => n.id)
    if (idsNaoLidas.length === 0) return
    setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })))
    await supabase.from('notificacoes').update({ lida: true }).in('id', idsNaoLidas)
  }

  async function abrirDropdown() {
    const novoEstado = !aberto
    setAberto(novoEstado)
    if (novoEstado) marcarTodasLidas()
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={abrirDropdown}
        aria-label="Notificações"
        style={{
          background: 'transparent', border: 'none', color: 'var(--text)',
          cursor: 'pointer', padding: 4, position: 'relative', display: 'flex', alignItems: 'center',
        }}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {naoLidas > 0 && (
          <span style={{
            position: 'absolute', top: -2, right: -2, background: 'var(--accent2)', color: '#fff',
            fontSize: 10, fontWeight: 800, borderRadius: 10, minWidth: 16, height: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
            border: '2px solid var(--bg2)',
          }}>
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div style={{
          position: 'absolute', top: '130%', right: 0, width: 320, maxWidth: '85vw',
          background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 200, maxHeight: 420, overflowY: 'auto',
        }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700 }}>
            Notificações
          </div>
          {notificacoes.length === 0 ? (
            <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
              Nada por aqui ainda.
            </div>
          ) : (
            notificacoes.map(n => (
              <div key={n.id} style={{
                padding: '10px 14px', borderBottom: '1px solid var(--border)',
                display: 'flex', gap: 10, alignItems: 'flex-start',
                background: n.lida ? 'transparent' : 'var(--accent2)0d',
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 5,
                  background: COR_TIPO[n.tipo] || 'var(--text3)',
                }} />
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13, color: 'var(--text)', margin: 0, lineHeight: 1.4 }}>{n.mensagem}</p>
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>{tempoRelativo(n.created_at)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
