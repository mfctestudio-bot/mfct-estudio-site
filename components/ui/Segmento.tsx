'use client'

/** Duas opções lado a lado (ex.: "Valor fixo" | "Chave aberta"), no padrão do admin. */
export function Segmento({ value, onChange, trueLabel, falseLabel }: {
  value: boolean; onChange: (v: boolean) => void; trueLabel: string; falseLabel: string
}) {
  return (
    <div className="segmento">
      <button type="button" className={value ? 'ativo' : ''} onClick={() => onChange(true)}>{trueLabel}</button>
      <button type="button" className={!value ? 'ativo' : ''} onClick={() => onChange(false)}>{falseLabel}</button>
    </div>
  )
}
