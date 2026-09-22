import { NextResponse } from 'next/server'
import { criarSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { criarSupabaseSessionRepo } from '@/lib/server/supabaseSessionRepo'
import type { SessionRepo } from '@/lib/server/sessionRepo'
import type { QuizSession } from '@/lib/server/types'
import { isUuid } from '@/lib/server/uuid'
import { s3Configurado, urlAssinadaDoLaudo } from '@/lib/server/s3'
import { gerarApresentacaoPdf, validarSessaoParaLaudo, LaudoIndisponivel } from '@/lib/server/laudoService'
import { nivelTeste } from '@/lib/perfil'

export const runtime = 'nodejs'
// Diferente do laudo: quando ninguém gerou a apresentação ainda, essa rota
// gera na hora (em vez de 425 "ainda gerando") — não tem geração em
// background pra apresentação (só o clique manual do admin, ver
// app/api/admin/leads/[token]/apresentacao/route.ts), então "ainda não tem
// chave" aqui significa "ninguém pediu ainda", não "está a caminho". Por
// isso o timeout generoso: a primeira visita ao link paga o preço de
// renderizar as 22 telas; as próximas reaproveitam o S3 e são instantâneas.
export const maxDuration = 60

// Link estável pra apresentação comercial de um lead — mesma ideia do link
// do laudo (app/api/laudo/[token]/route.ts): reaproveita laudoToken (não um
// token próprio) porque session_token é reescrito toda vez que a mesma
// pessoa retoma o quiz, e laudoToken nunca muda depois de criado.
export function criarHandlerApresentacao(
  repo: SessionRepo,
  gerarUrlAssinada: (s3Key: string) => Promise<string> = urlAssinadaDoLaudo,
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
      const problemas = validarSessaoParaLaudo(sessao)
      if (problemas.length > 0) {
        console.error('[apresentacao/token] sessão incompleta pra gerar apresentação', { token, problemas })
        return NextResponse.json({ erro: 'sessão incompleta', detalhes: problemas }, { status: 422 })
      }

      const nivel = sessao.acertos !== null ? nivelTeste(sessao.acertos) : ''
      try {
        s3Key = (await gerarApresentacao(sessao, nivel)).s3Key
      } catch (e) {
        const mensagem = e instanceof LaudoIndisponivel ? e.message : String(e)
        console.error('[apresentacao/token] falha ao gerar apresentação', { token, erro: mensagem })
        await repo.atualizar(sessao.id, { apresentacaoPdfErro: mensagem }).catch((e2) => {
          console.error('[apresentacao/token] falha ao gravar apresentacao_pdf_erro', e2)
        })
        return NextResponse.json({ erro: 'falha ao gerar a apresentação' }, { status: 502 })
      }
      // s3Key null aqui só acontece se o serviço Python respondeu OK mas sem
      // S3_BUCKET configurado do lado dele — mesma situação "sem link ainda"
      // do laudo (ver ResultadoLaudo em lib/server/laudoService.ts).
      if (!s3Key) {
        return NextResponse.json({ erro: 'armazenamento de apresentação não configurado' }, { status: 503 })
      }
      await repo.atualizar(sessao.id, { apresentacaoPdfS3Key: s3Key, apresentacaoPdfErro: null }).catch((e) => {
        console.error('[apresentacao/token] falha ao gravar apresentacao_pdf_s3_key', e)
      })
    }

    const url = await gerarUrlAssinada(s3Key)
    // no-store: mesma razão do link do laudo — a URL é assinada e de curta
    // duração, não pode ficar guardada num proxy/CDN no meio do caminho.
    return NextResponse.redirect(url, { status: 302, headers: { 'Cache-Control': 'no-store' } })
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }): Promise<Response> {
  return criarHandlerApresentacao(criarSupabaseSessionRepo(criarSupabaseAdmin()))(req, ctx)
}
