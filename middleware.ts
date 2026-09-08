import { NextResponse, type NextRequest } from 'next/server'
import { NOME_COOKIE_ADMIN, verificarSessao } from '@/lib/server/adminAuth'

// Node.js, não Edge — adminAuth usa node:crypto (createHmac/timingSafeEqual),
// que o runtime Edge não suporta.
export const runtime = 'nodejs'

// Protege só o painel administrativo — nenhuma rota pública do quiz passa
// por aqui (ver `matcher` abaixo). Sem ADMIN_SESSION_SECRET configurado,
// nega tudo (falha fechada, não aberta).
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  // A própria rota de login (página e endpoint) não pode exigir o cookie
  // que ela existe pra emitir.
  if (pathname === '/admin/login' || pathname === '/api/admin/login') return NextResponse.next()

  const segredo = process.env.ADMIN_SESSION_SECRET
  const cookie = req.cookies.get(NOME_COOKIE_ADMIN)?.value
  const autenticado = Boolean(segredo) && verificarSessao(cookie, segredo as string)

  if (autenticado) return NextResponse.next()

  if (pathname.startsWith('/api/admin')) {
    return NextResponse.json({ erro: 'não autenticado' }, { status: 401 })
  }
  const destino = new URL('/admin/login', req.url)
  destino.searchParams.set('proximo', pathname)
  return NextResponse.redirect(destino)
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}
