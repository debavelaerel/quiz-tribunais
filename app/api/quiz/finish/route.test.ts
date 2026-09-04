// app/api/quiz/finish/route.test.ts
import { describe, it, expect } from 'vitest'
import { criarHandlerFinish } from './route'
import { criarHandlerStart } from '../start/route'
import { criarHandlerAnswer } from '../answer/route'
import { criarFakeSessionRepo } from '@/lib/server/testHelpers/fakeSessionRepo'

const TOKEN = 'aaaaaaaa-1111-1111-1111-111111111111'

function ip() {
  return `10.0.3.${Math.floor(Math.random() * 250)}`
}

async function iniciarEResponderTudo(repo: ReturnType<typeof criarFakeSessionRepo>) {
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
}

function fazerRequisicao(corpo: unknown) {
  return new Request('http://localhost/api/quiz/finish', {
    method: 'POST',
    body: JSON.stringify(corpo),
    headers: { 'x-forwarded-for': ip() },
  })
}

describe('POST /api/quiz/finish', () => {
  it('conclui e retorna o resultado quando todas as perguntas foram respondidas', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarEResponderTudo(repo)
    const handler = criarHandlerFinish(repo)
    const res = await handler(fazerRequisicao({ session_token: TOKEN }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.score_geral_pct).toBe(100)
  })

  it('retorna 422 quando faltam respostas', async () => {
    const repo = criarFakeSessionRepo()
    const start = criarHandlerStart(repo)
    await start(new Request('http://localhost/api/quiz/start', {
      method: 'POST',
      body: JSON.stringify({ nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', session_token: TOKEN }),
      headers: { 'x-forwarded-for': ip() },
    }))
    const handler = criarHandlerFinish(repo)
    const res = await handler(fazerRequisicao({ session_token: TOKEN }))
    expect(res.status).toBe(422)
  })

  it('retorna 409 numa segunda chamada de finish', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarEResponderTudo(repo)
    const handler = criarHandlerFinish(repo)
    await handler(fazerRequisicao({ session_token: TOKEN }))
    const res = await handler(fazerRequisicao({ session_token: TOKEN }))
    expect(res.status).toBe(409)
  })

  it('retorna 404 para session_token inexistente', async () => {
    const repo = criarFakeSessionRepo()
    const handler = criarHandlerFinish(repo)
    const res = await handler(fazerRequisicao({ session_token: 'bbbbbbbb-2222-2222-2222-222222222222' }))
    expect(res.status).toBe(404)
  })

  it('retorna 422 para session_token fora do formato uuid (sem estourar 500 no banco)', async () => {
    const repo = criarFakeSessionRepo()
    const handler = criarHandlerFinish(repo)
    const res = await handler(fazerRequisicao({ session_token: 'nao-e-uuid' }))
    expect(res.status).toBe(422)
  })
})
