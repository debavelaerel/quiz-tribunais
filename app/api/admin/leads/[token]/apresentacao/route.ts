import { NextResponse } from 'next/server'
import { criarSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { criarSupabaseSessionRepo } from '@/lib/server/supabaseSessionRepo'
import { nivelTeste } from '@/lib/perfil'
import { gerarApresentacaoPdf, validarSessaoParaDiagnostico, DiagnosticoIndisponivel } from '@/lib/server/diagnosticoService'
import { isUuid } from '@/lib/server/uuid'

export const runtime = 'nodejs'
// Mesmo serviço Python do diagnóstico, mesma justificativa de maxDuration — ver
// app/api/admin/leads/[token]/pdf/route.ts.
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

  // Mesma validação do diagnóstico — a apresentação usa o mesmo perfil da sessão
  // (ver lib/server/diagnosticoService.ts::validarSessaoParaDiagnostico).
  const problemas = validarSessaoParaDiagnostico(sessao)
  if (problemas.length > 0) {
    console.error('[admin/leads/apresentacao] sessão incompleta pra gerar apresentação', { token, problemas })
    return NextResponse.json({ erro: 'sessão incompleta', detalhes: problemas }, { status: 422 })
  }

  const nivel = sessao.acertos !== null ? nivelTeste(sessao.acertos) : ''

  let pdf: Buffer
  let s3Key: string | null
  try {
    ;({ pdf, s3Key } = await gerarApresentacaoPdf(sessao, nivel, { salvarS3: true }))
  } catch (e) {
    const status = e instanceof DiagnosticoIndisponivel ? 503 : 500
    console.error('[admin/leads/apresentacao] erro inesperado ao gerar o PDF', e)
    return NextResponse.json({ erro: 'falha ao gerar o PDF' }, { status })
  }

  // Ao contrário do diagnóstico, a apresentação não tem geração em background —
  // esta chamada sob demanda é sempre a primeira vez que a chave do S3 é
  // conhecida. Mesma lógica de não travar a resposta por causa disso.
  if (s3Key) {
    await repo.atualizar(sessao.id, { apresentacaoPdfS3Key: s3Key, apresentacaoPdfErro: null }).catch((e) => {
      console.error('[admin/leads/apresentacao] falha ao gravar apresentacao_pdf_s3_key', e)
    })
  }

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="apresentacao-${nomeParaArquivo(sessao.nome)}.pdf"`,
    },
  })
}
