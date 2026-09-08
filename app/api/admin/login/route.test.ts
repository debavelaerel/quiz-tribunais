import { describe, it, expect } from 'vitest'
import { criarHandlerAdminLogin } from './route'
import { verificarSessao, NOME_COOKIE_ADMIN } from '@/lib/server/adminAuth'

function fazerRequisicao(corpo: unknown, ip = `10.0.1.${Math.floor(Math.random() * 250)}`) {
  return new Request('http://localhost/api/admin/login', {
    method: 'POST',
    body: JSON.stringify(corpo),
    headers: { 'x-forwarded-for': ip },
  })
}

const CONFIG = { senhaEsperada: 'senha-correta', segredoSessao: 'segredo-de-teste' }

describe('POST /api/admin/login', () => {
  it('senha certa: 200 e seta o cookie de sessão válido', async () => {
    const handler = criarHandlerAdminLogin(CONFIG)
    const res = await handler(fazerRequisicao({ senha: 'senha-correta' }))
    expect(res.status).toBe(200)
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain(NOME_COOKIE_ADMIN)
    expect(setCookie).toContain('HttpOnly')
    const valor = setCookie.split(';')[0].split('=')[1]
    expect(verificarSessao(valor, CONFIG.segredoSessao)).toBe(true)
  })

  it('senha errada: 401, sem cookie', async () => {
    const handler = criarHandlerAdminLogin(CONFIG)
    const res = await handler(fazerRequisicao({ senha: 'chute' }))
    expect(res.status).toBe(401)
    expect(res.headers.get('set-cookie')).toBeNull()
  })

  it('sem ADMIN_PASSWORD/ADMIN_SESSION_SECRET configurados: 503', async () => {
    const handler = criarHandlerAdminLogin({ senhaEsperada: undefined, segredoSessao: undefined })
    const res = await handler(fazerRequisicao({ senha: 'qualquer' }))
    expect(res.status).toBe(503)
  })

  it('json inválido: 400', async () => {
    const handler = criarHandlerAdminLogin(CONFIG)
    const req = new Request('http://localhost/api/admin/login', {
      method: 'POST', body: '{invalido', headers: { 'x-forwarded-for': '10.0.1.9' },
    })
    const res = await handler(req)
    expect(res.status).toBe(400)
  })

  it('bloqueia depois de várias tentativas do mesmo ip (rate limit)', async () => {
    const handler = criarHandlerAdminLogin(CONFIG)
    const ip = '10.0.2.50'
    let ultimo: Response | undefined
    for (let i = 0; i < 9; i++) {
      ultimo = await handler(fazerRequisicao({ senha: 'chute' }, ip))
    }
    expect(ultimo!.status).toBe(429)
  })
})
