import { NextResponse } from 'next/server'
import { criarSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { criarSupabaseSessionRepo } from '@/lib/server/supabaseSessionRepo'
import { nivelTeste } from '@/lib/perfil'
import { gerarPdfLaudo } from '@/lib/server/pdf'
import { isUuid } from '@/lib/server/uuid'

export const runtime = 'nodejs'
// Cold start do Chromium (@sparticuz/chromium) + render do laudo pode chegar
// perto do timeout padrão das funções serverless da Vercel.
export const maxDuration = 60

// `nome` só passa por nomeValido() (só exige 2+ palavras) — aspas, barras
// invertidas ou outros caracteres arbitrários chegam aqui sem filtro e
// quebrariam o parâmetro entre aspas do header Content-Disposition. Reduz
// a só [a-z0-9-] pra deixar o header sempre seguro de montar.
function nomeParaArquivo(nome: string): string {
  const limpo = nome
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
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

  const nivel = sessao.acertos !== null ? nivelTeste(sessao.acertos) : ''

  let pdf: Buffer
  try {
    pdf = await gerarPdfLaudo(sessao, nivel)
  } catch (e) {
    console.error('[admin/leads/pdf] erro inesperado ao gerar o PDF', e)
    return NextResponse.json({ erro: 'falha ao gerar o PDF' }, { status: 500 })
  }

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="laudo-${nomeParaArquivo(sessao.nome)}.pdf"`,
    },
  })
}
