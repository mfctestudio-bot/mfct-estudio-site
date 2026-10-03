'use client'
import { Cabecalho } from '@/components/ui/Cabecalho'
import { HorasTrabalhadas } from '@/components/admin/financeiro/HorasTrabalhadas'

// Pagamento de professores (era a aba "Horas trabalhadas" do Financeiro — 02/10/2026).
export default function PagamentoProfessoresPage() {
  return (
    <div>
      <Cabecalho
        titulo="Pagamento de professores"
        subtitulo="Quantas aulas cada professor deu na semana e no mês, e quanto tem a receber."
      />
      <HorasTrabalhadas />
    </div>
  )
}
