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
