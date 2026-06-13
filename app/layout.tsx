import type { Metadata } from 'next'
import './globals.css'
import WhatsAppButton from '@/components/WhatsAppButton'

export const metadata: Metadata = {
  metadataBase: new URL('https://mfct-estudio-site.vercel.app'),
  title: 'MFCT Estúdio — Treinamento Personalizado no Rio de Janeiro',
  description: 'Estúdio de personal training em Rio de Janeiro. Aulas individuais e em grupo, planos flexíveis, aula experimental gratuita.',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
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
