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

export type EtapaFunil = { etapa: string; total: number; pct: number }

type FlagsFunil = { perfilCompleto: boolean; testeRespondido: boolean; concluida: boolean; clicouWhatsapp: boolean }

// Funil honesto: não existe tracking de visita anônima nesse produto, então
// a primeira etapa já é "sessão criada" (exige nome+whatsapp+email), não
// "abriu a página". pct é sempre relativo a essa primeira etapa, nunca à
// etapa anterior — evita fabricar "100% de conversão" entre estágios que
// quase sempre andam juntos (ex.: quem termina o perfil normalmente também
// responde o teste). Ordem fixa, não ordenada por volume: é uma jornada.
export function funilConversao(sessoes: FlagsFunil[]): EtapaFunil[] {
  const total = sessoes.length
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 1000) / 10 : 0)
  const etapas: { etapa: string; total: number }[] = [
    { etapa: 'Sessões iniciadas', total },
    { etapa: 'Terminou o perfil', total: sessoes.filter((s) => s.perfilCompleto).length },
    { etapa: 'Respondeu o teste', total: sessoes.filter((s) => s.testeRespondido).length },
    { etapa: 'Concluiu e viu o resultado', total: sessoes.filter((s) => s.concluida).length },
    { etapa: 'Clicou no WhatsApp', total: sessoes.filter((s) => s.clicouWhatsapp).length },
  ]
  return etapas.map((e) => ({ ...e, pct: pct(e.total) }))
}

export type ContagemPorDia = { data: string; contagem: number }

// Agrupa por dia (recorta a hora do ISO) pra alimentar tendência — não
// preenche dias sem sessão com zero porque o call site sabe melhor o
// intervalo que quer mostrar; aqui só agrega o que existe.
export function sessoesPorDia(datasIso: string[]): ContagemPorDia[] {
  const contagens = new Map<string, number>()
  for (const iso of datasIso) {
    const dia = iso.slice(0, 10)
    contagens.set(dia, (contagens.get(dia) ?? 0) + 1)
  }
  return [...contagens.entries()]
    .map(([data, contagem]) => ({ data, contagem }))
    .sort((a, b) => a.data.localeCompare(b.data))
}

// Tempo médio (minutos) entre início e conclusão — só sessões concluídas
// entram na média; sem nenhuma, devolve null em vez de dividir por zero
// (call site decide como exibir "sem dado", não fabrica um zero enganoso).
export function mediaMinutosConclusao(sessoes: { startedAt: string; completedAt: string | null }[]): number | null {
  const duracoes = sessoes
    .filter((s): s is { startedAt: string; completedAt: string } => s.completedAt !== null)
    .map((s) => (new Date(s.completedAt).getTime() - new Date(s.startedAt).getTime()) / 60000)
  if (duracoes.length === 0) return null
  return Math.round((duracoes.reduce((a, b) => a + b, 0) / duracoes.length) * 10) / 10
}

export type ResumoFluxo = { fluxo: string; sessoes: number; taxaConclusaoPct: number; taxaCliquePct: number; mediaAcertos: number | null }

// Resumo comparativo por fluxo (padrão vs. final) — recebe a lista de
// fluxos a comparar em vez de derivá-la dos dados, pra sempre mostrar as
// duas colunas lado a lado (mesmo quando um fluxo ainda não tem sessão
// nenhuma) em vez de um fluxo simplesmente sumir do comparativo.
export function resumoPorFluxo(
  itens: { fluxo: string; concluida: boolean; clicou: boolean; acertos: number | null }[],
  fluxos: string[],
): ResumoFluxo[] {
  return fluxos.map((fluxo) => {
    const lista = itens.filter((i) => i.fluxo === fluxo)
    const total = lista.length
    const comAcerto = lista.filter((i) => i.acertos !== null)
    return {
      fluxo,
      sessoes: total,
      taxaConclusaoPct: total > 0 ? Math.round((lista.filter((i) => i.concluida).length / total) * 1000) / 10 : 0,
      taxaCliquePct: total > 0 ? Math.round((lista.filter((i) => i.clicou).length / total) * 1000) / 10 : 0,
      mediaAcertos: comAcerto.length > 0
        ? Math.round((comAcerto.reduce((soma, i) => soma + (i.acertos ?? 0), 0) / comAcerto.length) * 10) / 10
        : null,
    }
  })
}
