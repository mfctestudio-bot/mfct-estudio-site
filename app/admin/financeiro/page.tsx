'use client'
// O antigo "Financeiro" foi dividido (02/10/2026):
//  - Controle de caixa / Histórico / Visão geral → Caixa (/admin/caixa)
//  - Horas trabalhadas → Pagamento de professores (/admin/pagamento-professores)
import { Redireciona } from '@/components/ui/Redireciona'

const MAPA = {
  horas: '/admin/pagamento-professores',
  caixa: '/admin/caixa#despesas',
  historico: '/admin/caixa#ano',
  visao: '/admin/caixa#mes',
}
export default function FinanceiroPage() {
  return <Redireciona padrao="/admin/caixa#mes" mapa={MAPA} />
}
