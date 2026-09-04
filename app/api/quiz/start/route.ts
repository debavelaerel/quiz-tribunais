import { NextResponse } from 'next/server'
import { criarSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { criarSupabaseSessionRepo } from '@/lib/server/supabaseSessionRepo'
import type { SessionRepo } from '@/lib/server/sessionRepo'
import { iniciarSessao } from '@/lib/server/quizService'
import { permitirRequisicao } from '@/lib/server/rateLimit'
import { EVENTO } from '@/lib/questions'

export const runtime = 'nodejs'

function ipDaRequisicao(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'desconhecido'
}

function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function criarHandlerStart(repo: SessionRepo) {
  return async function handler(req: Request): Promise<Response> {
    if (!permitirRequisicao(`start:${ipDaRequisicao(req)}`, 10, 60_000)) {
      return NextResponse.json({ erro: 'muitas requisições' }, { status: 429 })
    }

    let corpo: unknown
    try {
      corpo = await req.json()
    } catch {
      return NextResponse.json({ erro: 'json inválido' }, { status: 400 })
    }

    const { nome, whatsapp, email, session_token: sessionToken } = (corpo ?? {}) as Record<string, unknown>
    if (typeof nome !== 'string' || nome.trim() === '') {
      return NextResponse.json({ erro: 'nome obrigatório' }, { status: 422 })
    }
    if (typeof email !== 'string' || !emailValido(email)) {
      return NextResponse.json({ erro: 'email inválido' }, { status: 422 })
    }
    const digitos = typeof whatsapp === 'string' ? whatsapp.replace(/\D/g, '').length : 0
    if (digitos < 10 || digitos > 13) {
      return NextResponse.json({ erro: 'whatsapp inválido' }, { status: 422 })
    }
    if (typeof sessionToken !== 'string' || sessionToken.length < 10) {
      return NextResponse.json({ erro: 'session_token inválido' }, { status: 422 })
    }

    const resultado = await iniciarSessao(repo, {
      nome, whatsapp: whatsapp as string, email, sessionToken, evento: EVENTO,
    })
    return NextResponse.json(resultado, { status: 200 })
  }
}

export async function POST(req: Request): Promise<Response> {
  return criarHandlerStart(criarSupabaseSessionRepo(criarSupabaseAdmin()))(req)
}
