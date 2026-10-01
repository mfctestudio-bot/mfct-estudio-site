'use client'
import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseAdmin'
import { CAMPOS_CONTRATO, MODELO_CONTRATO_PADRAO } from '@/lib/contrato'

type AlunoOpt = { id: string; nome: string; status_plano: string }

function ContratosContent() {
  const [modelo, setModelo] = useState('')
  const [salvo, setSalvo] = useState('')
  const [existe, setExiste] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [alunos, setAlunos] = useState<AlunoOpt[]>([])
  const [busca, setBusca] = useState('')

  useEffect(() => {
    supabase.from('configuracoes').select('valor').eq('chave', 'modelo_contrato').maybeSingle().then(({ data }) => {
      const v = (data as { valor: string | null } | null)?.valor
      setExiste(!!data)
      setModelo(v || MODELO_CONTRATO_PADRAO)
      setSalvo(v || '')
    })
    supabase.from('alunos').select('id, nome, status_plano').not('nome', 'is', null).order('nome').then(({ data }) => setAlunos((data as AlunoOpt[]) || []))
  }, [])

  async function salvar() {
    setSalvando(true)
    const corpo = { valor: modelo, atualizado_em: new Date().toISOString() }
    const { error } = existe
      ? await supabase.from('configuracoes').update(corpo).eq('chave', 'modelo_contrato')
      : await supabase.from('configuracoes').insert({ chave: 'modelo_contrato', ...corpo })
    setSalvando(false)
    if (error) { alert('Não consegui salvar o modelo: ' + error.message); return }
    setExiste(true); setSalvo(modelo)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6,
    padding: '9px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
  }
  const filtrados = alunos.filter(a => a.nome.toLowerCase().includes(busca.toLowerCase()))

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Contratos</h1>
      <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>
        Escolha o aluno pra gerar o contrato + termo de responsabilidade já preenchidos, prontos pra imprimir ou salvar em PDF.
        Abaixo dá pra editar o texto do modelo.
      </p>

      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>📄 Gerar contrato de um aluno</div>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar aluno..." style={{ ...inputStyle, marginBottom: 10 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 280, overflowY: 'auto' }}>
          {filtrados.map(a => (
            <Link key={a.id} href={`/admin/contratos/${a.id}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 6, background: 'var(--bg)', color: 'var(--text)', textDecoration: 'none', fontSize: 13 }}>
              <span>{a.nome}</span><span style={{ fontSize: 11, color: 'var(--text3)' }}>{a.status_plano}</span>
            </Link>
          ))}
          {!filtrados.length && <p style={{ fontSize: 12, color: 'var(--text3)' }}>Nenhum aluno encontrado.</p>}
        </div>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>✏️ Texto do modelo</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => { if (confirm('Voltar o texto para o modelo padrão? O que você editou e não salvou se perde.')) setModelo(MODELO_CONTRATO_PADRAO) }} className="btn btn-ghost btn-sm">Restaurar padrão</button>
            <button onClick={salvar} disabled={salvando || modelo === salvo} className="btn btn-primary btn-sm">{salvando ? 'Salvando...' : 'Salvar modelo'}</button>
          </div>
        </div>
        {!existe && <p style={{ fontSize: 12, color: '#e0a020', marginBottom: 8 }}>Esse é o modelo padrão sugerido — revise os trechos marcados com [AJUSTAR] e clique em Salvar modelo.</p>}
        <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>
          Campos automáticos: {CAMPOS_CONTRATO.map(c => <code key={c.chave} title={c.descricao} style={{ marginRight: 6 }}>{`{{${c.chave}}}`}</code>)}
          · Pra começar uma folha nova na impressão, deixe uma linha com <code>==== QUEBRA DE PÁGINA ====</code>.
        </p>
        <textarea value={modelo} onChange={e => setModelo(e.target.value)} style={{ ...inputStyle, minHeight: 480, fontFamily: 'ui-monospace, monospace', fontSize: 12, lineHeight: 1.5 }} />
      </div>
    </div>
  )
}

export default function ContratosPage() {
  return <Suspense><ContratosContent /></Suspense>
}
