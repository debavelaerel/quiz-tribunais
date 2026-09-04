import { describe, it, expect, beforeEach } from 'vitest'
import { carregarEstado, salvarEstado, limparEstado, criarNovoSessionToken } from './storage'

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('retorna null quando não há estado salvo', () => {
    expect(carregarEstado()).toBeNull()
  })

  it('salva e recupera o estado', () => {
    const estado = { sessionToken: 'tok-1', nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com' }
    salvarEstado(estado)
    expect(carregarEstado()).toEqual(estado)
  })

  it('limpa o estado', () => {
    salvarEstado({ sessionToken: 'tok-1', nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com' })
    limparEstado()
    expect(carregarEstado()).toBeNull()
  })

  it('gera um session token no formato uuid', () => {
    const token = criarNovoSessionToken()
    expect(token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })
})
