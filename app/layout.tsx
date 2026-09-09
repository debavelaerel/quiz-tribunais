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
      <body>
        {children}
        <footer className="px-6 py-4 text-center text-[12px] text-brand-ink-dim">
          Vicio de Uma Estudante © 2026 – Todos os direitos reservados.
        </footer>
      </body>
    </html>
  )
}
