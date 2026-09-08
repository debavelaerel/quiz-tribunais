import type { SessionRepo, FiltroListagem } from './sessionRepo'
import type { QuizSession } from './types'

// PostgREST corta a resposta em `max_rows` (1000 no supabase/config.toml
// deste projeto) sem avisar: um .range() pedindo mais do que isso não dá
// erro, só devolve menos linhas do que foi pedido — enquanto `count`
// continua reportando o total real. Um único listar() com porPagina bem
// grande (ex.: 5000) perderia linha silenciosamente passando de ~1000
// sessões, tanto na exportação CSV quanto nas contagens de analytics. Pagina
// em blocos pequenos o bastante pra nunca esbarrar nesse teto, seja qual for
// o valor configurado.
const TAMANHO_BLOCO = 500

export async function listarTudo(
  repo: SessionRepo,
  evento: string,
  filtroBase: Omit<FiltroListagem, 'pagina' | 'porPagina'>,
  limiteTotal: number,
): Promise<{ sessoes: QuizSession[]; total: number }> {
  const todas: QuizSession[] = []
  let pagina = 1
  let total = 0
  while (todas.length < limiteTotal) {
    const resultado = await repo.listar(evento, { ...filtroBase, pagina, porPagina: TAMANHO_BLOCO })
    total = resultado.total
    todas.push(...resultado.sessoes)
    if (resultado.sessoes.length < TAMANHO_BLOCO) break // não tinha bloco cheio: acabaram as linhas
    pagina += 1
  }
  return { sessoes: todas.slice(0, limiteTotal), total }
}
