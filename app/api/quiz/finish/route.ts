import { NextResponse, after } from 'next/server'
import { criarSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { criarSupabaseSessionRepo } from '@/lib/server/supabaseSessionRepo'
import type { SessionRepo } from '@/lib/server/sessionRepo'
import { concluirSessao, SessaoInvalidaError, SessaoConcluidaError, SessaoIncompletaError } from '@/lib/server/quizService'
import { gerarEArmazenarDiagnostico, gerarEArmazenarApresentacao } from '@/lib/server/diagnosticoPdfBackground'
import { permitirRequisicao } from '@/lib/server/rateLimit'
import { isUuid } from '@/lib/server/uuid'
import { ipDaRequisicao } from '@/lib/server/ip'

export const runtime = 'nodejs'
// `after()` conta pro tempo de vida da MESMA function — sem isso, o padrão
// da plataforma pode matar a função antes do trabalho em background
// terminar. O fetch pro serviço de diagnóstico já usa um timeout de 55s (ver
// diagnosticoService.ts) — 60 deixava quase zero folga pra tudo em volta dele
// (rate limit, ler/gravar a sessão duas vezes no Supabase); 90 dá margem
// de verdade sem chegar perto do teto de function da Vercel.
export const maxDuration = 90

// `after()` exige contexto de requisição real do Next.js — chamar a rota
// direto (como os testes fazem, sem passar pelo servidor de verdade)
// estoura "after() was called outside a request scope". Injetável por isso:
// em produção usa `after` de next/server; os testes passam um stub síncrono.
export function criarHandlerFinish(repo: SessionRepo, agendarBackground: (tarefa: () => void | Promise<void>) => void = after) {
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
      // Gera o diagnóstico e a apresentação comercial em PDF e sobe os dois pro S3
      // depois de responder — não faz quem terminou o quiz esperar o
      // Chromium do serviço Python renderizar (ver
      // lib/server/diagnosticoPdfBackground.ts pro que acontece se isso falhar:
      // nunca propaga erro pra cá, só grava em
      // laudo_pdf_erro/apresentacao_pdf_erro). As duas chamadas rodam em
      // paralelo (Promise.all), não uma depois da outra — cada uma já tem
      // seu próprio teto de 55s pro serviço Python (ver diagnosticoService.ts);
      // em paralelo, as duas cabem dentro do maxDuration abaixo sem
      // precisar dobrá-lo.
      agendarBackground(async () => {
        await Promise.all([
          gerarEArmazenarDiagnostico(repo, sessao),
          gerarEArmazenarApresentacao(repo, sessao),
        ])
      })
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
