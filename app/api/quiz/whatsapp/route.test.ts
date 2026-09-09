import { describe, it, expect } from 'vitest'
import { criarHandlerWhatsapp } from './route'
import { criarHandlerStart } from '../start/route'
import { criarFakeSessionRepo } from '@/lib/server/testHelpers/fakeSessionRepo'

const TOKEN = 'aaaaaaaa-1111-1111-1111-111111111111'

function ip() {
  return `10.0.6.${Math.floor(Math.random() * 250)}`
}

function fazerRequisicao(corpo: unknown) {
  return new Request('http://localhost/api/quiz/whatsapp', {
    method: 'POST',
    body: JSON.stringify(corpo),
    headers: { 'x-forwarded-for': ip() },
  })
}

async function iniciarSessaoDeTeste(repo: ReturnType<typeof criarFakeSessionRepo>) {
  const start = criarHandlerStart(repo)
  await start(new Request('http://localhost/api/quiz/start', {
    method: 'POST',
    body: JSON.stringify({ nome: 'Maria Silva', whatsapp: '11987654321', email: 'maria@x.com', session_token: TOKEN }),
    headers: { 'x-forwarded-for': ip() },
  }))
}

describe('POST /api/quiz/whatsapp', () => {
  it('grava o horário do clique', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessaoDeTeste(repo)
    const handler = criarHandlerWhatsapp(repo)
    const res = await handler(fazerRequisicao({ session_token: TOKEN }))
    expect(res.status).toBe(200)
    expect(repo.linhas[0].whatsappClicadoEm).not.toBeNull()
  })

  // Funciona com a sessão já concluída — é justamente o caso normal (o CTA só
  // aparece na tela de resultado, depois de concluída).
  it('funciona mesmo com a sessão já concluída', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessaoDeTeste(repo)
    await repo.atualizar(repo.linhas[0].id, { status: 'concluido' })
    const handler = criarHandlerWhatsapp(repo)
    const res = await handler(fazerRequisicao({ session_token: TOKEN }))
    expect(res.status).toBe(200)
  })

  it('retorna 404 para session_token inexistente', async () => {
    const repo = criarFakeSessionRepo()
    const handler = criarHandlerWhatsapp(repo)
    const res = await handler(fazerRequisicao({ session_token: 'bbbbbbbb-2222-2222-2222-222222222222' }))
    expect(res.status).toBe(404)
  })

  it('retorna 422 para session_token fora do formato uuid', async () => {
    const repo = criarFakeSessionRepo()
    const handler = criarHandlerWhatsapp(repo)
    const res = await handler(fazerRequisicao({ session_token: 'nao-e-uuid' }))
    expect(res.status).toBe(422)
  })

  it('retorna 400 para json inválido', async () => {
    const repo = criarFakeSessionRepo()
    const handler = criarHandlerWhatsapp(repo)
    const res = await handler(new Request('http://localhost/api/quiz/whatsapp', {
      method: 'POST',
      body: '{invalido',
      headers: { 'x-forwarded-for': ip() },
    }))
    expect(res.status).toBe(400)
  })
})
