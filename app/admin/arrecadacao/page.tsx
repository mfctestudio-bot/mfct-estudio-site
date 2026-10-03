'use client'
// Arrecadação agora é a aba "Entradas por serviço" do Caixa (02/10/2026).
import { Redireciona } from '@/components/ui/Redireciona'

export default function ArrecadacaoPage() {
  return <Redireciona padrao="/admin/caixa#entradas" />
}
