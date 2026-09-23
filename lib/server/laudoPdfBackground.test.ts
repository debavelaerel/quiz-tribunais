import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { gerarEArmazenarLaudo, gerarEArmazenarApresentacao } from './laudoPdfBackground'
import { criarFakeSessionRepo } from './testHelpers/fakeSessionRepo'
import type { QuizSession } from './types'

function sessaoConcluidaDeExemplo(): QuizSession {
  return {
    id: 1, laudoToken: 'cccccccc-3333-3333-3333-333333333333', sessionToken: 'aaaaaaaa-1111-1111-1111-111111111111', evento: 'diagnostico-tribunais-comercial',
    nome: 'Camila Nogueira', whatsapp: '11999998888', whatsappNormalizado: '5511999998888',
    email: 'camila@x.com', emailNormalizado: 'camila@x.com', fluxo: 'padrao', status: 'concluido',
    respostas: [
      { num: 1, area: 'Língua Portuguesa', escolhida: 'C', gabarito: 'C', acertou: true },
      { num: 2, area: 'Direito Constitucional', escolhida: 'A', gabarito: 'C', acertou: false },
      { num: 3, area: 'Direito Processual Civil', escolhida: 'B', gabarito: 'B', acertou: true },
      { num: 4, area: 'Raciocínio Lógico', escolhida: 'D', gabarito: 'A', acertou: false },
    ],
    areas: {}, scoreGeralPct: 50, acertos: 2, total: 4, areaPrioritaria: 'Direito Constitucional',
    perfil: {
      alvo: 'tj', cargo: 'analista', formacao: 'cursando_direito', tempo: 't0', provas: 'p0',
      metodo: 'nenhum', vde: 'nunca', horas: 'h1', edital: 'sem', dor: 'improviso',
      momento: 'zero', dinheiro: '96', leitura: 'completa', editais: [],
    },
    perfilCalculado: { classe: 'A', pontos: 7, curso: 'Curso 2 · Analista de TJ e TRF (231 temas)', cursoCod: 'C2-TJTRF', ritmo: 'base em 12 meses, no ritmo de 2h por dia' },
    blocos: [],
    whatsappClicadoEm: null, laudoPdfS3Key: null, laudoPdfErro: null,
    apresentacaoPdfS3Key: null, apresentacaoPdfErro: null,
    startedAt: '2026-09-16T10:00:00Z', updatedAt: '2026-09-16T10:20:00Z', completedAt: '2026-09-16T10:20:00Z',
  }
}

describe('gerarEArmazenarLaudo', () => {
  const ENV_ORIGINAL = { ...process.env }

  beforeEach(() => {
    process.env.LAUDO_SERVICE_URL = 'http://laudo-service.local'
    process.env.LAUDO_SERVICE_SECRET = 'segredo-de-teste'
  })

  afterEach(() => {
    process.env = { ...ENV_ORIGINAL }
    vi.unstubAllGlobals()
  })

  it('sessão incompleta (perfil faltando): nem chama o serviço', async () => {
    const repo = criarFakeSessionRepo()
    const sessao = { ...sessaoConcluidaDeExemplo(), perfil: { ...sessaoConcluidaDeExemplo().perfil, dor: undefined } }
    const criada = await repo.criar(sessao)
    const fetchEspiao = vi.fn()
    vi.stubGlobal('fetch', fetchEspiao)

    await gerarEArmazenarLaudo(repo, criada)

    expect(fetchEspiao).not.toHaveBeenCalled()
    expect(repo.linhas[0].laudoPdfS3Key).toBeNull()
  })

  it('sucesso: salva a chave do S3 e limpa laudo_pdf_erro', async () => {
    const repo = criarFakeSessionRepo()
    const sessao = { ...sessaoConcluidaDeExemplo(), laudoPdfErro: 'falha antiga' }
    const criada = await repo.criar(sessao)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(new Uint8Array(), { status: 200, headers: { 'X-Laudo-S3-Key': 'laudos/aaaaaaaa.pdf' } }),
    ))

    await gerarEArmazenarLaudo(repo, criada)

    expect(repo.linhas[0].laudoPdfS3Key).toBe('laudos/aaaaaaaa.pdf')
    expect(repo.linhas[0].laudoPdfErro).toBeNull()
  })

  it('S3 ainda não configurado no serviço (sem X-Laudo-S3-Key): não é erro, não grava nada', async () => {
    const repo = criarFakeSessionRepo()
    const sessao = sessaoConcluidaDeExemplo()
    const criada = await repo.criar(sessao)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Uint8Array(), { status: 200 })))

    await gerarEArmazenarLaudo(repo, criada)

    expect(repo.linhas[0].laudoPdfS3Key).toBeNull()
    expect(repo.linhas[0].laudoPdfErro).toBeNull()
  })

  it('serviço de laudo indisponível: grava o erro, não estoura exceção', async () => {
    const repo = criarFakeSessionRepo()
    const sessao = sessaoConcluidaDeExemplo()
    const criada = await repo.criar(sessao)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"detail":"deu ruim"}', { status: 502 })))

    await expect(gerarEArmazenarLaudo(repo, criada)).resolves.toBeUndefined()

    expect(repo.linhas[0].laudoPdfErro).toMatch(/502/)
    expect(repo.linhas[0].laudoPdfS3Key).toBeNull()
  })
})

describe('gerarEArmazenarApresentacao', () => {
  const ENV_ORIGINAL = { ...process.env }

  beforeEach(() => {
    process.env.LAUDO_SERVICE_URL = 'http://laudo-service.local'
    process.env.LAUDO_SERVICE_SECRET = 'segredo-de-teste'
  })

  afterEach(() => {
    process.env = { ...ENV_ORIGINAL }
    vi.unstubAllGlobals()
  })

  it('sessão incompleta (perfil faltando): nem chama o serviço', async () => {
    const repo = criarFakeSessionRepo()
    const sessao = { ...sessaoConcluidaDeExemplo(), perfil: { ...sessaoConcluidaDeExemplo().perfil, dor: undefined } }
    const criada = await repo.criar(sessao)
    const fetchEspiao = vi.fn()
    vi.stubGlobal('fetch', fetchEspiao)

    await gerarEArmazenarApresentacao(repo, criada)

    expect(fetchEspiao).not.toHaveBeenCalled()
    expect(repo.linhas[0].apresentacaoPdfS3Key).toBeNull()
  })

  it('sucesso: salva a chave do S3 e limpa apresentacao_pdf_erro', async () => {
    const repo = criarFakeSessionRepo()
    const sessao = { ...sessaoConcluidaDeExemplo(), apresentacaoPdfErro: 'falha antiga' }
    const criada = await repo.criar(sessao)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(new Uint8Array(), { status: 200, headers: { 'X-Apresentacao-S3-Key': 'apresentacoes/aaaaaaaa.pdf' } }),
    ))

    await gerarEArmazenarApresentacao(repo, criada)

    expect(repo.linhas[0].apresentacaoPdfS3Key).toBe('apresentacoes/aaaaaaaa.pdf')
    expect(repo.linhas[0].apresentacaoPdfErro).toBeNull()
  })

  it('S3 ainda não configurado no serviço (sem X-Apresentacao-S3-Key): não é erro, não grava nada', async () => {
    const repo = criarFakeSessionRepo()
    const sessao = sessaoConcluidaDeExemplo()
    const criada = await repo.criar(sessao)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Uint8Array(), { status: 200 })))

    await gerarEArmazenarApresentacao(repo, criada)

    expect(repo.linhas[0].apresentacaoPdfS3Key).toBeNull()
    expect(repo.linhas[0].apresentacaoPdfErro).toBeNull()
  })

  it('serviço de apresentação indisponível: grava o erro, não estoura exceção', async () => {
    const repo = criarFakeSessionRepo()
    const sessao = sessaoConcluidaDeExemplo()
    const criada = await repo.criar(sessao)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"detail":"deu ruim"}', { status: 502 })))

    await expect(gerarEArmazenarApresentacao(repo, criada)).resolves.toBeUndefined()

    expect(repo.linhas[0].apresentacaoPdfErro).toMatch(/502/)
    expect(repo.linhas[0].apresentacaoPdfS3Key).toBeNull()
  })
})
