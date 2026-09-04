import { describe, it, expect } from 'vitest'
import { permitirRequisicao } from './rateLimit'

describe('permitirRequisicao', () => {
  it('permite até o limite dentro da janela', () => {
    const chave = `teste-${Math.random()}`
    expect(permitirRequisicao(chave, 3, 60_000)).toBe(true)
    expect(permitirRequisicao(chave, 3, 60_000)).toBe(true)
    expect(permitirRequisicao(chave, 3, 60_000)).toBe(true)
  })

  it('recusa a partir da requisição que excede o limite', () => {
    const chave = `teste-${Math.random()}`
    permitirRequisicao(chave, 2, 60_000)
    permitirRequisicao(chave, 2, 60_000)
    expect(permitirRequisicao(chave, 2, 60_000)).toBe(false)
  })

  it('chaves diferentes têm contadores independentes', () => {
    const a = `teste-a-${Math.random()}`
    const b = `teste-b-${Math.random()}`
    permitirRequisicao(a, 1, 60_000)
    expect(permitirRequisicao(b, 1, 60_000)).toBe(true)
  })
})
