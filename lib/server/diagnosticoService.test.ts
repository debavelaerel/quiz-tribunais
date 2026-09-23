import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { validarSessaoParaDiagnostico, gerarDiagnosticoPdf, DiagnosticoIndisponivel } from './diagnosticoService'
import type { QuizSession } from './types'

function sessaoDeExemplo(): QuizSession {
  return {
    id: 1, laudoToken: 'laudo-tok', sessionToken: 'tok', evento: 'diagnostico-tribunais-comercial',
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

describe('validarSessaoParaDiagnostico', () => {
  it('sessão completa (o caminho normal, via UI): sem problemas', () => {
    expect(validarSessaoParaDiagnostico(sessaoDeExemplo())).toEqual([])
  })

  it('falta um campo do perfil: aponta qual', () => {
    const sessao = sessaoDeExemplo()
    sessao.perfil = { ...sessao.perfil, dor: undefined }
    const problemas = validarSessaoParaDiagnostico(sessao)
    expect(problemas).toContain('falta responder "dor"')
  })

  it('campo com valor fora das opções válidas: aponta qual e o valor', () => {
    const sessao = sessaoDeExemplo()
    sessao.perfil = { ...sessao.perfil, alvo: 'valor-que-nao-existe' }
    const problemas = validarSessaoParaDiagnostico(sessao)
    expect(problemas).toContain('"valor-que-nao-existe" não é uma opção válida de "alvo"')
  })

  it('cargo=fe muda o conjunto de opções válidas de cargo (cargo_fe, não cargo)', () => {
    const sessao = sessaoDeExemplo()
    // 'escrevente' só existe nas opções normais de 'cargo' — com alvo='fe'
    // a validação precisa olhar cargo_fe (que não tem essa opção) e recusar.
    sessao.perfil = { ...sessao.perfil, alvo: 'fe', cargo: 'escrevente' }
    const problemas = validarSessaoParaDiagnostico(sessao)
    expect(problemas).toContain('"escrevente" não é uma opção válida de "cargo"')
  })

  it('sem nenhuma resposta do teste graduado: aponta isso também', () => {
    const sessao = sessaoDeExemplo()
    sessao.respostas = []
    const problemas = validarSessaoParaDiagnostico(sessao)
    expect(problemas).toContain('nenhuma resposta do teste graduado (4 questões) registrada')
  })
})

describe('gerarDiagnosticoPdf', () => {
  const ENV_ORIGINAL = { ...process.env }

  beforeEach(() => {
    process.env.LAUDO_SERVICE_URL = 'http://laudo-service.local'
    process.env.LAUDO_SERVICE_SECRET = 'segredo-de-teste'
  })

  afterEach(() => {
    process.env = { ...ENV_ORIGINAL }
    vi.unstubAllGlobals()
  })

  it('sem LAUDO_SERVICE_URL/SECRET configurados: recusa antes de qualquer chamada de rede', async () => {
    delete process.env.LAUDO_SERVICE_URL
    const fetchEspiao = vi.fn()
    vi.stubGlobal('fetch', fetchEspiao)
    await expect(gerarDiagnosticoPdf(sessaoDeExemplo(), 'intermediário')).rejects.toThrow(DiagnosticoIndisponivel)
    expect(fetchEspiao).not.toHaveBeenCalled()
  })

  it('chama POST {url}/laudo com o segredo no cabeçalho e devolve os bytes do PDF', async () => {
    const bytesFalsos = new Uint8Array([0x25, 0x50, 0x44, 0x46]) // "%PDF"
    const fetchEspiao = vi.fn().mockResolvedValue(
      new Response(bytesFalsos, { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchEspiao)

    const resultado = await gerarDiagnosticoPdf(sessaoDeExemplo(), 'intermediário')

    expect(fetchEspiao).toHaveBeenCalledTimes(1)
    const [url, init] = fetchEspiao.mock.calls[0]
    expect(url).toBe('http://laudo-service.local/laudo')
    expect(init.method).toBe('POST')
    expect(init.headers['X-Laudo-Secret']).toBe('segredo-de-teste')
    const corpo = JSON.parse(init.body)
    expect(corpo.alvo).toBe('tj')
    expect(corpo.teste).toEqual([
      { num: 1, escolhida: 'C' }, { num: 2, escolhida: 'A' },
      { num: 3, escolhida: 'B' }, { num: 4, escolhida: 'D' },
    ])
    expect(corpo.session_token).toBeUndefined()
    expect(Buffer.compare(resultado.pdf, Buffer.from(bytesFalsos))).toBe(0)
    expect(resultado.s3Key).toBeNull()
  })

  it('salvarS3: manda session_token no corpo e lê a chave do cabeçalho X-Laudo-S3-Key', async () => {
    const fetchEspiao = vi.fn().mockResolvedValue(
      new Response(new Uint8Array(), { status: 200, headers: { 'X-Laudo-S3-Key': 'laudos/tok.pdf' } }),
    )
    vi.stubGlobal('fetch', fetchEspiao)

    const resultado = await gerarDiagnosticoPdf(sessaoDeExemplo(), 'intermediário', { salvarS3: true })

    const corpo = JSON.parse(fetchEspiao.mock.calls[0][1].body)
    expect(corpo.session_token).toBe('tok')
    expect(resultado.s3Key).toBe('laudos/tok.pdf')
  })

  it('serviço responde erro (422/500/etc.): estoura DiagnosticoIndisponivel com o corpo da resposta', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('{"detail":"deu ruim"}', { status: 422 }),
    ))
    await expect(gerarDiagnosticoPdf(sessaoDeExemplo(), 'intermediário')).rejects.toThrow(/422/)
  })

  it('WhatsApp ainda no placeholder (CONFIG.whatsapp): manda whatsapp_numero vazio, sem mensagem', async () => {
    const fetchEspiao = vi.fn().mockResolvedValue(new Response(new Uint8Array(), { status: 200 }))
    vi.stubGlobal('fetch', fetchEspiao)
    await gerarDiagnosticoPdf(sessaoDeExemplo(), 'intermediário')
    const corpo = JSON.parse(fetchEspiao.mock.calls[0][1].body)
    expect(corpo.whatsapp_numero).toBe('')
    expect(corpo.whatsapp_mensagem).toBe('')
  })
})
