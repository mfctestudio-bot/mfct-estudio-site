import { createClient } from '@supabase/supabase-js'

// Cliente usado SOMENTE pelas páginas /admin.
// Em vez de falar direto com o Supabase (usando a anon key, visível no navegador),
// ele fala com nosso próprio proxy server-side (/api/admin-proxy), que:
//   1) confirma que o cookie de login do admin é válido
//   2) só então usa a service role key (nunca exposta ao navegador) pra acessar o Supabase
// Isso permite travar o RLS pra qualquer acesso "anônimo" sem quebrar o painel admin.

const proxyBase =
  typeof window !== 'undefined'
    ? `${window.location.origin}/api/admin-proxy`
    : (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000') + '/api/admin-proxy'

export const supabase = createClient(proxyBase, 'admin-proxy', {
  auth: { persistSession: false },
})
