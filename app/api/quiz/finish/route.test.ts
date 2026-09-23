// app/api/quiz/finish/route.test.ts
import { describe, it, expect, vi } from 'vitest'
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
    body: JSON.stringify({ nome: 'Maria Silva', whatsapp: '11987654321', email: 'maria@x.com', session_token: TOKEN }),
    headers: { 'x-forwarded-for': ip() },
  }))
  const answer = criarHandlerAnswer(repo)
  // Gabarito real das 4 perguntas (lib/questions.ts): C, C, B, A.
  const RESPOSTAS_CORRETAS: Record<number, string> = { 1: 'C', 2: 'C', 3: 'B', 4: 'A' }
  for (const num of [1, 2, 3, 4]) {
    await answer(new Request('http://localhost/api/quiz/answer', {
      method: 'POST',
      body: JSON.stringify({ session_token: TOKEN, num, escolhida: RESPOSTAS_CORRETAS[num] }),
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
  // `() => {}` no lugar do agendador (2º argumento) nos outros testes: o
  // real (`after`, de next/server) exige contexto de requisição do Next.js
  // de verdade, que chamar a rota direto (como aqui) não tem — ver o
  // comentário em criarHandlerFinish. O comportamento do agendador em si é
  // testado abaixo.
  it('conclui e retorna o resultado quando todas as perguntas foram respondidas', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarEResponderTudo(repo)
    const handler = criarHandlerFinish(repo, () => {})
    const res = await handler(fazerRequisicao({ session_token: TOKEN }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.score_geral_pct).toBe(100)
  })

  it('agenda a geração do diagnóstico em background só quando conclui com sucesso', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarEResponderTudo(repo)
    const agendarBackground = vi.fn()
    const handler = criarHandlerFinish(repo, agendarBackground)
    await handler(fazerRequisicao({ session_token: TOKEN }))
    expect(agendarBackground).toHaveBeenCalledTimes(1)

    // Segunda chamada (409, sessão já concluída) não agenda de novo.
    await handler(fazerRequisicao({ session_token: TOKEN }))
    expect(agendarBackground).toHaveBeenCalledTimes(1)
  })

  it('a tarefa agendada gera diagnóstico e apresentação em paralelo (Promise.all), as duas', async () => {
    const ENV_ORIGINAL = { ...process.env }
    process.env.LAUDO_SERVICE_URL = 'http://laudo-service.local'
    process.env.LAUDO_SERVICE_SECRET = 'segredo-de-teste'
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      const s3Header = url.endsWith('/apresentacao') ? 'X-Apresentacao-S3-Key' : 'X-Laudo-S3-Key'
      const s3Key = url.endsWith('/apresentacao') ? 'apresentacoes/aaaaaaaa.pdf' : 'laudos/aaaaaaaa.pdf'
      return Promise.resolve(new Response(new Uint8Array(), { status: 200, headers: { [s3Header]: s3Key } }))
    }))

    try {
      const repo = criarFakeSessionRepo()
      await iniciarEResponderTudo(repo)
      // diagnosticoPdfBackground só chama o serviço com um perfil completo (ver
      // validarSessaoParaDiagnostico) — iniciarEResponderTudo não passa pela tela
      // de perfilamento, então precisa preencher aqui pra exercitar o
      // caminho de sucesso das duas gerações.
      const sessaoAntes = await repo.buscarPorToken(TOKEN)
      await repo.atualizar(sessaoAntes!.id, {
        perfil: {
          alvo: 'tj', cargo: 'analista', formacao: 'cursando_direito', tempo: 't0', provas: 'p0',
          metodo: 'nenhum', vde: 'nunca', horas: 'h1', edital: 'sem', dor: 'improviso',
          momento: 'zero', dinheiro: '96', leitura: 'completa', editais: [],
        },
      })
      let tarefaAgendada: (() => void | Promise<void>) | undefined
      const handler = criarHandlerFinish(repo, (tarefa) => { tarefaAgendada = tarefa })
      await handler(fazerRequisicao({ session_token: TOKEN }))

      await tarefaAgendada?.()

      expect(repo.linhas[0].laudoPdfS3Key).toBe('laudos/aaaaaaaa.pdf')
      expect(repo.linhas[0].apresentacaoPdfS3Key).toBe('apresentacoes/aaaaaaaa.pdf')
    } finally {
      process.env = { ...ENV_ORIGINAL }
      vi.unstubAllGlobals()
    }
  })

  it('retorna 422 quando faltam respostas', async () => {
    const repo = criarFakeSessionRepo()
    const start = criarHandlerStart(repo)
    await start(new Request('http://localhost/api/quiz/start', {
      method: 'POST',
      body: JSON.stringify({ nome: 'Maria Silva', whatsapp: '11987654321', email: 'maria@x.com', session_token: TOKEN }),
      headers: { 'x-forwarded-for': ip() },
    }))
    const handler = criarHandlerFinish(repo, () => {})
    const res = await handler(fazerRequisicao({ session_token: TOKEN }))
    expect(res.status).toBe(422)
  })

  it('retorna 409 numa segunda chamada de finish', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarEResponderTudo(repo)
    const handler = criarHandlerFinish(repo, () => {})
    await handler(fazerRequisicao({ session_token: TOKEN }))
    const res = await handler(fazerRequisicao({ session_token: TOKEN }))
    expect(res.status).toBe(409)
  })

  it('retorna 404 para session_token inexistente', async () => {
    const repo = criarFakeSessionRepo()
    const handler = criarHandlerFinish(repo, () => {})
    const res = await handler(fazerRequisicao({ session_token: 'bbbbbbbb-2222-2222-2222-222222222222' }))
    expect(res.status).toBe(404)
  })

  it('retorna 422 para session_token fora do formato uuid (sem estourar 500 no banco)', async () => {
    const repo = criarFakeSessionRepo()
    const handler = criarHandlerFinish(repo, () => {})
    const res = await handler(fazerRequisicao({ session_token: 'nao-e-uuid' }))
    expect(res.status).toBe(422)
  })
})
