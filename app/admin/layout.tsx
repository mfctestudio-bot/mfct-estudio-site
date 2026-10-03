'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import NotificationBell from '@/components/admin/NotificationBell'
import { supabase } from '@/lib/supabaseAdmin'

function Icon({ name }: { name: string }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (name) {
    case 'home':
      return <svg {...common}><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></svg>
    case 'users':
      return <svg {...common}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><path d="M16 8.2a3 3 0 0 1 0 5.9" /><path d="M18.5 20c0-2.7-1.5-4.8-3.7-5.7" /></svg>
    case 'calendar':
      return <svg {...common}><rect x="3.5" y="5" width="17" height="16" rx="2" /><line x1="3.5" y1="10" x2="20.5" y2="10" /><line x1="8" y1="3" x2="8" y2="7" /><line x1="16" y1="3" x2="16" y2="7" /></svg>
    case 'activity':
      return <svg {...common}><path d="M3 12h4l2-7 4 14 2-7h6" /></svg>
    case 'card':
      return <svg {...common}><rect x="2.5" y="5.5" width="19" height="13" rx="2" /><line x1="2.5" y1="10" x2="21.5" y2="10" /></svg>
    case 'tag':
      return <svg {...common}><path d="M11.5 3.5H4v7.5l10 10 7.5-7.5-10-10z" /><circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none" /></svg>
    case 'chart':
      return <svg {...common}><line x1="5" y1="20" x2="5" y2="12" /><line x1="12" y1="20" x2="12" y2="5" /><line x1="19" y1="20" x2="19" y2="15" /></svg>
    case 'file':
      return <svg {...common}><path d="M6 3h9l4 4v14H6z" /><line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="16" x2="15" y2="16" /></svg>
    case 'sliders':
      return <svg {...common}><line x1="4" y1="6" x2="20" y2="6" /><circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" /><line x1="4" y1="12" x2="20" y2="12" /><circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" /><line x1="4" y1="18" x2="20" y2="18" /><circle cx="11" cy="18" r="2" fill="currentColor" stroke="none" /></svg>
    case 'globe':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18" /></svg>
    case 'gear':
      return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" /></svg>
    case 'chevron':
      return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
    default:
      return null
  }
}

type SubItemFixo = { href: string; label: string; icon: string }
type ItemMenu = {
  href: string
  label: string
  icon: string
  accordion?: 'planos' | 'servicos' // sanfona dinâmica: subitens vêm do banco
  subitens?: SubItemFixo[] // sanfona fixa: subitens são sempre os mesmos
  atalho?: boolean // mostra o ícone ⚙ que leva pra página principal (só quando existe uma página "do objeto")
}
type ItemAccordion = { id: string; nome: string; ativo: boolean }

// Menu do admin — organizado conforme o mapa do sistema definido pelo Matheus (02/10/2026).
// Só organiza links para as telas que já existem; "#aba" abre direto a aba certa da página.
const GRUPOS: { titulo: string | null; itens: ItemMenu[] }[] = [
  {
    titulo: 'Dashboard',
    itens: [{ href: '/admin', label: 'Visão geral do estúdio', icon: 'home' }],
  },
  {
    titulo: 'Alunos',
    itens: [
      { href: '/admin/alunos', label: 'Matrículas', icon: 'users' },
      { href: '/admin/mensalidades', label: 'Mensalidades', icon: 'card' },
      { href: '/admin/avaliacoes', label: 'Avaliações', icon: 'activity' },
    ],
  },
  {
    titulo: 'Agenda e grade de horários',
    itens: [
      {
        href: '/admin/agenda', label: 'Agenda', icon: 'calendar', atalho: true,
        subitens: [
          { href: '/admin/agenda#semana', label: 'Semana', icon: 'calendar' },
          { href: '/admin/agenda#aulas', label: 'Próximas aulas', icon: 'calendar' },
          { href: '/admin/agenda#grade', label: 'Grade de horário geral', icon: 'calendar' },
          { href: '/admin/professores', label: 'Grade dos professores', icon: 'users' },
          { href: '/admin/servicos', label: 'Grade de serviços', icon: 'sliders' },
        ],
      },
    ],
  },
  {
    titulo: 'Serviços e planos',
    itens: [
      { href: '/admin/servicos', label: 'Serviços', icon: 'sliders', accordion: 'servicos', atalho: true },
      { href: '/admin/planos', label: 'Planos', icon: 'tag', accordion: 'planos', atalho: true },
    ],
  },
  {
    titulo: 'Financeiro',
    itens: [
      {
        href: '/admin/pagamentos', label: 'Pagamentos gerais', icon: 'card',
        subitens: [
          { href: '/admin/pagamentos', label: 'Registro geral de pagamentos', icon: 'card' },
          { href: '/admin/avulsas', label: 'Pagamentos de serviços', icon: 'tag' },
        ],
      },
      {
        href: '/admin/arrecadacao', label: 'Caixa', icon: 'chart',
        subitens: [
          { href: '/admin/arrecadacao', label: 'Arrecadação', icon: 'chart' },
          { href: '/admin/financeiro#caixa', label: 'Controle de caixa', icon: 'chart' },
          { href: '/admin/financeiro#historico', label: 'Histórico mensal', icon: 'chart' },
        ],
      },
      {
        href: '/admin/relatorios', label: 'Relatórios', icon: 'file',
        subitens: [
          { href: '/admin/relatorios#mes', label: 'Relatório mensal (e despesas)', icon: 'file' },
          { href: '/admin/relatorios#ano', label: 'Relatório anual', icon: 'file' },
        ],
      },
      {
        href: '/admin/financeiro', label: 'Gestão financeira', icon: 'chart',
        subitens: [
          { href: '/admin/financeiro#visao', label: 'Visão completa', icon: 'chart' },
          { href: '/admin/financeiro#horas', label: 'Horas trabalhadas', icon: 'users' },
        ],
      },
    ],
  },
  {
    titulo: 'Site',
    itens: [{ href: '/admin/posts', label: 'Publicações', icon: 'globe' }],
  },
  {
    titulo: 'Configurações',
    itens: [
      {
        href: '/admin/configuracoes', label: 'Configurações', icon: 'gear',
        subitens: [
          { href: '/admin/configuracoes#pagamentos', label: 'Financeiro (Pix)', icon: 'card' },
          { href: '/admin/configuracoes#contrato', label: 'Matrículas (contrato)', icon: 'file' },
          { href: '/admin/configuracoes#categorias', label: 'Serviços (categorias)', icon: 'tag' },
          { href: '/admin/configuracoes#elen', label: 'Elen (WhatsApp)', icon: 'users' },
          { href: '/admin/configuracoes#limpeza', label: 'Sistema (limpeza)', icon: 'sliders' },
        ],
      },
    ],
  },
]

// Aba que cada página abre quando não tem "#aba" no endereço.
const ABA_PADRAO: Record<string, string> = {
  '/admin/agenda': 'semana',
  '/admin/financeiro': 'visao',
  '/admin/relatorios': 'mes',
  '/admin/configuracoes': 'pagamentos',
}

// Separa "/admin/financeiro#caixa" em caminho e aba.
function partes(href: string) {
  const [path, aba = ''] = href.split('#')
  return { path, aba }
}
// O item (ou algum subitem dele) é a página aberta agora?
function itemContem(item: ItemMenu, pathname: string | null) {
  if (!pathname) return false
  const bate = (h: string) => { const { path } = partes(h); return pathname === path || (path !== '/admin' && pathname.startsWith(path + '/')) }
  return bate(item.href) || !!item.subitens?.some(sub => bate(sub.href))
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [menuAberto, setMenuAberto] = useState(false)
  const [abertos, setAbertos] = useState<Record<string, boolean>>({})
  const [planosLista, setPlanosLista] = useState<ItemAccordion[]>([])
  const [servicosLista, setServicosLista] = useState<ItemAccordion[]>([])

  useEffect(() => {
    supabase.from('planos').select('id, nome, ativo').order('nome').then(({ data }) => {
      setPlanosLista((data as ItemAccordion[]) || [])
    })
    supabase.from('servicos').select('id, nome, ativo').order('nome').then(({ data }) => {
      setServicosLista((data as ItemAccordion[]) || [])
    })
  }, [])

  // Aba aberta agora (o que vem depois do # no endereço), pra destacar o subitem certo.
  const [hash, setHash] = useState('')
  useEffect(() => {
    const ler = () => setHash(window.location.hash.slice(1))
    ler()
    window.addEventListener('hashchange', ler)
    return () => window.removeEventListener('hashchange', ler)
  }, [pathname])

  // Ao abrir o menu, já deixa expandida a seção da página em que você está.
  function abrirMenu() {
    const atual = GRUPOS.flatMap(g => g.itens).find(i => i.subitens && itemContem(i, pathname))
    if (atual) setAbertos(prev => ({ ...prev, [atual.accordion || atual.href]: true }))
    setMenuAberto(true)
  }

  // Clicar num link do menu. Se for outra aba da MESMA página, só troca o "#aba" do endereço
  // (a página escuta e muda de aba sozinha, sem recarregar).
  function irPara(e: React.MouseEvent, href: string) {
    setMenuAberto(false)
    const { path, aba } = partes(href)
    if (path === pathname) {
      e.preventDefault()
      history.pushState(null, '', aba ? `${path}#${aba}` : path)
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    }
  }

  function subAtivo(href: string, irmaos: SubItemFixo[]) {
    const { path, aba } = partes(href)
    if (pathname !== path) return false
    const abaAtual = hash || ABA_PADRAO[path] || ''
    if (aba) return aba === abaAtual
    // link sem aba: ativo, a não ser que outro irmão aponte pra aba aberta
    return !irmaos.some(o => partes(o.href).path === path && partes(o.href).aba && partes(o.href).aba === abaAtual)
  }

  function toggleAberto(chave: string) {
    setAbertos(prev => ({ ...prev, [chave]: !prev[chave] }))
  }

  const listaPorAccordion: Record<'planos' | 'servicos', ItemAccordion[]> = {
    planos: planosLista,
    servicos: servicosLista,
  }

  async function sair() {
    await fetch('/api/admin-auth', { method: 'DELETE' })
    router.push('/admin-login')
  }

  const linkStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px',
    borderRadius: 6, textDecoration: 'none', fontSize: 13, fontWeight: 600,
    color: active ? 'var(--text)' : 'var(--text2)',
    background: active ? 'var(--card)' : 'transparent',
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: "'Inter', sans-serif" }}>
      {/* Barra fixa no topo — sempre, em qualquer tamanho de tela */}
      <div className="admin-topbar no-print" style={{
        position: 'sticky', top: 0, zIndex: 40, background: 'var(--bg2)',
        borderBottom: '1px solid var(--border)', padding: '0.75rem 1.25rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button
          onClick={abrirMenu}
          aria-label="Abrir menu"
          style={{ background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0, width: 32 }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Image src="/logo.png" alt="MFCT" width={30} height={20} style={{ objectFit: 'contain' }} />
          <span style={{ fontFamily: 'Anton, sans-serif', fontSize: 14, letterSpacing: 1 }}>ADMIN</span>
        </div>

        <div style={{ width: 32, display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
          <NotificationBell />
        </div>
      </div>

      {/* Overlay + menu deslizante — a mesma coisa em qualquer tamanho de tela */}
      {menuAberto && (
        <div
          onClick={() => setMenuAberto(false)}
          style={{ position: 'fixed', inset: 0, background: '#000c', zIndex: 50 }}
        >
          <aside
            onClick={e => e.stopPropagation()}
            style={{
              width: 270, maxWidth: '82vw', height: '100vh', background: 'var(--bg2)',
              borderRight: '1px solid var(--border)', padding: '1.25rem 0.75rem',
              display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0.5rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Image src="/logo.png" alt="MFCT" width={36} height={24} style={{ objectFit: 'contain' }} />
                <span style={{ fontFamily: 'Anton, sans-serif', fontSize: 15, letterSpacing: 1 }}>ADMIN</span>
              </div>
              <button onClick={() => setMenuAberto(false)} aria-label="Fechar menu" style={{ background: 'transparent', border: 'none', color: 'var(--text2)', cursor: 'pointer', display: 'flex' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="5" y1="5" x2="19" y2="19" />
                  <line x1="19" y1="5" x2="5" y2="19" />
                </svg>
              </button>
            </div>

            {GRUPOS.map((grupo, gi) => (
              <div key={gi} style={{ marginBottom: 10 }}>
                {grupo.titulo && (
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', letterSpacing: '1px', textTransform: 'uppercase', padding: '8px 12px 4px' }}>
                    {grupo.titulo}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {grupo.itens.map(item => {
                    const active = item.subitens
                      ? item.subitens.some(sub => subAtivo(sub.href, item.subitens!)) || (itemContem(item, pathname) && !item.subitens.some(sub => partes(sub.href).path === pathname))
                      : (pathname === item.href || (item.href !== '/admin' && !!pathname?.startsWith(item.href)))

                    if (!item.accordion && !item.subitens) {
                      return (
                        <Link key={item.href} href={item.href} onClick={e => irPara(e, item.href)} style={linkStyle(active)}>
                          <Icon name={item.icon} />
                          {item.label}
                        </Link>
                      )
                    }

                    const chaveAberto = item.accordion || item.href
                    const aberto = !!abertos[chaveAberto]
                    // No menu lateral só aparecem os ativos — os desativados só aparecem na lista completa (dentro da página).
                    const listaDinamica = item.accordion ? listaPorAccordion[item.accordion].filter(row => row.ativo) : null

                    return (
                      <div key={item.href}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <button
                            onClick={() => toggleAberto(chaveAberto)}
                            style={{ ...linkStyle(active), flex: 1, border: 'none', cursor: 'pointer', textAlign: 'left' }}
                          >
                            <span style={{ transform: aberto ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s ease', display: 'flex' }}>
                              <Icon name="chevron" />
                            </span>
                            <Icon name={item.icon} />
                            {item.label}
                          </button>
                          {item.atalho && <Link
                            href={item.href}
                            onClick={() => setMenuAberto(false)}
                            title="Configuração geral"
                            aria-label={`Configurar ${item.label}`}
                            style={{ display: 'flex', alignItems: 'center', padding: '9px 10px', borderRadius: 6, color: 'var(--text2)' }}
                          >
                            <Icon name="sliders" />
                          </Link>}
                        </div>
                        {aberto && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginLeft: 30, borderLeft: '1px solid var(--border)', paddingLeft: 10 }}>
                            {listaDinamica && listaDinamica.map(row => (
                              <Link
                                key={row.id}
                                href={`${item.href}#${row.id}`}
                                onClick={e => irPara(e, `${item.href}#${row.id}`)}
                                style={{
                                  padding: '7px 10px', borderRadius: 6, textDecoration: 'none', fontSize: 12,
                                  color: row.ativo ? 'var(--text2)' : 'var(--text3)',
                                }}
                              >
                                {row.nome}{!row.ativo && ' (desativado)'}
                              </Link>
                            ))}
                            {listaDinamica && !listaDinamica.length && (
                              <span style={{ fontSize: 11, color: 'var(--text3)', padding: '7px 10px' }}>Nada configurado ainda</span>
                            )}
                            {item.subitens && item.subitens.map(sub => (
                              <Link
                                key={sub.href}
                                href={sub.href}
                                onClick={e => irPara(e, sub.href)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 8,
                                  padding: '7px 10px', borderRadius: 6, textDecoration: 'none', fontSize: 12,
                                  color: subAtivo(sub.href, item.subitens!) ? 'var(--text)' : 'var(--text2)',
                                  background: subAtivo(sub.href, item.subitens!) ? 'var(--card)' : 'transparent',
                                }}
                              >
                                <Icon name={sub.icon} />
                                {sub.label}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            <div style={{ flex: 1 }} />
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 8 }}>
              <Link href="/" style={{ fontSize: 12, color: 'var(--text3)', textDecoration: 'none', padding: '10px 12px', display: 'block' }}>
                ← Ver site
              </Link>
              <button onClick={sair} style={{
                textAlign: 'left', background: 'transparent', border: 'none', color: 'var(--danger)', width: '100%',
                fontSize: 12, fontWeight: 700, padding: '10px 12px', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Sair
              </button>
            </div>
          </aside>
        </div>
      )}

      <main className="admin-main" style={{ maxWidth: 1100, width: '100%', margin: '0 auto', padding: '1.5rem 1.25rem', boxSizing: 'border-box' }}>
        {children}
      </main>
    </div>
  )
}
