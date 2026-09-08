import { describe, it, expect } from 'vitest'
import {
  montarRespostaResumo,
  calcularAreas,
  calcularResultado,
  respostasCobremTodasPerguntas,
} from './scoring'

describe('montarRespostaResumo', () => {
  it('deriva area e gabarito da pergunta, marca acertou quando bate', () => {
    const resumo = montarRespostaResumo({ num: 1, escolhida: 'C' })
    expect(resumo).toEqual({ num: 1, area: 'Língua Portuguesa', escolhida: 'C', gabarito: 'C', acertou: true })
  })

  it('marca acertou=false quando a escolha não bate com o gabarito', () => {
    const resumo = montarRespostaResumo({ num: 1, escolhida: 'A' })
    expect(resumo.acertou).toBe(false)
  })

  it('lança erro para um num que não existe no banco de perguntas', () => {
    expect(() => montarRespostaResumo({ num: 999, escolhida: 'A' })).toThrow()
  })
})

describe('calcularAreas', () => {
  it('agrupa acertos e total por área, calculando pct', () => {
    const respostas = [
      { num: 1, area: 'Direito Constitucional', escolhida: 'B', gabarito: 'B', acertou: true },
      { num: 2, area: 'Direito Administrativo', escolhida: 'A', gabarito: 'B', acertou: false },
    ]
    const areas = calcularAreas(respostas)
    expect(areas['Direito Constitucional']).toEqual({ acertos: 1, total: 1, pct: 100 })
    expect(areas['Direito Administrativo']).toEqual({ acertos: 0, total: 1, pct: 0 })
  })
})

describe('calcularResultado', () => {
  it('calcula score geral, areas e area prioritaria (menor pct)', () => {
    const respostas = [
      { num: 1, area: 'Direito Constitucional', escolhida: 'B', gabarito: 'B', acertou: true },
      { num: 2, area: 'Direito Administrativo', escolhida: 'A', gabarito: 'B', acertou: false },
    ]
    const resultado = calcularResultado(respostas)
    expect(resultado.acertos).toBe(1)
    expect(resultado.total).toBe(2)
    expect(resultado.scoreGeralPct).toBe(50)
    expect(resultado.areaPrioritaria).toBe('Direito Administrativo')
  })
})

describe('respostasCobremTodasPerguntas', () => {
  it('retorna false quando falta pelo menos uma pergunta', () => {
    expect(respostasCobremTodasPerguntas([{ num: 1, area: 'x', escolhida: 'A', gabarito: 'A', acertou: true }])).toBe(false)
  })

  it('retorna true quando todas as perguntas do banco foram respondidas', () => {
    const respostas = [1, 2, 3, 4].map((num) => ({ num, area: 'x', escolhida: 'A', gabarito: 'A', acertou: true }))
    expect(respostasCobremTodasPerguntas(respostas)).toBe(true)
  })
})
