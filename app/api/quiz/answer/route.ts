import { NextResponse } from 'next/server'
import { criarSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { criarSupabaseSessionRepo } from '@/lib/server/supabaseSessionRepo'
import type { SessionRepo } from '@/lib/server/sessionRepo'
import { registrarResposta, registrarRespostasLote, SessaoInvalidaError, SessaoConcluidaError } from '@/lib/server/quizService'
import { permitirRequisicao } from '@/lib/server/rateLimit'
import { isUuid } from '@/lib/server/uuid'
import { ipDaRequisicao } from '@/lib/server/ip'

export const runtime = 'nodejs'

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

    const { session_token: sessionToken, num, escolhida, respostas } = (corpo ?? {}) as Record<string, unknown>
    if (typeof sessionToken !== 'string') {
      return NextResponse.json({ erro: 'corpo inválido' }, { status: 422 })
    }
    // session_token é uuid no banco: formato inválido é erro de entrada (422), não 500.
    if (!isUuid(sessionToken)) {
      return NextResponse.json({ erro: 'session_token inválido' }, { status: 422 })
    }

    // Lote (`respostas`, um array) — usado só pelo fluxo final (?fluxo=final)
    // pra fechar a sessão com 1 chamada em vez de até 4 sequenciais (ver
    // criarOuAtualizarSessaoFinal em components/Quiz.tsx). Formato de uma
    // resposta só (`num`/`escolhida`) continua igual, pro fluxo padrão
    // (uma chamada por questão, ao vivo).
    if (respostas !== undefined) {
      if (!Array.isArray(respostas) || respostas.some((r) => typeof r?.num !== 'number' || typeof r?.escolhida !== 'string')) {
        return NextResponse.json({ erro: 'respostas inválido' }, { status: 422 })
      }
      try {
        await registrarRespostasLote(repo, sessionToken, respostas as { num: number; escolhida: string }[])
      } catch (e) {
        if (e instanceof SessaoInvalidaError) return NextResponse.json({ erro: 'sessão não encontrada' }, { status: 404 })
        if (e instanceof SessaoConcluidaError) return NextResponse.json({ erro: 'sessão já concluída' }, { status: 409 })
        console.error('[quiz/answer] erro inesperado (lote)', e)
        throw e
      }
      return NextResponse.json({ ok: true }, { status: 200 })
    }

    if (typeof num !== 'number' || typeof escolhida !== 'string') {
      return NextResponse.json({ erro: 'corpo inválido' }, { status: 422 })
    }

    try {
      await registrarResposta(repo, sessionToken, { num, escolhida })
    } catch (e) {
      if (e instanceof SessaoInvalidaError) return NextResponse.json({ erro: 'sessão não encontrada' }, { status: 404 })
      if (e instanceof SessaoConcluidaError) return NextResponse.json({ erro: 'sessão já concluída' }, { status: 409 })
      console.error('[quiz/answer] erro inesperado', e)
      throw e
    }
    return NextResponse.json({ ok: true }, { status: 200 })
  }
}

export async function POST(req: Request): Promise<Response> {
  return criarHandlerAnswer(criarSupabaseSessionRepo(criarSupabaseAdmin()))(req)
}
