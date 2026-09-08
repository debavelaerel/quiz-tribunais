import { describe, it, expect } from 'vitest'
import { destinoSeguro } from './page'

describe('destinoSeguro', () => {
  it('sem proximo: vai pra /admin/leads', () => {
    expect(destinoSeguro(null)).toBe('/admin/leads')
  })

  it('path interno normal: aceita', () => {
    expect(destinoSeguro('/admin/analytics')).toBe('/admin/analytics')
    expect(destinoSeguro('/admin/leads/aaaaaaaa-1111-1111-1111-111111111111')).toBe('/admin/leads/aaaaaaaa-1111-1111-1111-111111111111')
  })

  it('recusa URL absoluta (http/https) — open redirect', () => {
    expect(destinoSeguro('https://look-alike.com/admin/login')).toBe('/admin/leads')
    expect(destinoSeguro('http://evil.com')).toBe('/admin/leads')
  })

  it('recusa "//host" (protocol-relative) — open redirect', () => {
    expect(destinoSeguro('//evil.com')).toBe('/admin/leads')
  })

  it('recusa barra invertida', () => {
    expect(destinoSeguro('/\\evil.com')).toBe('/admin/leads')
  })

  it('recusa path que não começa com barra', () => {
    expect(destinoSeguro('admin/leads')).toBe('/admin/leads')
  })
})
