'use client'

/**
 * Quando a página é aberta com "#<id>" (ex.: clicando num serviço/plano no menu),
 * rola a tela até o card daquele item e dá um destaque rápido.
 * O card precisa ter id={`item-${id}`}.
 */
export function idDoEndereco() {
  if (typeof window === 'undefined') return ''
  return decodeURIComponent(window.location.hash.slice(1))
}

export function rolarAteCard(id: string) {
  // limpa o #id do endereço pra não reabrir o card toda vez que a lista recarregar
  history.replaceState(null, '', window.location.pathname + window.location.search)
  // espera o card aparecer na tela (depois de abrir a edição)
  setTimeout(() => {
    const el = document.getElementById(`item-${id}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el.classList.add('glow-accent')
    setTimeout(() => el.classList.remove('glow-accent'), 2200)
  }, 80)
}
