// Agregação pura pro painel administrativo (perfil de respostas + perfis
// calculados). Não sabe nada de Supabase nem de rótulo de UI — recebe uma
// lista de valores crus (já extraídos pelo call site) e devolve contagem +
// percentual, ordenado do mais frequente pro menos frequente. O mapeamento
// pra rótulo legível (ex.: 'tj' -> 'Tribunal de Justiça (TJ)') é
// responsabilidade de quem chama, com os dicionários de lib/quizContent.ts.

export type ItemDistribuicao = { valor: string; contagem: number; pct: number }

export function distribuicao(valores: (string | undefined | null)[]): ItemDistribuicao[] {
  const validos = valores.filter((v): v is string => v !== undefined && v !== null && v !== '')
  const contagens = new Map<string, number>()
  for (const v of validos) contagens.set(v, (contagens.get(v) ?? 0) + 1)
  const total = validos.length
  return [...contagens.entries()]
    .map(([valor, contagem]) => ({
      valor,
      contagem,
      pct: total > 0 ? Math.round((contagem / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.contagem - a.contagem || a.valor.localeCompare(b.valor))
}

export type TaxaPorValor = { valor: string; total: number; cliques: number; pct: number }

// Cross-tab pra priorização comercial: dentro de cada valor de um campo de
// perfil (ex.: urgência de edital, relação com o VDE), qual % clicou no
// WhatsApp — não é "quantos responderam X" (isso é `distribuicao`), é "de
// quem respondeu X, quantos converteram". Ordena pela taxa, não pelo volume:
// o segmento mais raro pode ser o mais quente.
export function taxaCliquePorValor(itens: { valor: string | undefined | null; clicou: boolean }[]): TaxaPorValor[] {
  const contagens = new Map<string, { total: number; cliques: number }>()
  for (const { valor, clicou } of itens) {
    if (!valor) continue
    const atual = contagens.get(valor) ?? { total: 0, cliques: 0 }
    atual.total += 1
    if (clicou) atual.cliques += 1
    contagens.set(valor, atual)
  }
  return [...contagens.entries()]
    .map(([valor, { total, cliques }]) => ({
      valor,
      total,
      cliques,
      pct: total > 0 ? Math.round((cliques / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.pct - a.pct || b.total - a.total || a.valor.localeCompare(b.valor))
}
