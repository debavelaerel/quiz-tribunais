import { NextResponse } from 'next/server'
import { criarSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { criarSupabaseSessionRepo } from '@/lib/server/supabaseSessionRepo'
import type { SessionRepo } from '@/lib/server/sessionRepo'
import { registrarCliqueWhatsapp, SessaoInvalidaError } from '@/lib/server/quizService'
import { permitirRequisicao } from '@/lib/server/rateLimit'
import { isUuid } from '@/lib/server/uuid'
import { ipDaRequisicao } from '@/lib/server/ip'

export const runtime = 'nodejs'

// Sinal de intenção de compra: a pessoa clicou no CTA de WhatsApp na tela de
// resultado. Chamada de forma silenciosa (fire-and-forget) pelo cliente — não
// bloqueia nem atrasa a abertura do WhatsApp em nenhuma hipótese.
export function criarHandlerWhatsapp(repo: SessionRepo) {
  return async function handler(req: Request): Promise<Response> {
    if (!permitirRequisicao(`whatsapp:${ipDaRequisicao(req)}`, 30, 60_000)) {
      return NextResponse.json({ erro: 'muitas requisições' }, { status: 429 })
    }

    let corpo: unknown
    try {
      corpo = await req.json()
    } catch {
      return NextResponse.json({ erro: 'json inválido' }, { status: 400 })
    }

    const { session_token: sessionToken } = (corpo ?? {}) as Record<string, unknown>
    if (typeof sessionToken !== 'string' || !isUuid(sessionToken)) {
      return NextResponse.json({ erro: 'session_token inválido' }, { status: 422 })
    }

    try {
      await registrarCliqueWhatsapp(repo, sessionToken)
    } catch (e) {
      if (e instanceof SessaoInvalidaError) return NextResponse.json({ erro: 'sessão não encontrada' }, { status: 404 })
      console.error('[quiz/whatsapp] erro inesperado', e)
      throw e
    }
    return NextResponse.json({ ok: true }, { status: 200 })
  }
}

export async function POST(req: Request): Promise<Response> {
  return criarHandlerWhatsapp(criarSupabaseSessionRepo(criarSupabaseAdmin()))(req)
}
