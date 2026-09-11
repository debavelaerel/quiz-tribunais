import { describe, it, expect } from 'vitest'
import { criarHandlerPerfil } from './route'
import { criarHandlerStart } from '../start/route'
import { criarFakeSessionRepo } from '@/lib/server/testHelpers/fakeSessionRepo'

const TOKEN = 'aaaaaaaa-1111-1111-1111-111111111111'

function ip() {
  return `10.0.5.${Math.floor(Math.random() * 250)}`
}

function fazerRequisicao(corpo: unknown) {
  return new Request('http://localhost/api/quiz/perfil', {
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

describe('POST /api/quiz/perfil', () => {
  it('registra uma resposta de perfil de valor único', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessaoDeTeste(repo)
    const handler = criarHandlerPerfil(repo)
    const res = await handler(fazerRequisicao({ session_token: TOKEN, chave: 'alvo', valor: 'trt' }))
    expect(res.status).toBe(200)
    expect(repo.linhas[0].perfil).toEqual({ alvo: 'trt' })
  })

  it('registra uma resposta multi-seleção (array de strings)', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessaoDeTeste(repo)
    const handler = criarHandlerPerfil(repo)
    const res = await handler(fazerRequisicao({ session_token: TOKEN, chave: 'editais', valor: ['trt8', 'trt4'] }))
    expect(res.status).toBe(200)
    expect(repo.linhas[0].perfil).toEqual({ editais: ['trt8', 'trt4'] })
  })

  it('registra desqualificadoMotivo (marcação silenciosa da tela desqualificado, fluxo padrão)', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessaoDeTeste(repo)
    const handler = criarHandlerPerfil(repo)
    const res = await handler(fazerRequisicao({ session_token: TOKEN, chave: 'desqualificadoMotivo', valor: 'cargo_baixo' }))
    expect(res.status).toBe(200)
    expect(repo.linhas[0].perfil).toEqual({ desqualificadoMotivo: 'cargo_baixo' })
  })

  it('registra várias respostas de perfil de uma vez (lote), numa chamada só', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessaoDeTeste(repo)
    const handler = criarHandlerPerfil(repo)
    const res = await handler(fazerRequisicao({
      session_token: TOKEN,
      respostas: { alvo: 'trt', cargo: 'analista', editais: ['trt8', 'trt4'] },
    }))
    expect(res.status).toBe(200)
    expect(repo.linhas[0].perfil).toEqual({ alvo: 'trt', cargo: 'analista', editais: ['trt8', 'trt4'] })
  })

  it('lote: recusa se alguma chave estiver fora da allowlist (nada é gravado)', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessaoDeTeste(repo)
    const handler = criarHandlerPerfil(repo)
    const res = await handler(fazerRequisicao({ session_token: TOKEN, respostas: { alvo: 'trt', admin: 'x' } }))
    expect(res.status).toBe(422)
    expect(repo.linhas[0].perfil).toEqual({})
  })

  it('lote: recusa valor string pra uma chave multi (editais) dentro do lote', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessaoDeTeste(repo)
    const handler = criarHandlerPerfil(repo)
    const res = await handler(fazerRequisicao({ session_token: TOKEN, respostas: { editais: 'trt8' } }))
    expect(res.status).toBe(422)
  })

  it('lote vazio ({}) é aceito e não grava nada', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessaoDeTeste(repo)
    const handler = criarHandlerPerfil(repo)
    const res = await handler(fazerRequisicao({ session_token: TOKEN, respostas: {} }))
    expect(res.status).toBe(200)
  })

  it('recusa uma chave fora da allowlist', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessaoDeTeste(repo)
    const handler = criarHandlerPerfil(repo)
    const res = await handler(fazerRequisicao({ session_token: TOKEN, chave: 'admin', valor: 'x' }))
    expect(res.status).toBe(422)
  })

  it('recusa valor string para uma chave multi (editais)', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessaoDeTeste(repo)
    const handler = criarHandlerPerfil(repo)
    const res = await handler(fazerRequisicao({ session_token: TOKEN, chave: 'editais', valor: 'trt8' }))
    expect(res.status).toBe(422)
  })

  it('retorna 404 para session_token inexistente', async () => {
    const repo = criarFakeSessionRepo()
    const handler = criarHandlerPerfil(repo)
    const res = await handler(fazerRequisicao({ session_token: 'bbbbbbbb-2222-2222-2222-222222222222', chave: 'alvo', valor: 'trt' }))
    expect(res.status).toBe(404)
  })

  it('retorna 422 para session_token fora do formato uuid', async () => {
    const repo = criarFakeSessionRepo()
    const handler = criarHandlerPerfil(repo)
    const res = await handler(fazerRequisicao({ session_token: 'nao-e-uuid', chave: 'alvo', valor: 'trt' }))
    expect(res.status).toBe(422)
  })
})
