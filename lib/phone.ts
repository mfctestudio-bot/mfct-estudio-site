export function normalizarTelefone(raw: string): string {
  let digitos = (raw || '').replace(/\D/g, '')
  if (!digitos) return ''
  // Remove zero inicial de DDD, se tiver (ex: 021...)
  if (digitos.length === 11 && digitos.startsWith('0')) digitos = digitos.slice(1)
  // Se nao tem codigo do pais (55) e tem DDD+numero (10 ou 11 digitos), adiciona
  if ((digitos.length === 10 || digitos.length === 11) && !digitos.startsWith('55')) {
    digitos = '55' + digitos
  }
  return digitos
}
