'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseAdmin'
import { Professor } from '@/lib/supabase'
import { Cabecalho } from '@/components/ui/Cabecalho'
import { AgendaDoProfessor } from '@/components/admin/professores/Professores'

// Grade dos professores (02/10/2026): escolhe o professor e vê/edita os horários dele.
// É a mesma grade que antes abria em "Ver agenda" na tela Professores.
export default function AgendaProfessoresPage() {
  const [professores, setProfessores] = useState<Professor[]>([])
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('professores').select('*').order('created_at').then(({ data }) => {
      const lista = (data as Professor[]) || []
      setProfessores(lista)
      const doLink = window.location.hash.slice(1)
      const ativos = lista.filter(p => p.ativo)
      setSelecionado(lista.some(p => p.id === doLink) ? doLink : (ativos[0] || lista[0])?.id || null)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    const ouvir = () => { const id = window.location.hash.slice(1); if (id) setSelecionado(id) }
    window.addEventListener('hashchange', ouvir)
    return () => window.removeEventListener('hashchange', ouvir)
  }, [])

  function escolher(id: string) {
    setSelecionado(id)
    history.replaceState(null, '', `#${id}`)
  }

  return (
    <div>
      <Cabecalho
        titulo="Grade dos professores"
        subtitulo={<>
          Horários de cada professor na semana. Clique num quadradinho pra abrir, mudar vagas ou fechar um horário.
          O cadastro do professor (nome e valor da aula) fica em <Link href="/admin/configuracoes#professores">Configurações → Professores</Link>.
        </>}
      />

      {loading ? <p className="vazio">Carregando...</p> : !professores.length ? (
        <p className="vazio">Nenhum professor cadastrado. Cadastre em <Link href="/admin/configuracoes#professores">Configurações → Professores</Link>.</p>
      ) : (
        <>
          <div className="chips">
            {professores.map(p => (
              <button key={p.id} onClick={() => escolher(p.id)} className={`chip${selecionado === p.id ? ' ativo' : ''}`} style={{ opacity: p.ativo ? 1 : 0.55 }}>
                {p.nome}{!p.ativo && ' (inativo)'}
              </button>
            ))}
          </div>
          {selecionado && (
            <div className="card" style={{ padding: '16px 18px' }}>
              <AgendaDoProfessor key={selecionado} professorId={selecionado} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
