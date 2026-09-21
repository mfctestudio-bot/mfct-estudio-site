import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Plano = {
  id: string
  nome: string
  vezes_semana: number
  valor: number
  ativo: boolean
  created_at: string
}

export type Servico = {
  id: string
  nome: string
  valor: number
  quantidade_usos: number
  tem_agenda: boolean
  ativo: boolean
  created_at: string
}

export type Aluno = {
  id: string
  nome: string
  cpf: string | null
  data_nascimento: string | null
  telefone: string | null
  email: string | null
  plano_id: string | null
  status_plano: 'lead' | 'experimental_oferecida' | 'experimental_agendada' | 'experimental_realizada' | 'faltou_experimental' | 'em_negociacao' | 'perdido' | 'experimental' | 'ativo' | 'pausado' | 'vencido' | 'cancelado'
  data_matricula: string
  observacoes: string | null
  dia_vencimento: number | null
  foto_url: string | null
  created_at: string
  planos?: Plano
}

export type Professor = {
  id: string
  nome: string
  valor_por_aula: number
  ativo: boolean
  created_at: string
}

export type TipoAgenda = {
  id: string
  nome: string
  permite_plano_mensal: boolean
  permite_avulsa: boolean
  ativo: boolean
}

export type Horario = {
  id: string
  dia_semana: number
  horario: string
  capacidade: number
  ativo: boolean
  professor_id: string | null
  professores?: Professor | null
  tipo_agenda_id: string | null
  tipos_agenda?: TipoAgenda | null
}

export type Agendamento = {
  id: string
  aluno_id: string
  horario_id: string
  data: string
  status: 'confirmado' | 'cancelado' | 'realizado'
  tipo: 'aula' | 'experimental'
  follow_up_enviado: boolean
  created_at: string
}

export type Pagamento = {
  id: string
  aluno_id: string
  plano_id: string | null
  valor: number
  valor_original: number | null
  desconto: number | null
  observacao: string | null
  status: 'pendente' | 'aguardando_confirmacao' | 'pago' | 'vencido' | 'cancelado'
  mercado_pago_id: string | null
  mercado_pago_link: string | null
  data_vencimento: string | null
  data_pagamento: string | null
  created_at: string
}

export type Post = {
  id: string
  titulo: string
  conteudo: string
  imagem_url: string | null
  publicado: boolean
  created_at: string
}
