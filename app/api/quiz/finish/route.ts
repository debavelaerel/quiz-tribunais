import { NextResponse } from 'next/server'
import { criarSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { criarSupabaseSessionRepo } from '@/lib/server/supabaseSessionRepo'
import type { SessionRepo } from '@/lib/server/sessionRepo'
import { concluirSessao, SessaoInvalidaError, SessaoConcluidaError, SessaoIncompletaError } from '@/lib/server/quizService'
import { permitirRequisicao } from '@/lib/server/rateLimit'
import { isUuid } from '@/lib/server/uuid'
import { ipDaRequisicao } from '@/lib/server/ip'

export const runtime = 'nodejs'

export function criarHandlerFinish(repo: SessionRepo) {
  return async function handler(req: Request): Promise<Response> {
    if (!permitirRequisicao(`finish:${ipDaRequisicao(req)}`, 10, 60_000)) {
      return NextResponse.json({ erro: 'muitas requisições' }, { status: 429 })
    }

    let corpo: unknown
    try {
      corpo = await req.json()
    } catch {
      return NextResponse.json({ erro: 'json inválido' }, { status: 400 })
    }

    const { session_token: sessionToken } = (corpo ?? {}) as Record<string, unknown>
    if (typeof sessionToken !== 'string') {
      return NextResponse.json({ erro: 'corpo inválido' }, { status: 422 })
    }
    // session_token é uuid no banco: formato inválido é erro de entrada (422), não 500.
    if (!isUuid(sessionToken)) {
      return NextResponse.json({ erro: 'session_token inválido' }, { status: 422 })
    }

    try {
      const sessao = await concluirSessao(repo, sessionToken)
      return NextResponse.json({
        score_geral_pct: sessao.scoreGeralPct,
        acertos: sessao.acertos,
        total: sessao.total,
        area_prioritaria: sessao.areaPrioritaria,
        areas: sessao.areas,
        blocos: sessao.blocos,
      }, { status: 200 })
    } catch (e) {
      if (e instanceof SessaoInvalidaError) return NextResponse.json({ erro: 'sessão não encontrada' }, { status: 404 })
      if (e instanceof SessaoConcluidaError) return NextResponse.json({ erro: 'sessão já concluída' }, { status: 409 })
      if (e instanceof SessaoIncompletaError) return NextResponse.json({ erro: 'faltam respostas' }, { status: 422 })
      console.error('[quiz/finish] erro inesperado', e)
      throw e
    }
  }
}

export async function POST(req: Request): Promise<Response> {
  return criarHandlerFinish(criarSupabaseSessionRepo(criarSupabaseAdmin()))(req)
}
