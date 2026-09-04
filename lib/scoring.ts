import { QUESTIONS } from './questions'

export type RespostaEntrada = { num: number; escolhida: string }
export type RespostaResumo = { num: number; area: string; escolhida: string; gabarito: string; acertou: boolean }
export type AreaResumo = { acertos: number; total: number; pct: number }

export function montarRespostaResumo(entrada: RespostaEntrada): RespostaResumo {
  const questao = QUESTIONS.find((q) => q.num === entrada.num)
  if (!questao) throw new Error(`pergunta ${entrada.num} não existe`)
  return {
    num: questao.num,
    area: questao.area,
    escolhida: entrada.escolhida,
    gabarito: questao.correct,
    acertou: entrada.escolhida === questao.correct,
  }
}

export function calcularAreas(respostas: RespostaResumo[]): Record<string, AreaResumo> {
  const areas: Record<string, AreaResumo> = {}
  for (const r of respostas) {
    if (!areas[r.area]) areas[r.area] = { acertos: 0, total: 0, pct: 0 }
    areas[r.area].total += 1
    if (r.acertou) areas[r.area].acertos += 1
  }
  for (const area of Object.keys(areas)) {
    const a = areas[area]
    a.pct = a.total === 0 ? 0 : Math.round((a.acertos / a.total) * 100)
  }
  return areas
}

export function calcularAreaPrioritaria(areas: Record<string, AreaResumo>): string | null {
  const entradas = Object.entries(areas)
  if (entradas.length === 0) return null
  return entradas.sort((a, b) => a[1].pct - b[1].pct)[0][0]
}

export function calcularResultado(respostas: RespostaResumo[]) {
  const acertos = respostas.filter((r) => r.acertou).length
  const total = respostas.length
  const scoreGeralPct = total === 0 ? 0 : Math.round((acertos / total) * 100)
  const areas = calcularAreas(respostas)
  const areaPrioritaria = calcularAreaPrioritaria(areas)
  return { acertos, total, scoreGeralPct, areas, areaPrioritaria }
}

export function respostasCobremTodasPerguntas(respostas: RespostaResumo[]): boolean {
  const numsRespondidos = new Set(respostas.map((r) => r.num))
  return QUESTIONS.every((q) => numsRespondidos.has(q.num))
}
