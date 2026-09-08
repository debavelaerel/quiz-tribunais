import { describe, it, expect } from 'vitest'
import { distribuicao } from './analytics'

describe('distribuicao', () => {
  it('conta ocorrências e calcula percentual sobre o total de valores válidos', () => {
    const d = distribuicao(['tj', 'tj', 'trf', 'tj', 'trt'])
    expect(d).toEqual([
      { valor: 'tj', contagem: 3, pct: 60 },
      { valor: 'trf', contagem: 1, pct: 20 },
      { valor: 'trt', contagem: 1, pct: 20 },
    ])
  })

  it('ordena por contagem desc, desempate alfabético', () => {
    const d = distribuicao(['b', 'a', 'a', 'b'])
    expect(d.map((x) => x.valor)).toEqual(['a', 'b'])
  })

  it('ignora undefined, null e string vazia (perguntas não respondidas)', () => {
    const d = distribuicao(['tj', undefined, null, '', 'tj'])
    expect(d).toEqual([{ valor: 'tj', contagem: 2, pct: 100 }])
  })

  it('array vazio devolve array vazio, sem dividir por zero', () => {
    expect(distribuicao([])).toEqual([])
    expect(distribuicao([undefined, null])).toEqual([])
  })

  it('arredonda pct pra 1 casa decimal', () => {
    const d = distribuicao(['a', 'b', 'c'])
    expect(d.every((x) => x.pct === Math.round(x.pct * 10) / 10)).toBe(true)
    expect(d.reduce((soma, x) => soma + x.pct, 0)).toBeCloseTo(100, 0)
  })
})
