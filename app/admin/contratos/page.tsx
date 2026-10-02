'use client'
import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseAdmin'

type AlunoOpt = { id: string; nome: string; status_plano: string }

function ContratosContent() {
  const [alunos, setAlunos] = useState<AlunoOpt[]>([])
  const [busca, setBusca] = useState('')

  useEffect(() => {
    supabase.from('alunos').select('id, nome, status_plano').not('nome', 'is', null).order('nome').then(({ data }) => setAlunos((data as AlunoOpt[]) || []))
  }, [])

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
        O texto do modelo se edita em <Link href="/admin/configuracoes#contrato" style={{ color: '#4a90d9' }}>Configurações → Contrato</Link>.
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

    </div>
  )
}

export default function ContratosPage() {
  return <Suspense><ContratosContent /></Suspense>
}
