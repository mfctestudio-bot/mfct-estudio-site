'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Página antiga que mudou de lugar: manda pro endereço novo (mantém links salvos funcionando).
 * `mapa` escolhe o destino pelo "#aba" do endereço antigo; `padrao` é usado quando não bate.
 */
const SEM_MAPA: Record<string, string> = {}

export function Redireciona({ padrao, mapa = SEM_MAPA }: { padrao: string; mapa?: Record<string, string> }) {
  const router = useRouter()
  useEffect(() => {
    const aba = window.location.hash.slice(1)
    router.replace(mapa[aba] || padrao)
  }, [router, padrao, mapa])
  return <p className="vazio">Abrindo…</p>
}
