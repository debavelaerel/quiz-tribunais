// app/api/quiz/start/route.test.ts
import { describe, it, expect } from 'vitest'
import { criarHandlerStart } from './route'
import { criarFakeSessionRepo } from '@/lib/server/testHelpers/fakeSessionRepo'

function fazerRequisicao(corpo: unknown) {
  return new Request('http://localhost/api/quiz/start', {
    method: 'POST',
    body: JSON.stringify(corpo),
    headers: { 'x-forwarded-for': `10.0.0.${Math.floor(Math.random() * 250)}` },
  })
}

describe('POST /api/quiz/start', () => {
  it('cria sessão nova com corpo válido', async () => {
    const handler = criarHandlerStart(criarFakeSessionRepo())
    const res = await handler(fazerRequisicao({
      nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', session_token: 'aaaaaaaa-1111-1111-1111-111111111111',
    }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.retomando).toBe(false)
  })

  it('recusa email inválido com 422', async () => {
    const handler = criarHandlerStart(criarFakeSessionRepo())
    const res = await handler(fazerRequisicao({
      nome: 'Maria', whatsapp: '11987654321', email: 'invalido', session_token: 'aaaaaaaa-1111-1111-1111-111111111111',
    }))
    expect(res.status).toBe(422)
  })

  it('recusa whatsapp com poucos dígitos com 422', async () => {
    const handler = criarHandlerStart(criarFakeSessionRepo())
    const res = await handler(fazerRequisicao({
      nome: 'Maria', whatsapp: '123', email: 'maria@x.com', session_token: 'aaaaaaaa-1111-1111-1111-111111111111',
    }))
    expect(res.status).toBe(422)
  })

  it('devolve o corpo em snake_case (session_token / respostas_salvas)', async () => {
    const handler = criarHandlerStart(criarFakeSessionRepo())
    const res = await handler(fazerRequisicao({
      nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', session_token: 'aaaaaaaa-1111-1111-1111-111111111111',
    }))
    const json = await res.json()
    expect(json.session_token).toBe('aaaaaaaa-1111-1111-1111-111111111111')
    expect(json.respostas_salvas).toEqual([])
  })

  it('recusa session_token fora do formato uuid com 422', async () => {
    const handler = criarHandlerStart(criarFakeSessionRepo())
    const res = await handler(fazerRequisicao({
      nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', session_token: 'nao-e-uuid',
    }))
    expect(res.status).toBe(422)
  })

  it('recusa nome vazio com 422', async () => {
    const handler = criarHandlerStart(criarFakeSessionRepo())
    const res = await handler(fazerRequisicao({
      nome: '  ', whatsapp: '11987654321', email: 'maria@x.com', session_token: 'aaaaaaaa-1111-1111-1111-111111111111',
    }))
    expect(res.status).toBe(422)
  })
})
