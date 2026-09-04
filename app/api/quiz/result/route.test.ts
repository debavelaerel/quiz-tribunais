// app/api/quiz/result/route.test.ts
import { describe, it, expect } from 'vitest'
import { criarHandlerResult } from './route'
import { criarHandlerStart } from '../start/route'
import { criarHandlerAnswer } from '../answer/route'
import { criarHandlerFinish } from '../finish/route'
import { criarFakeSessionRepo } from '@/lib/server/testHelpers/fakeSessionRepo'

const TOKEN = 'aaaaaaaa-1111-1111-1111-111111111111'

function ip() {
  return `10.0.4.${Math.floor(Math.random() * 250)}`
}

describe('GET /api/quiz/result', () => {
  it('retorna 404 quando a sessão não existe', async () => {
    const repo = criarFakeSessionRepo()
    const handler = criarHandlerResult(repo)
    const res = await handler(new Request('http://localhost/api/quiz/result?session_token=bbbbbbbb-2222-2222-2222-222222222222'))
    expect(res.status).toBe(404)
  })

  it('retorna 404 para session_token fora do formato uuid (sem estourar 500 no banco)', async () => {
    const repo = criarFakeSessionRepo()
    const handler = criarHandlerResult(repo)
    const res = await handler(new Request('http://localhost/api/quiz/result?session_token=nao-e-uuid'))
    expect(res.status).toBe(404)
  })

  it('retorna 404 quando a sessão existe mas não foi concluída', async () => {
    const repo = criarFakeSessionRepo()
    const start = criarHandlerStart(repo)
    await start(new Request('http://localhost/api/quiz/start', {
      method: 'POST',
      body: JSON.stringify({ nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', session_token: TOKEN }),
      headers: { 'x-forwarded-for': ip() },
    }))
    const handler = criarHandlerResult(repo)
    const res = await handler(new Request(`http://localhost/api/quiz/result?session_token=${TOKEN}`))
    expect(res.status).toBe(404)
  })

  it('retorna o resultado quando a sessão está concluída', async () => {
    const repo = criarFakeSessionRepo()
    const start = criarHandlerStart(repo)
    await start(new Request('http://localhost/api/quiz/start', {
      method: 'POST',
      body: JSON.stringify({ nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', session_token: TOKEN }),
      headers: { 'x-forwarded-for': ip() },
    }))
    const answer = criarHandlerAnswer(repo)
    for (const num of [1, 2, 3]) {
      await answer(new Request('http://localhost/api/quiz/answer', {
        method: 'POST',
        body: JSON.stringify({ session_token: TOKEN, num, escolhida: 'B' }),
        headers: { 'x-forwarded-for': ip() },
      }))
    }
    await criarHandlerFinish(repo)(new Request('http://localhost/api/quiz/finish', {
      method: 'POST',
      body: JSON.stringify({ session_token: TOKEN }),
      headers: { 'x-forwarded-for': ip() },
    }))

    const handler = criarHandlerResult(repo)
    const res = await handler(new Request(`http://localhost/api/quiz/result?session_token=${TOKEN}`))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.score_geral_pct).toBe(100)
  })
})
