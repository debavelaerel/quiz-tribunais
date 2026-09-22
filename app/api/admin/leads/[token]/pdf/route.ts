import { NextResponse } from 'next/server'
import { criarSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { criarSupabaseSessionRepo } from '@/lib/server/supabaseSessionRepo'
import { nivelTeste } from '@/lib/perfil'
import { gerarLaudoPdf, validarSessaoParaLaudo, LaudoIndisponivel } from '@/lib/server/laudoService'
import { isUuid } from '@/lib/server/uuid'

export const runtime = 'nodejs'
// O serviço de PDF em Python (services/laudo-pdf) é quem faz o trabalho
// pesado (Chromium) agora — essa rota só valida, chama por HTTP e repassa
// o PDF. maxDuration segue generoso porque o timeout do fetch pro serviço
// (55s, ver lib/server/laudoService.ts) precisa caber dentro dele.
export const maxDuration = 60

function nomeParaArquivo(nome: string): string {
  const limpo = nome
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return limpo || 'lead'
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await params
  if (!isUuid(token)) return NextResponse.json({ erro: 'não encontrado' }, { status: 404 })

  const repo = criarSupabaseSessionRepo(criarSupabaseAdmin())
  const sessao = await repo.buscarPorToken(token)
  if (!sessao || sessao.status !== 'concluido') return NextResponse.json({ erro: 'não encontrado' }, { status: 404 })

  // Pela interface normal do quiz uma sessão concluída sempre tem o perfil
  // completo (cada pergunta trava o avanço até responder) — isso é só rede
  // de segurança pro caminho teórico de uma chamada direta à API bypassando
  // a UI. Confere aqui, com mensagem específica, em vez de deixar o 422
  // genérico do serviço em Python chegar até o admin sem contexto.
  const problemas = validarSessaoParaLaudo(sessao)
  if (problemas.length > 0) {
    console.error('[admin/leads/pdf] sessão incompleta pra gerar laudo', { token, problemas })
    return NextResponse.json({ erro: 'sessão incompleta', detalhes: problemas }, { status: 422 })
  }

  const nivel = sessao.acertos !== null ? nivelTeste(sessao.acertos) : ''

  let pdf: Buffer
  let s3Key: string | null
  try {
    ;({ pdf, s3Key } = await gerarLaudoPdf(sessao, nivel, { salvarS3: true }))
  } catch (e) {
    const status = e instanceof LaudoIndisponivel ? 503 : 500
    console.error('[admin/leads/pdf] erro inesperado ao gerar o PDF', e)
    return NextResponse.json({ erro: 'falha ao gerar o PDF' }, { status })
  }

  // Recuperação manual pro caso de app/api/quiz/finish/route.ts ter tentado
  // gerar em background e falhado (ou nunca ter rodado): baixar aqui também
  // preenche laudo_pdf_s3_key, então o link estável (/api/laudo/[token])
  // passa a funcionar sem precisar de nenhum acesso direto ao banco. Não
  // trava a resposta por isso — se a gravação falhar, o admin já tem o PDF
  // que veio pra baixar; só perde a chance de backfill dessa vez.
  if (s3Key) {
    await repo.atualizar(sessao.id, { laudoPdfS3Key: s3Key, laudoPdfErro: null }).catch((e) => {
      console.error('[admin/leads/pdf] falha ao gravar laudo_pdf_s3_key', e)
    })
  }

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="laudo-${nomeParaArquivo(sessao.nome)}.pdf"`,
    },
  })
}
