import { describe, it, expect, vi } from 'vitest'
import { criarHandlerDiagnostico } from './route'
import { criarFakeSessionRepo } from '@/lib/server/testHelpers/fakeSessionRepo'
import type { QuizSession } from '@/lib/server/types'

const SESSION_TOKEN = 'aaaaaaaa-1111-1111-1111-111111111111'
// Uuid qualquer, só pra passar no isUuid() em cenários "não encontrado" — a
// chave do teste aqui não é essa constante, é laudoToken != session_token
// (ver o comentário no topo de route.ts): o fake repo gera laudoToken
// sozinho em criar() (não em sessaoBase), então cada teste que espera achar
// a sessão precisa buscar pelo laudoToken que criar() realmente devolveu.
const UUID_INEXISTENTE = 'bbbbbbbb-2222-2222-2222-222222222222'

function sessaoBase(overrides: Partial<QuizSession> = {}): Omit<QuizSession, 'id' | 'laudoToken'> {
  return {
    sessionToken: SESSION_TOKEN, evento: 'diagnostico-tribunais-comercial',
    nome: 'Camila Nogueira', whatsapp: '11999998888', whatsappNormalizado: '5511999998888',
    email: 'camila@x.com', emailNormalizado: 'camila@x.com', fluxo: 'padrao', status: 'concluido',
    respostas: [], areas: {}, scoreGeralPct: 50, acertos: 2, total: 4, areaPrioritaria: null,
    perfil: {}, perfilCalculado: null, blocos: [],
    whatsappClicadoEm: null, laudoPdfS3Key: null, laudoPdfErro: null,
    apresentacaoPdfS3Key: null, apresentacaoPdfErro: null,
    startedAt: '2026-09-16T10:00:00Z', updatedAt: '2026-09-16T10:20:00Z', completedAt: '2026-09-16T10:20:00Z',
    ...overrides,
  }
}

function req(token: string) {
  return {
    request: new Request(`http://localhost/api/laudo/${token}`),
    ctx: { params: Promise.resolve({ token }) },
  }
}

describe('GET /api/laudo/[token]', () => {
  it('token fora do formato uuid: 404, sem consultar o banco', async () => {
    const repo = criarFakeSessionRepo()
    const espiao = vi.spyOn(repo, 'buscarPorLaudoToken')
    const handler = criarHandlerDiagnostico(repo)
    const { request, ctx } = req('nao-e-uuid')
    const res = await handler(request, ctx)
    expect(res.status).toBe(404)
    expect(espiao).not.toHaveBeenCalled()
  })

  it('token uuid mas sessão não existe: 404', async () => {
    const repo = criarFakeSessionRepo()
    const handler = criarHandlerDiagnostico(repo)
    const { request, ctx } = req(UUID_INEXISTENTE)
    const res = await handler(request, ctx)
    expect(res.status).toBe(404)
  })

  it('busca por session_token não encontra (só laudoToken serve pra essa rota)', async () => {
    const repo = criarFakeSessionRepo()
    await repo.criar(sessaoBase({ laudoPdfS3Key: 'laudos/x.pdf' }))
    const handler = criarHandlerDiagnostico(repo, vi.fn(), () => true)
    // SESSION_TOKEN é o session_token da sessão criada acima, não o laudoToken
    // (que o fake gerou sozinho, aleatório) — ver o comentário em route.ts
    // sobre por que os dois não podem ser confundidos aqui.
    const { request, ctx } = req(SESSION_TOKEN)
    const res = await handler(request, ctx)
    expect(res.status).toBe(404)
  })

  it('sessão existe mas ainda em_andamento: 404 (não vaza que a sessão existe)', async () => {
    const repo = criarFakeSessionRepo()
    const criada = await repo.criar(sessaoBase({ status: 'em_andamento', completedAt: null }))
    const handler = criarHandlerDiagnostico(repo, vi.fn(), () => true)
    const { request, ctx } = req(criada.laudoToken)
    const res = await handler(request, ctx)
    expect(res.status).toBe(404)
  })

  it('S3 não configurado: 503, antes mesmo de olhar se já tem chave (senão fica ambíguo com "ainda gerando")', async () => {
    const repo = criarFakeSessionRepo()
    const criada = await repo.criar(sessaoBase())
    const handler = criarHandlerDiagnostico(repo, vi.fn(), () => false)
    const { request, ctx } = req(criada.laudoToken)
    const res = await handler(request, ctx)
    expect(res.status).toBe(503)
  })

  it('S3 configurado, concluída mas diagnóstico ainda sem chave e sem erro: 425 (ainda gerando)', async () => {
    const repo = criarFakeSessionRepo()
    const criada = await repo.criar(sessaoBase())
    const handler = criarHandlerDiagnostico(repo, vi.fn(), () => true)
    const { request, ctx } = req(criada.laudoToken)
    const res = await handler(request, ctx)
    expect(res.status).toBe(425)
  })

  it('S3 configurado, sem chave, com laudo_pdf_erro: 502 (falhou de vez)', async () => {
    const repo = criarFakeSessionRepo()
    const criada = await repo.criar(sessaoBase({ laudoPdfErro: 'serviço de diagnóstico respondeu 502' }))
    const handler = criarHandlerDiagnostico(repo, vi.fn(), () => true)
    const { request, ctx } = req(criada.laudoToken)
    const res = await handler(request, ctx)
    expect(res.status).toBe(502)
  })

  it('tudo certo: gera a URL assinada e redireciona (302, sem cache)', async () => {
    const repo = criarFakeSessionRepo()
    const criada = await repo.criar(sessaoBase({ laudoPdfS3Key: 'laudos/aaaaaaaa.pdf' }))
    const gerarUrlAssinada = vi.fn().mockResolvedValue('https://bucket.s3.amazonaws.com/laudos/aaaaaaaa.pdf?assinatura=...')
    const handler = criarHandlerDiagnostico(repo, gerarUrlAssinada, () => true)
    const { request, ctx } = req(criada.laudoToken)
    const res = await handler(request, ctx)
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://bucket.s3.amazonaws.com/laudos/aaaaaaaa.pdf?assinatura=...')
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(gerarUrlAssinada).toHaveBeenCalledWith('laudos/aaaaaaaa.pdf')
  })
})
