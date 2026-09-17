import { NextResponse } from 'next/server'
import { criarSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { criarSupabaseSessionRepo } from '@/lib/server/supabaseSessionRepo'
import type { SessionRepo } from '@/lib/server/sessionRepo'
import { buscarResultado } from '@/lib/server/quizService'
import { isUuid } from '@/lib/server/uuid'

export const runtime = 'nodejs'

export function criarHandlerResult(repo: SessionRepo) {
  return async function handler(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const sessionToken = url.searchParams.get('session_token')
    if (!sessionToken) return NextResponse.json({ erro: 'session_token obrigatório' }, { status: 422 })
    // session_token é uuid no banco: formato inválido nunca corresponde a uma
    // sessão concluída — mesma semântica de "não encontrado" (404), sem virar 500.
    if (!isUuid(sessionToken)) return NextResponse.json({ erro: 'não encontrado' }, { status: 404 })

    let sessao
    try {
      sessao = await buscarResultado(repo, sessionToken)
    } catch (e) {
      console.error('[quiz/result] erro inesperado', e)
      throw e
    }
    if (!sessao) return NextResponse.json({ erro: 'não encontrado' }, { status: 404 })

    return NextResponse.json({
      score_geral_pct: sessao.scoreGeralPct,
      acertos: sessao.acertos,
      total: sessao.total,
      area_prioritaria: sessao.areaPrioritaria,
      areas: sessao.areas,
      blocos: sessao.blocos,
      // Sem isso, o cliente não tinha como remontar a ficha (alvo, cargo,
      // momento etc.) ao reexibir um resultado já concluído — respostasPerfil
      // só existe em memória, nunca em cache local.
      perfil: sessao.perfil,
    }, { status: 200 })
  }
}

export async function GET(req: Request): Promise<Response> {
  return criarHandlerResult(criarSupabaseSessionRepo(criarSupabaseAdmin()))(req)
}
