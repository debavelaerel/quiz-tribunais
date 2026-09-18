import type { Metadata } from 'next'
import { Poppins } from 'next/font/google'
import './globals.css'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Diagnóstico VDE Tribunais',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={poppins.variable}>
      <head>
        {/* Esquenta a conexão com o host do vídeo (components/Quiz.tsx já
            pré-carrega o iframe no mount, mas essa primeira requisição sai
            mais rápido se DNS/TLS já estiverem prontos) — sem isso, o
            handshake completo só começa quando o iframe é criado. */}
        <link rel="preconnect" href="https://player-vz-246ae85e-308.tv.pandavideo.com.br" />
        <link rel="dns-prefetch" href="https://player-vz-246ae85e-308.tv.pandavideo.com.br" />
      </head>
      <body>
        {children}
        <footer className="px-6 py-4 text-center text-[12px] text-brand-ink-dim">
          Vicio de Uma Estudante © 2026 – Todos os direitos reservados.
        </footer>
      </body>
    </html>
  )
}
