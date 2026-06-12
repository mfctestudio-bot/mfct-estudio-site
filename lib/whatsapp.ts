export const WHATSAPP_NUMBER = '5521979582450'

export function waLink(message: string) {
  const encoded = encodeURIComponent(message)
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encoded}`
}

export const WA_MESSAGES = {
  experimental: 'Olá! Gostaria de marcar uma aula experimental no MFCT Estúdio.',
  comoSaoAulas: 'Olá! Gostaria de saber como são as aulas do MFCT Estúdio.',
  endereco: 'Olá! Gostaria de saber o endereço do MFCT Estúdio.',
  matricula: 'Olá! Gostaria de fazer minha matrícula no MFCT Estúdio.',
  avulsa: 'Olá! Gostaria de marcar uma aula avulsa no MFCT Estúdio.',
}
