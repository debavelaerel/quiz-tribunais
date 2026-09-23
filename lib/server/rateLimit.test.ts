import { describe, it, expect } from 'vitest'
import { permitirRequisicao, _tamanhoInternoParaTeste } from './rateLimit'

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

  it('varre e remove chaves expiradas periodicamente (não cresce pra sempre)', async () => {
    // Janela de 1ms: cada chave expira quase na hora. 700 chaves distintas
    // pra garantir que passa do INTERVALO_LIMPEZA (500) e dispara a
    // varredura pelo menos uma vez, mesmo com chamadas de outros testes
    // já tendo avançado o contador compartilhado do módulo.
    for (let i = 0; i < 700; i++) {
      permitirRequisicao(`limpeza-${i}-${Math.random()}`, 1, 1)
    }
    await new Promise((r) => setTimeout(r, 20)) // garante que todas passaram do resetEm
    // Mais uma leva pra cruzar o próximo múltiplo de INTERVALO_LIMPEZA e
    // disparar a varredura de verdade.
    for (let i = 0; i < 500; i++) {
      permitirRequisicao(`gatilho-${i}-${Math.random()}`, 1, 60_000)
    }
    // Bem menor que as 1200 chaves criadas nesse teste (+ as de outros
    // testes do arquivo) — prova que a limpeza removeu as expiradas, não
    // que o Map ficou vazio (as 500 "gatilho-*" ainda estão dentro da janela).
    expect(_tamanhoInternoParaTeste()).toBeLessThan(700)
  })
})
