import { describe, it, expect } from 'vitest'
import { formatarWhatsapp } from './mascara'

describe('formatarWhatsapp', () => {
  it('vazio continua vazio', () => {
    expect(formatarWhatsapp('')).toBe('')
  })
  it('constrói o parêntese incrementalmente até 2 dígitos', () => {
    expect(formatarWhatsapp('8')).toBe('(8')
    expect(formatarWhatsapp('85')).toBe('(85')
  })
  it('abre o segundo grupo depois do 2º dígito', () => {
    expect(formatarWhatsapp('859')).toBe('(85) 9')
    expect(formatarWhatsapp('8599682')).toBe('(85) 99682')
  })
  it('abre o traço depois do 7º dígito, formato completo', () => {
    expect(formatarWhatsapp('85996826067')).toBe('(85) 99682-6067')
  })
  it('ignora caracteres não numéricos já presentes no valor', () => {
    expect(formatarWhatsapp('(85) 99682-6067')).toBe('(85) 99682-6067')
  })
  it('trunca em 11 dígitos, ignora dígitos extras', () => {
    expect(formatarWhatsapp('859968260679999')).toBe('(85) 99682-6067')
  })
})
