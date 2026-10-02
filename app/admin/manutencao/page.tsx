import { redirect } from 'next/navigation'

// "Manutenção" virou parte de Configurações.
export default function ManutencaoPage() {
  redirect('/admin/configuracoes#limpeza')
}
