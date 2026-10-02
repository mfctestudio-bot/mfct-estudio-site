import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * Cabeçalho padrão das páginas do admin.
 * Só visual: título, texto de ajuda, link de "voltar" e botões à direita.
 * Mesmo tamanho e espaçamento em todas as telas (classes em globals.css).
 */
export function Cabecalho({
  titulo,
  subtitulo,
  voltar,
  acoes,
  className,
}: {
  titulo: ReactNode
  subtitulo?: ReactNode
  voltar?: { href: string; label: ReactNode }
  acoes?: ReactNode
  className?: string
}) {
  return (
    <header className={`page-header${className ? ` ${className}` : ''}`}>
      {voltar && (
        <Link href={voltar.href} className="page-back">
          ← {voltar.label}
        </Link>
      )}
      <div className="page-header-row">
        <div className="page-header-text">
          <h1 className="page-title">{titulo}</h1>
          {subtitulo && <div className="page-sub">{subtitulo}</div>}
        </div>
        {acoes && <div className="page-actions">{acoes}</div>}
      </div>
    </header>
  )
}
