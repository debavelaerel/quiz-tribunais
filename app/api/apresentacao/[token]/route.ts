import { NextResponse } from 'next/server'
import { criarSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { criarSupabaseSessionRepo } from '@/lib/server/supabaseSessionRepo'
import type { SessionRepo } from '@/lib/server/sessionRepo'
import type { QuizSession } from '@/lib/server/types'
import { isUuid } from '@/lib/server/uuid'
import { s3Configurado, urlAssinadaDoDiagnostico } from '@/lib/server/s3'
import { gerarApresentacaoPdf, validarSessaoParaDiagnostico, DiagnosticoIndisponivel } from '@/lib/server/diagnosticoService'
import { nivelTeste } from '@/lib/perfil'

export const runtime = 'nodejs'
// A apresentação também é gerada em background na conclusão do quiz (ver
// lib/server/diagnosticoPdfBackground.ts::gerarEArmazenarApresentacao,
// app/api/quiz/finish/route.ts) — na prática a chave já costuma estar
// pronta quando esse link é acessado. Mesmo assim, diferente do diagnóstico, essa
// rota gera na hora se ainda não tiver chave (em vez de 425 "ainda
// gerando") — rede de segurança pro caso raro da geração em background
// ainda estar rodando ou ter falhado, sem deixar o link do CRM preso
// esperando alguém entrar no admin e gerar manualmente. Por isso o timeout
// generoso: só paga o preço de renderizar as 22 telas quando essa rede de
// segurança entra em ação; o caminho normal (chave já pronta) é instantâneo.
export const maxDuration = 60

// Link estável pra apresentação comercial de um lead — mesma ideia do link
// do diagnóstico (app/api/laudo/[token]/route.ts): reaproveita laudoToken (não um
// token próprio) porque session_token é reescrito toda vez que a mesma
// pessoa retoma o quiz, e laudoToken nunca muda depois de criado.
export function criarHandlerApresentacao(
  repo: SessionRepo,
  gerarUrlAssinada: (s3Key: string) => Promise<string> = urlAssinadaDoDiagnostico,
  s3Ok: () => boolean = s3Configurado,
  gerarApresentacao: (sessao: QuizSession, nivel: string) => Promise<{ s3Key: string | null }> =
    (sessao, nivel) => gerarApresentacaoPdf(sessao, nivel, { salvarS3: true }),
) {
  return async function handler(_req: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
    const { token } = await params
    if (!isUuid(token)) return NextResponse.json({ erro: 'não encontrado' }, { status: 404 })

    const sessao = await repo.buscarPorLaudoToken(token)
    if (!sessao || sessao.status !== 'concluido') {
      return NextResponse.json({ erro: 'não encontrado' }, { status: 404 })
    }

    if (!s3Ok()) {
      return NextResponse.json({ erro: 'armazenamento de apresentação não configurado' }, { status: 503 })
    }

    let s3Key = sessao.apresentacaoPdfS3Key
    if (!s3Key) {
      const problemas = validarSessaoParaDiagnostico(sessao)
      if (problemas.length > 0) {
        console.error('[apresentacao/token] sessão incompleta pra gerar apresentação', { token, problemas })
        return NextResponse.json({ erro: 'sessão incompleta', detalhes: problemas }, { status: 422 })
      }

      const nivel = sessao.acertos !== null ? nivelTeste(sessao.acertos) : ''
      try {
        s3Key = (await gerarApresentacao(sessao, nivel)).s3Key
      } catch (e) {
        const mensagem = e instanceof DiagnosticoIndisponivel ? e.message : String(e)
        console.error('[apresentacao/token] falha ao gerar apresentação', { token, erro: mensagem })
        await repo.atualizar(sessao.id, { apresentacaoPdfErro: mensagem }).catch((e2) => {
          console.error('[apresentacao/token] falha ao gravar apresentacao_pdf_erro', e2)
        })
        return NextResponse.json({ erro: 'falha ao gerar a apresentação' }, { status: 502 })
      }
      // s3Key null aqui só acontece se o serviço Python respondeu OK mas sem
      // S3_BUCKET configurado do lado dele — mesma situação "sem link ainda"
      // do diagnóstico (ver ResultadoDiagnostico em lib/server/diagnosticoService.ts).
      if (!s3Key) {
        return NextResponse.json({ erro: 'armazenamento de apresentação não configurado' }, { status: 503 })
      }
      await repo.atualizar(sessao.id, { apresentacaoPdfS3Key: s3Key, apresentacaoPdfErro: null }).catch((e) => {
        console.error('[apresentacao/token] falha ao gravar apresentacao_pdf_s3_key', e)
      })
    }

    const url = await gerarUrlAssinada(s3Key)
    // no-store: mesma razão do link do diagnóstico — a URL é assinada e de curta
    // duração, não pode ficar guardada num proxy/CDN no meio do caminho.
    return NextResponse.redirect(url, { status: 302, headers: { 'Cache-Control': 'no-store' } })
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }): Promise<Response> {
  return criarHandlerApresentacao(criarSupabaseSessionRepo(criarSupabaseAdmin()))(req, ctx)
}
