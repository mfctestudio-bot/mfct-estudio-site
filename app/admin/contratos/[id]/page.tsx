'use client'
import { useEffect, useState, Suspense } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseAdmin'
import { MODELO_CONTRATO_PADRAO, preencherContrato } from '@/lib/contrato'
import { Cabecalho } from '@/components/ui/Cabecalho'

const dataBR = (iso?: string | null) => (iso ? new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR') : '')
const brl = (v?: number | null) => (v == null ? '' : 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
function telBR(t?: string | null) {
  const d = String(t || '').replace(/\D/g, '').replace(/^55/, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return t || ''
}

function ContratoAlunoContent() {
  const { id } = useParams<{ id: string }>()
  const [texto, setTexto] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState('')

  useEffect(() => {
    (async () => {
      const hoje = new Date().toISOString().slice(0, 10)
      const [{ data: aluno }, { data: cfg }, { data: periodos }] = await Promise.all([
        supabase.from('alunos').select('nome, cpf, data_nascimento, telefone, dia_vencimento, planos(nome, valor, vezes_semana)').eq('id', id).single(),
        supabase.from('configuracoes').select('valor').eq('chave', 'modelo_contrato').maybeSingle(),
        supabase.from('planos_periodos').select('data_inicio, data_fim, status').eq('aluno_id', id).order('data_fim', { ascending: false }),
      ])
      if (!aluno) { setErro('Aluno não encontrado.'); return }
      const a = aluno as { nome: string; cpf: string | null; data_nascimento: string | null; telefone: string | null; dia_vencimento: number | null; planos: unknown }
      const plano = (Array.isArray(a.planos) ? a.planos[0] : a.planos) as { nome: string; valor: number; vezes_semana: number } | null
      const lista = (periodos as { data_inicio: string; data_fim: string; status: string }[]) || []
      const atual = lista.find(p => p.data_inicio <= hoje && p.data_fim >= hoje) || lista[0]
      const modelo = (cfg as { valor: string | null } | null)?.valor || MODELO_CONTRATO_PADRAO
      setNome(a.nome)
      setTexto(preencherContrato(modelo, {
        nome: a.nome || '', cpf: a.cpf || '', data_nascimento: dataBR(a.data_nascimento), telefone: telBR(a.telefone),
        plano: plano?.nome || '', vezes_semana: plano?.vezes_semana ? String(plano.vezes_semana) : '', valor: brl(plano?.valor),
        dia_vencimento: a.dia_vencimento ? String(a.dia_vencimento) : '',
        data_inicio: dataBR(atual?.data_inicio), data_fim: dataBR(atual?.data_fim),
        data_hoje: new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }),
      }))
    })()
  }, [id])

  if (erro) return <p style={{ color: 'var(--danger)' }}>{erro}</p>
  if (texto == null) return <p className="vazio">Carregando...</p>

  const paginas = texto.split(/^\s*=+\s*QUEBRA DE PÁGINA\s*=+\s*$/m)
  const faltando = (texto.match(/_{10,}/g) || []).length

  return (
    <div>
      <style>{`
        .folha { background: #fff; color: #111; padding: 48px 56px; border-radius: 6px; margin-bottom: 20px; box-shadow: 0 1px 8px #0004;
                 font-family: Georgia, 'Times New Roman', serif; font-size: 13.5px; line-height: 1.6; white-space: pre-wrap; }
        @media print {
          .no-print, .admin-topbar { display: none !important; }
          body, main { background: #fff !important; }
          main { max-width: none !important; padding: 0 !important; }
          .folha { box-shadow: none; border-radius: 0; padding: 0; margin: 0; page-break-after: always; }
          .folha:last-child { page-break-after: auto; }
          @page { margin: 2cm; }
        }
      `}</style>
      <Cabecalho
        className="no-print"
        voltar={{ href: '/admin/contratos', label: 'Contratos' }}
        titulo={`Contrato de ${nome}`}
        subtitulo={<>
          Confira os dados antes de imprimir. {faltando > 0 && <span style={{ color: '#e0a020' }}>⚠️ Tem campo em branco (linha ____) — complete o cadastro do aluno ou preencha à mão.</span>}
        </>}
        acoes={<>
          <button onClick={() => window.print()} className="btn btn-primary btn-sm">🖨️ Imprimir / Salvar PDF</button>
          <Link href={`/admin/alunos/${id}`} className="btn btn-ghost btn-sm">Ver cadastro do aluno</Link>
        </>}
      />
      {paginas.map((p, i) => <div key={i} className="folha">{p.trim()}</div>)}
    </div>
  )
}

export default function ContratoAlunoPage() {
  return <Suspense><ContratoAlunoContent /></Suspense>
}
