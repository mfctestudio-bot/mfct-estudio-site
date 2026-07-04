import { NextRequest, NextResponse } from 'next/server'

const EVO_URL = 'https://ribbitingshoebill-evolution.cloudfy.live'
const EVO_KEY = 'MMxqYf3msawylWCBW2PSU4uUdJAY6mL3'

export async function POST(req: NextRequest) {
  const { phone, nomeAluno } = await req.json()
  if (!phone) return NextResponse.json({ error: 'phone required' }, { status: 400 })

  const msg = `✅ *Pagamento confirmado!*\n\nOlá ${nomeAluno?.split(' ')[0] || ''}! Seu pagamento foi confirmado pelo Matheus. Você já pode agendar suas aulas normalmente! 💪\n\nQualquer dúvida, é só me chamar.`

  await fetch(`${EVO_URL}/message/sendText/MFCT-ESTUDIO`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
    body: JSON.stringify({ number: phone, text: msg }),
  })

  // Aguardar 2 segundos e mandar link da anamnese
  await new Promise(r => setTimeout(r, 2000))

  await fetch(`${EVO_URL}/message/sendText/MFCT-ESTUDIO`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
    body: JSON.stringify({
      number: phone,
      text: `Antes de começar a treinar, preciso que você preencha nossa ficha de anamnese. É rápido e importante para personalizarmos seu treino! 📋\n\nhttps://docs.google.com/forms/d/e/1FAIpQLSeMXI_m6xNT-X147yyJaZhfzDpU0Cl_2efeOggjHz8CCrLKSw/viewform?usp=header`
    }),
  })

  return NextResponse.json({ ok: true })
}
