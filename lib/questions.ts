// Banco de perguntas GRADUADO (o que o servidor usa pra corrigir — ver
// lib/scoring.ts). Fonte única de conteúdo: deriva de TESTE em
// lib/quizContent.ts (mesmas 4 perguntas reais, gabarito oficial FGV/FCC),
// só remapeado pro formato que a correção espera. Nunca reescreva o texto
// aqui separado de lib/quizContent.ts — isso criaria duas fontes de verdade
// para o mesmo gabarito.

import { TESTE } from './quizContent'

export type Option = { letter: string; text: string }
export type Question = {
  num: number
  area: string
  statement: string
  options: Option[]
  correct: string
  comment: string[]
}

export const EVENTO = 'diagnostico-tribunais-comercial'

const LETRAS = ['A', 'B', 'C', 'D', 'E']

export const QUESTIONS: Question[] = TESTE.map((q, i) => ({
  num: i + 1,
  area: q.disc,
  statement: q.enunciado,
  options: q.opts.map((texto, j) => ({ letter: LETRAS[j], text: texto })),
  correct: q.ans,
  comment: [q.note],
}))
