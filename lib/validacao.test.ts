import { describe, it, expect } from 'vitest'
import { nomeValido, emailValido, whatsappValido } from './validacao'

describe('nomeValido', () => {
  it('nome e sobrenome: válido', () => {
    expect(nomeValido('Maria Silva')).toBe(true)
    expect(nomeValido('  Maria   Silva  ')).toBe(true)
  })
  it('nome de três ou mais palavras: válido', () => {
    expect(nomeValido('Maria da Silva')).toBe(true)
  })
  it('só um nome: inválido', () => {
    expect(nomeValido('Maria')).toBe(false)
  })
  it('vazio ou só espaço: inválido', () => {
    expect(nomeValido('')).toBe(false)
    expect(nomeValido('   ')).toBe(false)
  })
  it('nome gigante (>200 chars): inválido', () => {
    expect(nomeValido(`${'A '.repeat(150)}B`)).toBe(false)
  })
  it('nome de exatamente 200 chars: ainda válido', () => {
    const nome = `Maria ${'A'.repeat(200 - 'Maria '.length)}`
    expect(nome).toHaveLength(200)
    expect(nomeValido(nome)).toBe(true)
  })
})

describe('emailValido', () => {
  it('formato padrão: válido', () => {
    expect(emailValido('maria@exemplo.com')).toBe(true)
    expect(emailValido('maria.silva+teste@sub.exemplo.com.br')).toBe(true)
  })
  it('sem @: inválido', () => {
    expect(emailValido('mariaexemplo.com')).toBe(false)
  })
  it('sem domínio/tld: inválido', () => {
    expect(emailValido('maria@exemplo')).toBe(false)
  })
  it('tld de 1 letra: inválido', () => {
    expect(emailValido('maria@exemplo.c')).toBe(false)
  })
  it('com espaço: inválido', () => {
    expect(emailValido('maria @exemplo.com')).toBe(false)
  })
  it('gigante (>254 chars): inválido mesmo com formato correto', () => {
    const localPart = 'a'.repeat(250)
    expect(emailValido(`${localPart}@x.com`)).toBe(false)
  })
})

describe('whatsappValido', () => {
  it('11 dígitos (DDD + celular com 9º dígito): válido', () => {
    expect(whatsappValido('11987654321')).toBe(true)
  })
  it('formatado com parênteses/espaço/traço: válido, conta só os dígitos', () => {
    expect(whatsappValido('(11) 98765-4321')).toBe(true)
  })
  it('com +55 na frente (13 dígitos): válido, ignora o código do país', () => {
    expect(whatsappValido('+55 11 98765-4321')).toBe(true)
  })
  it('10 dígitos (sem o 9º dígito): inválido', () => {
    expect(whatsappValido('1187654321')).toBe(false)
  })
  it('menos de 10 dígitos: inválido', () => {
    expect(whatsappValido('123')).toBe(false)
  })
  it('mais de 11 dígitos sem ser +55: inválido', () => {
    expect(whatsappValido('119876543210')).toBe(false)
  })
})
