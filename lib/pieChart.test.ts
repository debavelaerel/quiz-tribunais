import { describe, it, expect } from 'vitest'
import { paraFatias } from './pieChart'

describe('paraFatias', () => {
  it('array vazio devolve array vazio', () => {
    expect(paraFatias([], 50)).toEqual([])
  })

  it('uma única fatia de 100% gera path fechado sem passar pelo centro', () => {
    const [fatia] = paraFatias([{ valor: 'tj', pct: 100 }], 50)
    expect(fatia.anguloMedio).toBe(180)
    expect(fatia.path).not.toContain('50 50 L') // não é o padrão "centro -> borda" das fatias parciais
    expect(fatia.path.startsWith('M')).toBe(true)
  })

  it('duas fatias de 50% cobrem 0-180 e 180-360 graus', () => {
    const fatias = paraFatias([{ valor: 'a', pct: 50 }, { valor: 'b', pct: 50 }], 50)
    expect(fatias[0].anguloMedio).toBe(90)
    expect(fatias[1].anguloMedio).toBe(270)
  })

  it('cada path começa no centro (fatia parcial) e termina com Z', () => {
    const [fatia] = paraFatias([{ valor: 'a', pct: 30 }], 40, 40, 40)
    expect(fatia.path.startsWith('M 40 40 L')).toBe(true)
    expect(fatia.path.endsWith('Z')).toBe(true)
  })

  it('fatia com vão > 180° usa o large-arc-flag = 1', () => {
    const [fatia] = paraFatias([{ valor: 'maioria', pct: 70 }], 50)
    expect(fatia.path).toContain(' 1 1 ')
  })

  it('fatia com vão <= 180° usa o large-arc-flag = 0', () => {
    const [fatia] = paraFatias([{ valor: 'minoria', pct: 30 }], 50)
    expect(fatia.path).toContain(' 0 1 ')
  })
})
