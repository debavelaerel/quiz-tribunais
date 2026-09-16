import { NextResponse } from 'next/server'
import { criarSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { criarSupabaseSessionRepo } from '@/lib/server/supabaseSessionRepo'
import { nivelTeste } from '@/lib/perfil'
import { gerarPdfLaudo } from '@/lib/server/pdf'
import { isUuid } from '@/lib/server/uuid'

export const runtime = 'nodejs'

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await params
  if (!isUuid(token)) return NextResponse.json({ erro: 'não encontrado' }, { status: 404 })

  const repo = criarSupabaseSessionRepo(criarSupabaseAdmin())
  const sessao = await repo.buscarPorToken(token)
  if (!sessao || sessao.status !== 'concluido') return NextResponse.json({ erro: 'não encontrado' }, { status: 404 })

  const nivel = sessao.acertos !== null ? nivelTeste(sessao.acertos) : ''
  const pdf = await gerarPdfLaudo(sessao, nivel)

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="laudo-${sessao.nome.replace(/\s+/g, '-').toLowerCase()}.pdf"`,
    },
  })
}
