'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseAdmin'

function cardStyle(): React.CSSProperties {
  return {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: 20,
    marginBottom: 16,
  }
}

function botaoStyle(perigo = false): React.CSSProperties {
  return {
    background: perigo ? 'transparent' : 'var(--accent2)',
    color: perigo ? 'var(--danger)' : '#fff',
    border: perigo ? '1px solid var(--danger)' : 'none',
    borderRadius: 8,
    padding: '10px 16px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  }
}

export default function ManutencaoPage() {
  const [contagens, setContagens] = useState<{ notificacoesLidas: number; conversasAntigas: number } | null>(null)
  const [dias, setDias] = useState(60)
  const [carregando, setCarregando] = useState(false)
  const [mensagem, setMensagem] = useState<string | null>(null)

  async function carregarContagens() {
    setCarregando(true)
    const cortedata = new Date()
    cortedata.setDate(cortedata.getDate() - dias)
    const cortadaStr = cortedata.toISOString()

    const [notifs, conversas] = await Promise.all([
      supabase.from('notificacoes').select('id', { count: 'exact', head: true }).eq('lida', true),
      supabase.from('bot_historico_conversas').select('id', { count: 'exact', head: true }).lt('created_at', cortadaStr),
    ])

    setContagens({
      notificacoesLidas: notifs.count || 0,
      conversasAntigas: conversas.count || 0,
    })
    setCarregando(false)
  }

  useEffect(() => { carregarContagens() }, [dias])

  async function limparNotificacoesLidas() {
    if (!confirm('Apagar todas as notificações já lidas do sininho? Isso não pode ser desfeito.')) return
    setCarregando(true)
    setMensagem(null)
    const { error } = await supabase.from('notificacoes').delete().eq('lida', true)
    setMensagem(error ? `Erro: ${error.message}` : '✅ Notificações lidas apagadas.')
    await carregarContagens()
  }

  async function limparConversasAntigas() {
    if (!confirm(`Apagar o histórico de conversas da Elen com mais de ${dias} dias? Isso não pode ser desfeito.`)) return
    setCarregando(true)
    setMensagem(null)
    const cortedata = new Date()
    cortedata.setDate(cortedata.getDate() - dias)
    const { error } = await supabase.from('bot_historico_conversas').delete().lt('created_at', cortedata.toISOString())
    setMensagem(error ? `Erro: ${error.message}` : '✅ Histórico antigo de conversas apagado.')
    await carregarContagens()
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Manutenção</h1>
      <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 20 }}>
        Limpeza de dados antigos que já não são mais úteis no dia a dia. Isso não afeta alunos, planos, agendamentos
        ou pagamentos — só histórico e notificações já vistas.
      </p>

      {mensagem && (
        <div style={{ ...cardStyle(), padding: 12, fontSize: 13, color: mensagem.startsWith('✅') ? 'var(--text)' : 'var(--danger)' }}>
          {mensagem}
        </div>
      )}

      <div style={cardStyle()}>
        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Notificações já lidas</h2>
        <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 12 }}>
          Notificações do sininho (topo do painel) que você já visualizou.
          {contagens && <> Atualmente: <strong>{contagens.notificacoesLidas}</strong> pra apagar.</>}
        </p>
        <button onClick={limparNotificacoesLidas} disabled={carregando} style={botaoStyle(true)}>
          Limpar notificações lidas
        </button>
      </div>

      <div style={cardStyle()}>
        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Histórico de conversas da Elen</h2>
        <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 12 }}>
          Mensagens antigas trocadas com a Elen no WhatsApp. Mensagens recentes continuam guardadas — elas são
          usadas pela Elen pra lembrar o contexto da conversa.
          {contagens && <> Atualmente: <strong>{contagens.conversasAntigas}</strong> mensagens com mais de {dias} dias.</>}
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <label style={{ fontSize: 13, color: 'var(--text2)' }}>Apagar mensagens com mais de</label>
          <input
            type="number"
            value={dias}
            min={7}
            onChange={e => setDias(Number(e.target.value) || 60)}
            style={{ width: 70, background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--text)', padding: '4px 8px' }}
          />
          <span style={{ fontSize: 13, color: 'var(--text2)' }}>dias</span>
        </div>
        <button onClick={limparConversasAntigas} disabled={carregando} style={botaoStyle(true)}>
          Limpar histórico antigo
        </button>
      </div>
    </div>
  )
}
