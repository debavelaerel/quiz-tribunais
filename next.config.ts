import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Headers de segurança básicos, aplicados a toda rota (o quiz é um
  // formulário de captação de lead — vale proteger contra clickjacking).
  // De propósito SEM Content-Security-Policy aqui: o app usa bastante
  // style inline (`style={{...}}`, ex. o blur progressivo em Quiz.tsx) e
  // embuti um iframe de terceiro (Panda Video, ver CONFIG.videoSrc em
  // lib/quizContent.ts) — uma CSP essa aqui exige testar cada tela pra não
  // quebrar hidratação/vídeo, não é algo pra escrever às cegas.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Ninguém pode colocar o quiz (ou o /admin) num <iframe> de outro
          // site — bloqueia clickjacking. frame-ancestors cobre o mesmo
          // caso via CSP (navegadores modernos preferem ele), mas
          // X-Frame-Options fica como fallback pros que não leem CSP.
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          // Navegador não tenta "adivinhar" o tipo de um arquivo servido
          // com Content-Type diferente do real (mitiga um vetor clássico
          // de XSS via upload/serving de arquivo com tipo errado).
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Manda a origem em navegação cross-site, mas nunca a URL
          // completa (que pro /admin/leads/[token] incluiria o token) —
          // suficiente pra analytics de referrer sem vazar identificador.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Nenhuma dessas APIs de navegador é usada em lugar nenhum do
          // app — desliga explicitamente em vez de deixar no padrão do
          // navegador (que permite pra própria origem).
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        ],
      },
    ]
  },
}

export default nextConfig
