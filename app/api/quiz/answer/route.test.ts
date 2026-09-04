// app/api/quiz/answer/route.test.ts
import { describe, it, expect } from 'vitest'
import { criarHandlerAnswer } from './route'
import { criarHandlerStart } from '../start/route'
import { criarFakeSessionRepo } from '@/lib/server/testHelpers/fakeSessionRepo'

function fazerRequisicao(corpo: unknown) {
  return new Request('http://localhost/api/quiz/answer', {
    method: 'POST',
    body: JSON.stringify(corpo),
    headers: { 'x-forwarded-for': `10.0.1.${Math.floor(Math.random() * 250)}` },
  })
}

async function iniciarSessaoDeTeste(repo: ReturnType<typeof criarFakeSessionRepo>) {
  const start = criarHandlerStart(repo)
  await start(new Request('http://localhost/api/quiz/start', {
    method: 'POST',
    body: JSON.stringify({ nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', session_token: 'aaaaaaaa-1111-1111-1111-111111111111' }),
    headers: { 'x-forwarded-for': `10.0.2.${Math.floor(Math.random() * 250)}` },
  }))
}

describe('POST /api/quiz/answer', () => {
  it('registra uma resposta válida', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessaoDeTeste(repo)
    const handler = criarHandlerAnswer(repo)
    const res = await handler(fazerRequisicao({ session_token: 'aaaaaaaa-1111-1111-1111-111111111111', num: 1, escolhida: 'B' }))
    expect(res.status).toBe(200)
    expect(repo.linhas[0].respostas).toHaveLength(1)
  })

  it('retorna 404 para session_token inexistente', async () => {
    const repo = criarFakeSessionRepo()
    const handler = criarHandlerAnswer(repo)
    const res = await handler(fazerRequisicao({ session_token: 'bbbbbbbb-2222-2222-2222-222222222222', num: 1, escolhida: 'B' }))
    expect(res.status).toBe(404)
  })

  it('retorna 422 para session_token fora do formato uuid (sem estourar 500 no banco)', async () => {
    const repo = criarFakeSessionRepo()
    const handler = criarHandlerAnswer(repo)
    const res = await handler(fazerRequisicao({ session_token: 'nao-e-uuid', num: 1, escolhida: 'B' }))
    expect(res.status).toBe(422)
  })

  it('retorna 422 para corpo com tipos errados', async () => {
    const repo = criarFakeSessionRepo()
    const handler = criarHandlerAnswer(repo)
    const res = await handler(fazerRequisicao({ session_token: 123, num: '1', escolhida: 'B' }))
    expect(res.status).toBe(422)
  })
})
