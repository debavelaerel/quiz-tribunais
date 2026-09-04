import { NextResponse } from 'next/server'
import { criarSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { criarSupabaseSessionRepo } from '@/lib/server/supabaseSessionRepo'
import type { SessionRepo } from '@/lib/server/sessionRepo'
import { buscarResultado } from '@/lib/server/quizService'

export const runtime = 'nodejs'

export function criarHandlerResult(repo: SessionRepo) {
  return async function handler(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const sessionToken = url.searchParams.get('session_token')
    if (!sessionToken) return NextResponse.json({ erro: 'session_token obrigatório' }, { status: 422 })

    const sessao = await buscarResultado(repo, sessionToken)
    if (!sessao) return NextResponse.json({ erro: 'não encontrado' }, { status: 404 })

    return NextResponse.json({
      score_geral_pct: sessao.scoreGeralPct,
      acertos: sessao.acertos,
      total: sessao.total,
      area_prioritaria: sessao.areaPrioritaria,
      areas: sessao.areas,
    }, { status: 200 })
  }
}

export async function GET(req: Request): Promise<Response> {
  return criarHandlerResult(criarSupabaseSessionRepo(criarSupabaseAdmin()))(req)
}
