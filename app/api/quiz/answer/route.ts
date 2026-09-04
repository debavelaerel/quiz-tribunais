import { NextResponse } from 'next/server'
import { criarSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { criarSupabaseSessionRepo } from '@/lib/server/supabaseSessionRepo'
import type { SessionRepo } from '@/lib/server/sessionRepo'
import { registrarResposta, SessaoInvalidaError, SessaoConcluidaError } from '@/lib/server/quizService'
import { permitirRequisicao } from '@/lib/server/rateLimit'

export const runtime = 'nodejs'

function ipDaRequisicao(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'desconhecido'
}

export function criarHandlerAnswer(repo: SessionRepo) {
  return async function handler(req: Request): Promise<Response> {
    if (!permitirRequisicao(`answer:${ipDaRequisicao(req)}`, 60, 60_000)) {
      return NextResponse.json({ erro: 'muitas requisições' }, { status: 429 })
    }

    let corpo: unknown
    try {
      corpo = await req.json()
    } catch {
      return NextResponse.json({ erro: 'json inválido' }, { status: 400 })
    }

    const { session_token: sessionToken, num, escolhida } = (corpo ?? {}) as Record<string, unknown>
    if (typeof sessionToken !== 'string' || typeof num !== 'number' || typeof escolhida !== 'string') {
      return NextResponse.json({ erro: 'corpo inválido' }, { status: 422 })
    }

    try {
      await registrarResposta(repo, sessionToken, { num, escolhida })
    } catch (e) {
      if (e instanceof SessaoInvalidaError) return NextResponse.json({ erro: 'sessão não encontrada' }, { status: 404 })
      if (e instanceof SessaoConcluidaError) return NextResponse.json({ erro: 'sessão já concluída' }, { status: 409 })
      throw e
    }
    return NextResponse.json({ ok: true }, { status: 200 })
  }
}

export async function POST(req: Request): Promise<Response> {
  return criarHandlerAnswer(criarSupabaseSessionRepo(criarSupabaseAdmin()))(req)
}
