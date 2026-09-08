import { describe, it, expect } from 'vitest'
import { senhaConfere, assinarSessao, verificarSessao } from './adminAuth'

describe('senhaConfere', () => {
  it('true pra senha idêntica', () => {
    expect(senhaConfere('segredo123', 'segredo123')).toBe(true)
  })
  it('false pra senha diferente', () => {
    expect(senhaConfere('errada', 'segredo123')).toBe(false)
  })
  it('false pra tamanhos diferentes (sem lançar)', () => {
    expect(senhaConfere('a', 'segredo123')).toBe(false)
  })
})

describe('assinarSessao / verificarSessao', () => {
  const segredo = 'segredo-de-teste-bem-longo'

  it('cookie recém-assinado é válido', () => {
    const cookie = assinarSessao(segredo)
    expect(verificarSessao(cookie, segredo)).toBe(true)
  })

  it('cookie expira depois de 7 dias', () => {
    const agora = Date.now()
    const cookie = assinarSessao(segredo, agora)
    const seisDiasDepois = agora + 6 * 24 * 60 * 60 * 1000
    const oitoDiasDepois = agora + 8 * 24 * 60 * 60 * 1000
    expect(verificarSessao(cookie, segredo, seisDiasDepois)).toBe(true)
    expect(verificarSessao(cookie, segredo, oitoDiasDepois)).toBe(false)
  })

  it('rejeita cookie assinado com outro segredo', () => {
    const cookie = assinarSessao('outro-segredo-qualquer')
    expect(verificarSessao(cookie, segredo)).toBe(false)
  })

  it('rejeita payload adulterado (expiraEm trocado sem re-assinar)', () => {
    const cookie = assinarSessao(segredo, Date.now())
    const [, assinatura] = cookie.split('.')
    const adulterado = `${Date.now() + 999 * 24 * 60 * 60 * 1000}.${assinatura}`
    expect(verificarSessao(adulterado, segredo)).toBe(false)
  })

  it('rejeita cookie ausente, vazio ou malformado', () => {
    expect(verificarSessao(undefined, segredo)).toBe(false)
    expect(verificarSessao(null, segredo)).toBe(false)
    expect(verificarSessao('', segredo)).toBe(false)
    expect(verificarSessao('sem-ponto', segredo)).toBe(false)
    expect(verificarSessao('.', segredo)).toBe(false)
  })
})
