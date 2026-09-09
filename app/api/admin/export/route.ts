import { criarSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { criarSupabaseSessionRepo } from '@/lib/server/supabaseSessionRepo'
import { EVENTO } from '@/lib/questions'
import { paraCsv } from '@/lib/server/csv'
import { listarTudo } from '@/lib/server/listarTudo'
import type { FiltroListagem } from '@/lib/server/sessionRepo'

export const runtime = 'nodejs'

// Teto de segurança pra exportação — bem acima do volume esperado de um
// funil comercial pequeno; existe só pra não deixar a rota tentar puxar uma
// tabela sem limite nenhum se o produto crescer muito. listarTudo() pagina
// em blocos por baixo, então isso não esbarra no max_rows do Supabase (ver
// comentário em lib/server/listarTudo.ts).
const LIMITE_EXPORTACAO = 5000

const CABECALHO = ['nome', 'whatsapp', 'email', 'fluxo', 'status', 'acertos', 'total', 'score_geral_pct', 'classe', 'curso_indicado', 'clicou_whatsapp_em', 'iniciado_em', 'concluido_em']

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const statusParam = url.searchParams.get('status')
  const fluxoParam = url.searchParams.get('fluxo')
  const filtro: Omit<FiltroListagem, 'pagina' | 'porPagina'> = {
    status: statusParam === 'em_andamento' || statusParam === 'concluido' ? statusParam : undefined,
    fluxo: fluxoParam === 'padrao' || fluxoParam === 'final' ? fluxoParam : undefined,
    busca: url.searchParams.get('busca')?.trim() || undefined,
  }

  const repo = criarSupabaseSessionRepo(criarSupabaseAdmin())
  const { sessoes } = await listarTudo(repo, EVENTO, filtro, LIMITE_EXPORTACAO)

  const linhas = sessoes.map((s) => [
    s.nome, s.whatsapp, s.email, s.fluxo, s.status,
    s.acertos, s.total, s.scoreGeralPct,
    s.perfilCalculado?.classe ?? '', s.perfilCalculado?.curso ?? '',
    s.whatsappClicadoEm ?? '',
    s.startedAt, s.completedAt,
  ])
  const csv = paraCsv(CABECALHO, linhas)

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
