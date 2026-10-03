'use client'
import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseAdmin'
import { Cabecalho } from '@/components/ui/Cabecalho'

type AlunoOpt = { id: string; nome: string; status_plano: string }

function ContratosContent() {
  const [alunos, setAlunos] = useState<AlunoOpt[]>([])
  const [busca, setBusca] = useState('')

  useEffect(() => {
    supabase.from('alunos').select('id, nome, status_plano').not('nome', 'is', null).order('nome').then(({ data }) => setAlunos((data as AlunoOpt[]) || []))
  }, [])

  const filtrados = alunos.filter(a => a.nome.toLowerCase().includes(busca.toLowerCase()))

  return (
    <div>
      <Cabecalho
        titulo="Contratos"
        subtitulo={<>
          Escolha o aluno pra gerar o contrato + termo de responsabilidade já preenchidos, prontos pra imprimir ou salvar em PDF.
          O texto do modelo se edita em <Link href="/admin/configuracoes#contrato" style={{ color: '#4a90d9' }}>Configurações → Contrato</Link>.
        </>}
      />

      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>📄 Gerar contrato de um aluno</div>
        <input className="campo" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar aluno..." style={{ marginBottom: 10 }} />
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
