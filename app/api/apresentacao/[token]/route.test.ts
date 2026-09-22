import { describe, it, expect, vi } from 'vitest'
import { criarHandlerApresentacao } from './route'
import { criarFakeSessionRepo } from '@/lib/server/testHelpers/fakeSessionRepo'
import type { QuizSession } from '@/lib/server/types'

const SESSION_TOKEN = 'aaaaaaaa-1111-1111-1111-111111111111'
const UUID_INEXISTENTE = 'bbbbbbbb-2222-2222-2222-222222222222'

function sessaoBase(overrides: Partial<QuizSession> = {}): Omit<QuizSession, 'id' | 'laudoToken'> {
  return {
    sessionToken: SESSION_TOKEN, evento: 'diagnostico-tribunais-comercial',
    nome: 'Camila Nogueira', whatsapp: '11999998888', whatsappNormalizado: '5511999998888',
    email: 'camila@x.com', emailNormalizado: 'camila@x.com', fluxo: 'padrao', status: 'concluido',
    respostas: [{ num: 1, area: 'a', escolhida: 'A', gabarito: 'A', acertou: true }],
    areas: {}, scoreGeralPct: 50, acertos: 2, total: 4, areaPrioritaria: null,
    perfil: {
      alvo: 'trt', cargo: 'analista', formacao: 'direito', tempo: 't2', provas: 'p2', metodo: 'video',
      vde: 'nunca', horas: 'h2', edital: 'previsto', dor: 'banca', momento: 'plato', dinheiro: '96', leitura: 'completa',
    },
    perfilCalculado: null, blocos: [],
    whatsappClicadoEm: null, laudoPdfS3Key: null, laudoPdfErro: null,
    apresentacaoPdfS3Key: null, apresentacaoPdfErro: null,
    startedAt: '2026-09-16T10:00:00Z', updatedAt: '2026-09-16T10:20:00Z', completedAt: '2026-09-16T10:20:00Z',
    ...overrides,
  }
}

function req(token: string) {
  return {
    request: new Request(`http://localhost/api/apresentacao/${token}`),
    ctx: { params: Promise.resolve({ token }) },
  }
}

describe('GET /api/apresentacao/[token]', () => {
  it('token fora do formato uuid: 404, sem consultar o banco', async () => {
    const repo = criarFakeSessionRepo()
    const espiao = vi.spyOn(repo, 'buscarPorLaudoToken')
    const handler = criarHandlerApresentacao(repo)
    const { request, ctx } = req('nao-e-uuid')
    const res = await handler(request, ctx)
    expect(res.status).toBe(404)
    expect(espiao).not.toHaveBeenCalled()
  })

  it('token uuid mas sessão não existe: 404', async () => {
    const repo = criarFakeSessionRepo()
    const handler = criarHandlerApresentacao(repo)
    const { request, ctx } = req(UUID_INEXISTENTE)
    const res = await handler(request, ctx)
    expect(res.status).toBe(404)
  })

  it('sessão existe mas ainda em_andamento: 404', async () => {
    const repo = criarFakeSessionRepo()
    const criada = await repo.criar(sessaoBase({ status: 'em_andamento', completedAt: null }))
    const handler = criarHandlerApresentacao(repo, vi.fn(), () => true)
    const { request, ctx } = req(criada.laudoToken)
    const res = await handler(request, ctx)
    expect(res.status).toBe(404)
  })

  it('S3 não configurado: 503', async () => {
    const repo = criarFakeSessionRepo()
    const criada = await repo.criar(sessaoBase())
    const handler = criarHandlerApresentacao(repo, vi.fn(), () => false)
    const { request, ctx } = req(criada.laudoToken)
    const res = await handler(request, ctx)
    expect(res.status).toBe(503)
  })

  it('já tem chave salva: não gera de novo, só assina e redireciona (302, sem cache)', async () => {
    const repo = criarFakeSessionRepo()
    const criada = await repo.criar(sessaoBase({ apresentacaoPdfS3Key: 'apresentacoes/aaaaaaaa.pdf' }))
    const gerarUrlAssinada = vi.fn().mockResolvedValue('https://bucket.s3.amazonaws.com/apresentacoes/aaaaaaaa.pdf?assinatura=...')
    const gerarApresentacao = vi.fn()
    const handler = criarHandlerApresentacao(repo, gerarUrlAssinada, () => true, gerarApresentacao)
    const { request, ctx } = req(criada.laudoToken)
    const res = await handler(request, ctx)
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://bucket.s3.amazonaws.com/apresentacoes/aaaaaaaa.pdf?assinatura=...')
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(gerarUrlAssinada).toHaveBeenCalledWith('apresentacoes/aaaaaaaa.pdf')
    expect(gerarApresentacao).not.toHaveBeenCalled()
  })

  it('sem chave ainda: gera na hora, salva a chave, e redireciona (primeiro acesso)', async () => {
    const repo = criarFakeSessionRepo()
    const criada = await repo.criar(sessaoBase())
    const gerarUrlAssinada = vi.fn().mockResolvedValue('https://bucket.s3.amazonaws.com/apresentacoes/nova.pdf?assinatura=...')
    const gerarApresentacao = vi.fn().mockResolvedValue({ s3Key: 'apresentacoes/nova.pdf' })
    const handler = criarHandlerApresentacao(repo, gerarUrlAssinada, () => true, gerarApresentacao)
    const { request, ctx } = req(criada.laudoToken)
    const res = await handler(request, ctx)
    expect(res.status).toBe(302)
    expect(gerarApresentacao).toHaveBeenCalledOnce()
    expect(repo.linhas[0].apresentacaoPdfS3Key).toBe('apresentacoes/nova.pdf')
    expect(gerarUrlAssinada).toHaveBeenCalledWith('apresentacoes/nova.pdf')
  })

  it('sem chave, sessão com perfil incompleto: 422, não tenta gerar', async () => {
    const repo = criarFakeSessionRepo()
    const criada = await repo.criar(sessaoBase({ perfil: {} }))
    const gerarApresentacao = vi.fn()
    const handler = criarHandlerApresentacao(repo, vi.fn(), () => true, gerarApresentacao)
    const { request, ctx } = req(criada.laudoToken)
    const res = await handler(request, ctx)
    expect(res.status).toBe(422)
    expect(gerarApresentacao).not.toHaveBeenCalled()
  })

  it('geração falha: 502, grava o erro, não redireciona', async () => {
    const repo = criarFakeSessionRepo()
    const criada = await repo.criar(sessaoBase())
    const gerarApresentacao = vi.fn().mockRejectedValue(new Error('serviço respondeu 500'))
    const handler = criarHandlerApresentacao(repo, vi.fn(), () => true, gerarApresentacao)
    const { request, ctx } = req(criada.laudoToken)
    const res = await handler(request, ctx)
    expect(res.status).toBe(502)
    expect(repo.linhas[0].apresentacaoPdfErro).toBe('Error: serviço respondeu 500')
  })
})
