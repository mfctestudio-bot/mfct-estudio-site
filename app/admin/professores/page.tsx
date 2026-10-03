'use client'
// O cadastro de professores foi para Configurações → Professores (02/10/2026).
import { Redireciona } from '@/components/ui/Redireciona'

export default function ProfessoresPage() {
  return <Redireciona padrao="/admin/configuracoes#professores" />
}
