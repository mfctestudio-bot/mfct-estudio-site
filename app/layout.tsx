import type { Metadata } from 'next'
import './globals.css'
import WhatsAppButton from '@/components/WhatsAppButton'

export const metadata: Metadata = {
  metadataBase: new URL('https://mfct-estudio-site.vercel.app'),
  title: 'MFCT Estúdio — Treinamento Personalizado no Rio de Janeiro',
  description: 'Estúdio de personal training em Rio de Janeiro. Aulas individuais e em grupo, planos flexíveis, aula experimental gratuita.',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'MFCT Estúdio',
    description: 'Treinamento personalizado em Rio de Janeiro — Chatuba/Caju',
    siteName: 'MFCT Estúdio',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <WhatsAppButton />
      </body>
    </html>
  )
}
