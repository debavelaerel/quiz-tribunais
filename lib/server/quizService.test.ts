// lib/server/quizService.test.ts
import { describe, it, expect } from 'vitest'
import { criarFakeSessionRepo } from './testHelpers/fakeSessionRepo'
import {
  iniciarSessao,
  registrarResposta,
  registrarPerfil,
  concluirSessao,
  buscarResultado,
  SessaoInvalidaError,
  SessaoConcluidaError,
  SessaoIncompletaError,
} from './quizService'

const EVENTO = 'diagnostico-tribunais-comercial'

describe('iniciarSessao', () => {
  it('cria linha nova quando email e whatsapp não existem', async () => {
    const repo = criarFakeSessionRepo()
    const r = await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', sessionToken: 'tok-1', evento: EVENTO })
    expect(r.retomando).toBe(false)
    expect(repo.linhas).toHaveLength(1)
  })

  it('reaproveita e retoma progresso quando o email já existe e está em_andamento', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', sessionToken: 'tok-1', evento: EVENTO })
    await registrarResposta(repo, 'tok-1', { num: 1, escolhida: 'B' })
    const r = await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'MARIA@X.COM', sessionToken: 'tok-2', evento: EVENTO })
    expect(r.retomando).toBe(true)
    expect(r.respostasSalvas).toHaveLength(1)
    expect(repo.linhas).toHaveLength(1)
  })

  it('reaproveita por whatsapp quando o email é diferente, e sobrescreve os dados', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', sessionToken: 'tok-1', evento: EVENTO })
    const r = await iniciarSessao(repo, { nome: 'Maria Silva', whatsapp: '(11) 98765-4321', email: 'maria2@x.com', sessionToken: 'tok-2', evento: EVENTO })
    expect(repo.linhas).toHaveLength(1)
    expect(repo.linhas[0].nome).toBe('Maria Silva')
    expect(repo.linhas[0].emailNormalizado).toBe('maria2@x.com')
  })

  it('sobrescreve (reseta) quando reaproveita uma sessão já concluída', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', sessionToken: 'tok-1', evento: EVENTO })
    await registrarResposta(repo, 'tok-1', { num: 1, escolhida: 'C' })
    await registrarResposta(repo, 'tok-1', { num: 2, escolhida: 'C' })
    await registrarResposta(repo, 'tok-1', { num: 3, escolhida: 'B' })
    await registrarResposta(repo, 'tok-1', { num: 4, escolhida: 'A' })
    await concluirSessao(repo, 'tok-1')

    const r = await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', sessionToken: 'tok-2', evento: EVENTO })
    expect(r.retomando).toBe(false)
    expect(r.respostasSalvas).toHaveLength(0)
    expect(repo.linhas).toHaveLength(1)
    expect(repo.linhas[0].status).toBe('em_andamento')
    expect(repo.linhas[0].completedAt).toBeNull()
  })

  // Mesmo navegador, pessoa diferente: o cliente sempre gera um session_token novo
  // no início manual (o token em cache só é reusado ao retomar a própria sessão),
  // porque `session_token` é unique no banco. O que se verifica aqui é que nem o
  // token nem o navegador fundem linhas — só email e whatsapp fundem.
  it('não funde por session_token isolado — cria linha nova mesmo com o mesmo navegador', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', sessionToken: 'tok-navegador-1', evento: EVENTO })
    await iniciarSessao(repo, { nome: 'Joao', whatsapp: '11900000000', email: 'joao@x.com', sessionToken: 'tok-navegador-2', evento: EVENTO })
    expect(repo.linhas).toHaveLength(2)
  })

  it('recusa reaproveitar o session_token de outra linha ao criar (unique no banco)', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', sessionToken: 'tok-1', evento: EVENTO })
    await expect(
      iniciarSessao(repo, { nome: 'Joao', whatsapp: '11900000000', email: 'joao@x.com', sessionToken: 'tok-1', evento: EVENTO }),
    ).rejects.toThrow(/session_token duplicado/)
  })

  it('mesmo email em eventos diferentes não conflita', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', sessionToken: 'tok-1', evento: 'evento-a' })
    await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', sessionToken: 'tok-2', evento: 'evento-b' })
    expect(repo.linhas).toHaveLength(2)
  })
})

describe('registrarResposta', () => {
  it('lança SessaoInvalidaError para token inexistente', async () => {
    const repo = criarFakeSessionRepo()
    await expect(registrarResposta(repo, 'nao-existe', { num: 1, escolhida: 'A' })).rejects.toThrow(SessaoInvalidaError)
  })

  it('lança SessaoConcluidaError para sessão já concluída', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', sessionToken: 'tok-1', evento: EVENTO })
    await registrarResposta(repo, 'tok-1', { num: 1, escolhida: 'C' })
    await registrarResposta(repo, 'tok-1', { num: 2, escolhida: 'C' })
    await registrarResposta(repo, 'tok-1', { num: 3, escolhida: 'B' })
    await registrarResposta(repo, 'tok-1', { num: 4, escolhida: 'A' })
    await concluirSessao(repo, 'tok-1')
    await expect(registrarResposta(repo, 'tok-1', { num: 1, escolhida: 'A' })).rejects.toThrow(SessaoConcluidaError)
  })

  it('faz upsert por num — responder a mesma pergunta duas vezes não duplica', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', sessionToken: 'tok-1', evento: EVENTO })
    await registrarResposta(repo, 'tok-1', { num: 1, escolhida: 'A' })
    await registrarResposta(repo, 'tok-1', { num: 1, escolhida: 'B' })
    expect(repo.linhas[0].respostas).toHaveLength(1)
    expect(repo.linhas[0].respostas[0].escolhida).toBe('B')
  })
})

describe('registrarPerfil', () => {
  it('mescla respostas de perfil sem sobrescrever chaves já salvas', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', sessionToken: 'tok-1', evento: EVENTO })
    await registrarPerfil(repo, 'tok-1', { alvo: 'trt' })
    await registrarPerfil(repo, 'tok-1', { cargo: 'analista' })
    expect(repo.linhas[0].perfil).toEqual({ alvo: 'trt', cargo: 'analista' })
  })

  it('lança SessaoInvalidaError para token inexistente', async () => {
    const repo = criarFakeSessionRepo()
    await expect(registrarPerfil(repo, 'nao-existe', { alvo: 'trt' })).rejects.toThrow(SessaoInvalidaError)
  })

  it('lança SessaoConcluidaError para sessão já concluída', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', sessionToken: 'tok-1', evento: EVENTO })
    await registrarResposta(repo, 'tok-1', { num: 1, escolhida: 'C' })
    await registrarResposta(repo, 'tok-1', { num: 2, escolhida: 'C' })
    await registrarResposta(repo, 'tok-1', { num: 3, escolhida: 'B' })
    await registrarResposta(repo, 'tok-1', { num: 4, escolhida: 'A' })
    await concluirSessao(repo, 'tok-1')
    await expect(registrarPerfil(repo, 'tok-1', { alvo: 'trt' })).rejects.toThrow(SessaoConcluidaError)
  })
})

describe('concluirSessao', () => {
  it('lança SessaoIncompletaError quando faltam perguntas', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', sessionToken: 'tok-1', evento: EVENTO })
    await registrarResposta(repo, 'tok-1', { num: 1, escolhida: 'B' })
    await expect(concluirSessao(repo, 'tok-1')).rejects.toThrow(SessaoIncompletaError)
  })

  it('calcula e grava o resultado quando todas as perguntas foram respondidas', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', sessionToken: 'tok-1', evento: EVENTO })
    await registrarPerfil(repo, 'tok-1', { alvo: 'trt', cargo: 'analista', formacao: 'direito', horas: 'h3', edital: 'previsto', dor: 'base' })
    await registrarResposta(repo, 'tok-1', { num: 1, escolhida: 'C' })
    await registrarResposta(repo, 'tok-1', { num: 2, escolhida: 'C' })
    await registrarResposta(repo, 'tok-1', { num: 3, escolhida: 'B' })
    await registrarResposta(repo, 'tok-1', { num: 4, escolhida: 'A' })
    const sessao = await concluirSessao(repo, 'tok-1')
    expect(sessao.status).toBe('concluido')
    expect(sessao.scoreGeralPct).toBe(100)
    expect(sessao.completedAt).not.toBeNull()
    // perfilCalculado é derivado de perfil + score no momento do finish, nunca do cliente.
    expect(sessao.perfilCalculado).toEqual({ classe: 'A', pontos: 9, curso: 'Curso 1 · Analista de TRT (168 temas)', cursoCod: 'C1-TRT', ritmo: 'base em menos de 6 meses' })
  })

  it('lança SessaoConcluidaError numa segunda chamada de finish', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', sessionToken: 'tok-1', evento: EVENTO })
    await registrarResposta(repo, 'tok-1', { num: 1, escolhida: 'C' })
    await registrarResposta(repo, 'tok-1', { num: 2, escolhida: 'C' })
    await registrarResposta(repo, 'tok-1', { num: 3, escolhida: 'B' })
    await registrarResposta(repo, 'tok-1', { num: 4, escolhida: 'A' })
    await concluirSessao(repo, 'tok-1')
    await expect(concluirSessao(repo, 'tok-1')).rejects.toThrow(SessaoConcluidaError)
  })
})

describe('buscarResultado', () => {
  it('retorna null quando a sessão não está concluída', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', sessionToken: 'tok-1', evento: EVENTO })
    expect(await buscarResultado(repo, 'tok-1')).toBeNull()
  })

  it('retorna a sessão quando concluída', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', sessionToken: 'tok-1', evento: EVENTO })
    await registrarResposta(repo, 'tok-1', { num: 1, escolhida: 'C' })
    await registrarResposta(repo, 'tok-1', { num: 2, escolhida: 'C' })
    await registrarResposta(repo, 'tok-1', { num: 3, escolhida: 'B' })
    await registrarResposta(repo, 'tok-1', { num: 4, escolhida: 'A' })
    await concluirSessao(repo, 'tok-1')
    const sessao = await buscarResultado(repo, 'tok-1')
    expect(sessao?.status).toBe('concluido')
  })
})
