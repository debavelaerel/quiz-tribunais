import { describe, it, expect } from 'vitest'
import { normalizeEmail, normalizeWhatsapp } from './normalize'

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  Maria@Example.COM  ')).toBe('maria@example.com')
  })
})

describe('normalizeWhatsapp', () => {
  it('adds 55 prefix to an 11-digit number without DDI', () => {
    expect(normalizeWhatsapp('(11) 91234-5678')).toBe('5511912345678')
  })

  it('adds 55 prefix to a 10-digit number without DDI', () => {
    expect(normalizeWhatsapp('11 3123-4567')).toBe('551131234567')
  })

  it('keeps a number that already has the 55 prefix', () => {
    expect(normalizeWhatsapp('+55 11 91234-5678')).toBe('5511912345678')
  })

  it('strips all non-digit characters first', () => {
    expect(normalizeWhatsapp('55-(11)-91234.5678')).toBe('5511912345678')
  })
})
