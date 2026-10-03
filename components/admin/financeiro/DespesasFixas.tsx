'use client'
// Despesas fixas do estúdio (modelo usado no fechamento do mês) + folha dos professores.
// Era o "Controle de caixa" do Financeiro; a lógica de gravar/editar é a mesma (02/10/2026).
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseAdmin'
import { carregarFolhaProfessoresMes } from './folhaProfessores'
import { CardNumero as Card } from './CardNumero'

export function DespesasFixas({ totalMes }: { totalMes: number }) {
  const [categorias, setCategorias] = useState<{ id: string; categoria: string; valor: number; cor: string }[]>([])
  const [loadingCat, setLoadingCat] = useState(true)
  const [novaCategoria, setNovaCategoria] = useState('')
  const [novoValor, setNovoValor] = useState('')
  const [folhaProfessores, setFolhaProfessores] = useState(0)

  async function carregar() {
    setLoadingCat(true)
    const [{ data }, folha] = await Promise.all([
      supabase.from('caixa_config').select('*').order('ordem'),
      carregarFolhaProfessoresMes(),
    ])
    setCategorias((data as { id: string; categoria: string; valor: number; cor: string }[]) || [])
    setFolhaProfessores(folha)
    setLoadingCat(false)
  }

  useEffect(() => { carregar() }, [])

  async function atualizarValor(id: string, valor: number) {
    setCategorias(prev => prev.map(c => c.id === id ? { ...c, valor } : c))
    await supabase.from('caixa_config').update({ valor }).eq('id', id)
  }

  async function removerCategoria(id: string) {
    if (!confirm('Remover essa categoria?')) return
    await supabase.from('caixa_config').delete().eq('id', id)
    carregar()
  }

  async function adicionarCategoria() {
    if (!novaCategoria.trim()) return
    const cores = ['#e05656', '#4a90d9', '#f0a500', '#3fb950', '#9b59b6', '#e67e22']
    await supabase.from('caixa_config').insert({
      categoria: novaCategoria.trim(),
      valor: Number(novoValor) || 0,
      cor: cores[categorias.length % cores.length],
      ordem: categorias.length,
    })
    setNovaCategoria('')
    setNovoValor('')
    carregar()
  }

  const totalDespesas = categorias.reduce((s, c) => s + Number(c.valor), 0) + folhaProfessores
  const totalPercentual = totalMes > 0 ? (totalDespesas / totalMes) * 100 : 0
  const lucroValor = totalMes - totalDespesas
  const lucroPercentual = totalMes > 0 ? (lucroValor / totalMes) * 100 : 0


  if (loadingCat) return <p className="vazio">Carregando...</p>

  return (
    <div>
      <p className="ajuda" style={{ marginBottom: 16 }}>
        Quanto você gasta todo mês em cada tipo de despesa (aluguel, luz, internet...). Serve de modelo: no Fechamento do mês,
        o botão de copiar o modelo lança essas despesas de uma vez. O que os professores têm a receber entra sozinho. A receita
        aqui é tudo que entrou no mês até agora (mensalidades, aulas avulsas e serviços).
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        <Card label="Receita do mês (até agora)" value={`R$ ${totalMes.toFixed(2)}`} />
        <Card label={`Lucro estimado (${lucroPercentual.toFixed(0)}%)`} value={`R$ ${lucroValor.toFixed(2)}`} accent={lucroValor >= 0 ? '#3fb950' : 'var(--danger)'} />
      </div>

      <div className="card bloco" style={{ marginBottom: 20 }}>
        <div className="secao-titulo">Despesas fixas do mês</div>

        <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
          {folhaProfessores > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: '#4a90d9', display: 'inline-block' }} />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Professores (folha do mês)</span>
                  <span style={{ fontSize: 10, color: 'var(--text3)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px' }}>🔒 automático</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--text2)' }}>{totalMes > 0 ? ((folhaProfessores / totalMes) * 100).toFixed(1) : '0'}%</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>R$ {folhaProfessores.toFixed(2)}</span>
                </div>
              </div>
              <div style={{ height: 6, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
                <div style={{ height: '100%', width: `${Math.min(100, totalMes > 0 ? (folhaProfessores / totalMes) * 100 : 0)}%`, background: '#4a90d9' }} />
              </div>
              <p style={{ fontSize: 11, color: 'var(--text3)' }}>Calculado a partir das aulas dadas esse mês × valor por aula de cada professor. Pra mudar, ajuste em Configurações → Professores ou na grade de horários — não dá pra editar aqui.</p>
            </div>
          )}
          {categorias.map(c => {
            const percentualCategoria = totalMes > 0 ? (Number(c.valor) / totalMes) * 100 : 0
            return (
              <div key={c.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: c.cor, display: 'inline-block' }} />
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{c.categoria}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>{percentualCategoria.toFixed(1)}%</span>
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>R$</span>
                    <input
                      type="number" min={0} step="0.01" value={c.valor}
                      onChange={e => atualizarValor(c.id, Number(e.target.value))}
                      style={{ width: 90 }}
                    />
                    <button onClick={() => removerCategoria(c.id)} className="btn btn-ghost">🗑️</button>
                  </div>
                </div>
                <div style={{ height: 6, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, percentualCategoria)}%`, background: c.cor }} />
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ fontSize: 12, color: totalPercentual > 100 ? 'var(--danger)' : 'var(--text3)', marginBottom: 16 }}>
          Total de despesas: R$ {totalDespesas.toFixed(2)} ({totalPercentual.toFixed(1)}% da receita do mês) {totalPercentual > 100 && '— as despesas passaram da receita do mês'}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            placeholder="Nova categoria (ex: Aluguel)"
            value={novaCategoria}
            onChange={e => setNovaCategoria(e.target.value)}
            style={{ flex: 1, minWidth: 160 }}
          />
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>R$</span>
          <input
            type="number" min={0} step="0.01" placeholder="0,00" value={novoValor}
            onChange={e => setNovoValor(e.target.value)}
            style={{ width: 90 }}
          />
          <button onClick={adicionarCategoria} className="btn btn-primary btn-sm">
            + Adicionar
          </button>
        </div>
      </div>
    </div>
  )
}
