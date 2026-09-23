import { NextResponse } from 'next/server'
import { criarSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { criarSupabaseSessionRepo } from '@/lib/server/supabaseSessionRepo'
import type { SessionRepo } from '@/lib/server/sessionRepo'
import { isUuid } from '@/lib/server/uuid'
import { s3Configurado, urlAssinadaDoDiagnostico } from '@/lib/server/s3'

export const runtime = 'nodejs'

// Link estável pro diagnóstico em PDF de um lead — é esse que entra no campo do
// CRM (Clint), não uma URL do S3 direto. Uma URL assinada do S3 tem teto de
// 7 dias (limite do protocolo, não escolha nossa) — guardar ela direto no
// CRM significa o link morrer numa semana. Essa rota gera uma URL assinada
// NOVA a cada acesso e redireciona, então o link daqui nunca expira.
//
// O token na URL é laudoToken, NÃO session_token: session_token é reescrito
// toda vez que a mesma pessoa retoma o quiz (mesmo e-mail/whatsapp, "Refazer
// o diagnóstico", outro aparelho — ver iniciarSessao em quizService.ts) —
// um link baseado nele quebraria (404) assim que isso acontecesse depois do
// diagnóstico já ter sido gerado e o link já ter ido pro CRM. laudoToken nunca
// muda (ver o comentário em QuizSession.laudoToken). Mesmo nível de
// proteção que o link de resultado público já usa: não é uma segunda senha,
// é "quem tem o link vê o diagnóstico dessa pessoa".
export function criarHandlerDiagnostico(
  repo: SessionRepo,
  gerarUrlAssinada: (s3Key: string) => Promise<string> = urlAssinadaDoDiagnostico,
  s3Ok: () => boolean = s3Configurado,
) {
  return async function handler(_req: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
    const { token } = await params
    if (!isUuid(token)) return NextResponse.json({ erro: 'não encontrado' }, { status: 404 })

    const sessao = await repo.buscarPorLaudoToken(token)
    if (!sessao || sessao.status !== 'concluido') {
      return NextResponse.json({ erro: 'não encontrado' }, { status: 404 })
    }

    // Antes de olhar a chave: sem isso, S3 nunca configurado (feature ainda
    // não ligada) e "ainda gerando" ficam indistinguíveis — os dois têm
    // chave e erro nulos — e o CRM ficaria recebendo 425 (tenta de novo)
    // pra sempre num caso que na verdade nunca vai se resolver sozinho.
    if (!s3Ok()) {
      return NextResponse.json({ erro: 'armazenamento de diagnóstico não configurado' }, { status: 503 })
    }

    if (!sessao.laudoPdfS3Key) {
      // A geração roda em background na conclusão (ver
      // lib/server/diagnosticoPdfBackground.ts) — se laudo_pdf_erro tem algo, essa
      // tentativa já falhou de vez; sem ele, ainda pode estar em andamento.
      if (sessao.laudoPdfErro) {
        return NextResponse.json({ erro: 'falha ao gerar o diagnóstico' }, { status: 502 })
      }
      return NextResponse.json({ erro: 'diagnóstico ainda sendo gerado, tenta de novo em instantes' }, { status: 425 })
    }

    const url = await gerarUrlAssinada(sessao.laudoPdfS3Key)
    // no-store: a URL é assinada e de curta duração — nunca deixar um proxy
    // ou CDN no meio do caminho guardar essa resposta e servir de novo uma
    // URL já expirada (ou pior, servir a URL assinada de um lead pra outro).
    return NextResponse.redirect(url, { status: 302, headers: { 'Cache-Control': 'no-store' } })
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }): Promise<Response> {
  return criarHandlerDiagnostico(criarSupabaseSessionRepo(criarSupabaseAdmin()))(req, ctx)
}
