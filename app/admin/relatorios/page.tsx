'use client'
// Relatórios agora ficam dentro de Caixa (02/10/2026).
import { Redireciona } from '@/components/ui/Redireciona'

const MAPA = { mes: '/admin/caixa#mes', ano: '/admin/caixa#ano' }
export default function RelatoriosPage() {
  return <Redireciona padrao="/admin/caixa#mes" mapa={MAPA} />
}
