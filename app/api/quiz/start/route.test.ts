// app/api/quiz/start/route.test.ts
import { describe, it, expect } from 'vitest'
import { criarHandlerStart } from './route'
import { criarFakeSessionRepo } from '@/lib/server/testHelpers/fakeSessionRepo'
import { registrarResposta, concluirSessao } from '@/lib/server/quizService'

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
      nome: 'Maria Silva', whatsapp: '11987654321', email: 'maria@x.com', session_token: 'aaaaaaaa-1111-1111-1111-111111111111',
    }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.retomando).toBe(false)
  })

  it('recusa email inválido com 422', async () => {
    const handler = criarHandlerStart(criarFakeSessionRepo())
    const res = await handler(fazerRequisicao({
      nome: 'Maria Silva', whatsapp: '11987654321', email: 'invalido', session_token: 'aaaaaaaa-1111-1111-1111-111111111111',
    }))
    expect(res.status).toBe(422)
  })

  it('recusa whatsapp com poucos dígitos com 422', async () => {
    const handler = criarHandlerStart(criarFakeSessionRepo())
    const res = await handler(fazerRequisicao({
      nome: 'Maria Silva', whatsapp: '123', email: 'maria@x.com', session_token: 'aaaaaaaa-1111-1111-1111-111111111111',
    }))
    expect(res.status).toBe(422)
  })

  it('devolve o corpo em snake_case (session_token / respostas_salvas)', async () => {
    const handler = criarHandlerStart(criarFakeSessionRepo())
    const res = await handler(fazerRequisicao({
      nome: 'Maria Silva', whatsapp: '11987654321', email: 'maria@x.com', session_token: 'aaaaaaaa-1111-1111-1111-111111111111',
    }))
    const json = await res.json()
    expect(json.session_token).toBe('aaaaaaaa-1111-1111-1111-111111111111')
    expect(json.respostas_salvas).toEqual([])
  })

  it('recusa session_token fora do formato uuid com 422', async () => {
    const handler = criarHandlerStart(criarFakeSessionRepo())
    const res = await handler(fazerRequisicao({
      nome: 'Maria Silva', whatsapp: '11987654321', email: 'maria@x.com', session_token: 'nao-e-uuid',
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

  it('recusa nome com uma palavra só (exige nome e sobrenome) com 422', async () => {
    const handler = criarHandlerStart(criarFakeSessionRepo())
    const res = await handler(fazerRequisicao({
      nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', session_token: 'aaaaaaaa-1111-1111-1111-111111111111',
    }))
    expect(res.status).toBe(422)
  })

  it('recusa whatsapp com 10 dígitos (sem o 9º dígito) com 422', async () => {
    const handler = criarHandlerStart(criarFakeSessionRepo())
    const res = await handler(fazerRequisicao({
      nome: 'Maria Silva', whatsapp: '1187654321', email: 'maria@x.com', session_token: 'aaaaaaaa-1111-1111-1111-111111111111',
    }))
    expect(res.status).toBe(422)
  })

  it('aceita whatsapp com +55 na frente (13 dígitos)', async () => {
    const handler = criarHandlerStart(criarFakeSessionRepo())
    const res = await handler(fazerRequisicao({
      nome: 'Maria Silva', whatsapp: '+55 11 98765-4321', email: 'maria@x.com', session_token: 'aaaaaaaa-1111-1111-1111-111111111111',
    }))
    expect(res.status).toBe(200)
  })

  // Reproduz o bug: quem já concluiu (mesmo email/whatsapp) e volta a
  // preencher o formulário recebia 200 com `ja_concluida` ausente — o
  // cliente seguia adiante achando que ia começar do zero, e só descobria
  // que a sessão estava fechada bem mais tarde, com "não foi possível
  // registrar sua resposta" ou "não foi possível concluir". A rota precisa
  // avisar isso já na resposta do /start.
  it('avisa ja_concluida:true ao retomar uma sessão que já tinha sido concluída', async () => {
    const repo = criarFakeSessionRepo()
    const handler = criarHandlerStart(repo)
    await handler(fazerRequisicao({
      nome: 'Maria Silva', whatsapp: '11987654321', email: 'maria@x.com', session_token: 'aaaaaaaa-1111-1111-1111-111111111111',
    }))
    for (let num = 1; num <= 4; num++) {
      await registrarResposta(repo, 'aaaaaaaa-1111-1111-1111-111111111111', { num, escolhida: 'A' })
    }
    await concluirSessao(repo, 'aaaaaaaa-1111-1111-1111-111111111111')

    const res = await handler(fazerRequisicao({
      nome: 'Maria Silva', whatsapp: '11987654321', email: 'maria@x.com', session_token: 'bbbbbbbb-2222-2222-2222-222222222222',
    }))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.ja_concluida).toBe(true)
  })

  it('devolve ja_concluida:false pra sessão nova', async () => {
    const handler = criarHandlerStart(criarFakeSessionRepo())
    const res = await handler(fazerRequisicao({
      nome: 'Maria Silva', whatsapp: '11987654321', email: 'maria@x.com', session_token: 'aaaaaaaa-1111-1111-1111-111111111111',
    }))
    const json = await res.json()
    expect(json.ja_concluida).toBe(false)
  })
})
