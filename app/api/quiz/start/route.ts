import { NextResponse } from 'next/server'
import { criarSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { criarSupabaseSessionRepo } from '@/lib/server/supabaseSessionRepo'
import type { SessionRepo } from '@/lib/server/sessionRepo'
import { iniciarSessao } from '@/lib/server/quizService'
import { permitirRequisicao } from '@/lib/server/rateLimit'
import { isUuid } from '@/lib/server/uuid'
import { EVENTO } from '@/lib/questions'
import { ipDaRequisicao } from '@/lib/server/ip'
import { nomeValido, emailValido, whatsappValido } from '@/lib/validacao'

export const runtime = 'nodejs'

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

    const {
      nome, whatsapp, email, session_token: sessionToken, fluxo,
      utm_source: utmSource, utm_medium: utmMedium, utm_campaign: utmCampaign,
      utm_content: utmContent, utm_term: utmTerm,
    } = (corpo ?? {}) as Record<string, unknown>
    if (typeof nome !== 'string' || !nomeValido(nome)) {
      return NextResponse.json({ erro: 'nome e sobrenome obrigatórios' }, { status: 422 })
    }
    // Puramente informativo (ver migration 20260908000001) — cliente antigo
    // sem o campo, ou valor fora da allowlist, cai em 'padrao' silenciosamente.
    const fluxoValido: 'padrao' | 'final' = fluxo === 'final' ? 'final' : 'padrao'
    // Idem: puramente informativo (ver migration 20260929000000) — string
    // vazia ou absurdamente longa (lixo/abuso) só é ignorada, nunca barra o
    // quiz por causa de um parâmetro de tracking.
    const utmValido = (v: unknown): string | undefined =>
      typeof v === 'string' && v.trim().length > 0 && v.length <= 200 ? v.trim() : undefined
    if (typeof email !== 'string' || !emailValido(email)) {
      return NextResponse.json({ erro: 'email inválido' }, { status: 422 })
    }
    if (typeof whatsapp !== 'string' || !whatsappValido(whatsapp)) {
      return NextResponse.json({ erro: 'whatsapp inválido' }, { status: 422 })
    }
    if (typeof sessionToken !== 'string' || !isUuid(sessionToken)) {
      return NextResponse.json({ erro: 'session_token inválido' }, { status: 422 })
    }

    try {
      const resultado = await iniciarSessao(repo, {
        nome, whatsapp: whatsapp as string, email, sessionToken, evento: EVENTO, fluxo: fluxoValido,
        utmSource: utmValido(utmSource), utmMedium: utmValido(utmMedium), utmCampaign: utmValido(utmCampaign),
        utmContent: utmValido(utmContent), utmTerm: utmValido(utmTerm),
      })
      // Fronteira JSON em snake_case (mesma convenção de /finish e /result);
      // internamente o serviço continua em camelCase.
      return NextResponse.json({
        session_token: resultado.sessionToken,
        retomando: resultado.retomando,
        respostas_salvas: resultado.respostasSalvas,
        ja_concluida: resultado.jaConcluida,
      }, { status: 200 })
    } catch (e) {
      console.error('[quiz/start] erro inesperado', e)
      throw e
    }
  }
}

export async function POST(req: Request): Promise<Response> {
  return criarHandlerStart(criarSupabaseSessionRepo(criarSupabaseAdmin()))(req)
}
