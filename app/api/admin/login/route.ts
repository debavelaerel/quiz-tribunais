import { NextResponse } from 'next/server'
import { senhaConfere, assinarSessao, NOME_COOKIE_ADMIN } from '@/lib/server/adminAuth'
import { permitirRequisicao } from '@/lib/server/rateLimit'
import { ipDaRequisicao } from '@/lib/server/ip'

export const runtime = 'nodejs'

type Config = { senhaEsperada: string | undefined; segredoSessao: string | undefined }

export function criarHandlerAdminLogin(config: Config) {
  return async function handler(req: Request): Promise<Response> {
    // Limite apertado — é literalmente o freio contra força bruta numa senha
    // única compartilhada, então mais restrito que as rotas do quiz público.
    // Limitação conhecida: permitirRequisicao é em memória do processo (ver
    // lib/server/rateLimit.ts), então em deploy serverless com várias
    // instâncias/cold starts esse limite NÃO é global — cada instância conta
    // por si. O freio real contra força bruta é ADMIN_PASSWORD ser longa e
    // aleatória (ver .env.example), não este rate-limit.
    if (!permitirRequisicao(`admin-login:${ipDaRequisicao(req)}`, 8, 60_000)) {
      return NextResponse.json({ erro: 'muitas tentativas, aguarde um pouco' }, { status: 429 })
    }

    const { senhaEsperada, segredoSessao } = config
    if (!senhaEsperada || !segredoSessao) {
      console.error('[admin/login] ADMIN_PASSWORD ou ADMIN_SESSION_SECRET não configurados')
      return NextResponse.json({ erro: 'painel administrativo não configurado' }, { status: 503 })
    }

    let corpo: unknown
    try {
      corpo = await req.json()
    } catch {
      return NextResponse.json({ erro: 'json inválido' }, { status: 400 })
    }
    const { senha } = (corpo ?? {}) as Record<string, unknown>
    if (typeof senha !== 'string' || !senhaConfere(senha, senhaEsperada)) {
      return NextResponse.json({ erro: 'senha incorreta' }, { status: 401 })
    }

    const res = NextResponse.json({ ok: true }, { status: 200 })
    res.cookies.set(NOME_COOKIE_ADMIN, assinarSessao(segredoSessao), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 dias — mesma validade checada em verificarSessao
    })
    return res
  }
}

export async function POST(req: Request): Promise<Response> {
  return criarHandlerAdminLogin({
    senhaEsperada: process.env.ADMIN_PASSWORD,
    segredoSessao: process.env.ADMIN_SESSION_SECRET,
  })(req)
}
