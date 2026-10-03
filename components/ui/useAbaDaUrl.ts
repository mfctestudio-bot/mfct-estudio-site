'use client'
import { useEffect } from 'react'

/**
 * Abre a aba certa quando a página é acessada pelo menu com "#aba"
 * (ex.: /admin/financeiro#caixa). Só escolhe qual aba mostrar — não muda nada nos dados.
 */
export function useAbaDaUrl<T extends string>(validas: readonly T[], setAba: (a: T) => void) {
  useEffect(() => {
    const ler = () => {
      const h = window.location.hash.slice(1) as T
      if (validas.includes(h)) setAba(h)
    }
    ler()
    window.addEventListener('hashchange', ler)
    return () => window.removeEventListener('hashchange', ler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
