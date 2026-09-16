// lib/server/quizService.test.ts
import { describe, it, expect } from 'vitest'
import { criarFakeSessionRepo } from './testHelpers/fakeSessionRepo'
import {
  iniciarSessao,
  registrarResposta,
  registrarRespostasLote,
  registrarPerfil,
  concluirSessao,
  buscarResultado,
  registrarCliqueWhatsapp,
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
    expect(r.jaConcluida).toBe(false)
    expect(repo.linhas).toHaveLength(1)
  })

  it('reaproveita e retoma progresso quando o email já existe e está em_andamento', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', sessionToken: 'tok-1', evento: EVENTO })
    await registrarResposta(repo, 'tok-1', { num: 1, escolhida: 'B' })
    const r = await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'MARIA@X.COM', sessionToken: 'tok-2', evento: EVENTO })
    expect(r.retomando).toBe(true)
    expect(r.jaConcluida).toBe(false)
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

  // Segurança: uma sessão já concluída (email/whatsapp batendo) nunca pode
  // ser resetada por quem quer que esteja chamando /start — antes disso,
  // bastava saber o contato de alguém pra apagar o diagnóstico já pronto
  // dela e recomeçar do zero "como" essa pessoa (achado do /security-review,
  // corrigido aqui). O único efeito aceito e documentado que sobra é a troca
  // de session_token — sem autenticação de verdade não dá pra fechar isso
  // também sem quebrar a conveniência de retomar via email/whatsapp.
  it('NÃO reseta uma sessão já concluída — preserva status, respostas e perfil', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', sessionToken: 'tok-1', evento: EVENTO })
    await registrarResposta(repo, 'tok-1', { num: 1, escolhida: 'C' })
    await registrarResposta(repo, 'tok-1', { num: 2, escolhida: 'C' })
    await registrarResposta(repo, 'tok-1', { num: 3, escolhida: 'B' })
    await registrarResposta(repo, 'tok-1', { num: 4, escolhida: 'A' })
    await concluirSessao(repo, 'tok-1')

    const r = await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', sessionToken: 'tok-2', evento: EVENTO })
    expect(r.retomando).toBe(true)
    // Sinaliza pro chamador (rota /start) que essa sessão já estava fechada —
    // sem isso, quem chama tenta regravar perfil/respostas e concluir de novo
    // numa sessão que o backend corretamente recusa mexer, e a pessoa esbarra
    // num "não foi possível concluir"/"não foi possível registrar sua
    // resposta" sem nunca saber que já tinha um resultado pronto.
    expect(r.jaConcluida).toBe(true)
    expect(r.respostasSalvas).toHaveLength(4)
    expect(repo.linhas).toHaveLength(1)
    expect(repo.linhas[0].status).toBe('concluido')
    expect(repo.linhas[0].completedAt).not.toBeNull()
    expect(repo.linhas[0].respostas).toHaveLength(4)
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

describe('registrarRespostasLote', () => {
  // Existe só pelo fluxo final (?fluxo=final): a pessoa responde tudo em
  // memória e só no clique de contato o app tenta gravar de uma vez —
  // registrarResposta em loop virava até 4 chamadas sequenciais (mais até
  // 14 de perfil) só pra fechar a sessão, cada uma com sua própria ida e
  // volta ao banco. Grava tudo numa única leitura + escrita.
  it('grava várias respostas de uma vez, numa única leitura+escrita', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', sessionToken: 'tok-1', evento: EVENTO })
    await registrarRespostasLote(repo, 'tok-1', [
      { num: 1, escolhida: 'C' },
      { num: 2, escolhida: 'C' },
      { num: 3, escolhida: 'B' },
      { num: 4, escolhida: 'A' },
    ])
    expect(repo.linhas[0].respostas).toHaveLength(4)
    expect(repo.linhas[0].respostas.map((r) => r.escolhida)).toEqual(['C', 'C', 'B', 'A'])
  })

  it('faz upsert por num dentro do próprio lote — a última resposta pra um num vence', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', sessionToken: 'tok-1', evento: EVENTO })
    await registrarRespostasLote(repo, 'tok-1', [
      { num: 1, escolhida: 'A' },
      { num: 1, escolhida: 'B' },
    ])
    expect(repo.linhas[0].respostas).toHaveLength(1)
    expect(repo.linhas[0].respostas[0].escolhida).toBe('B')
  })

  it('faz upsert sobre respostas já existentes na sessão', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', sessionToken: 'tok-1', evento: EVENTO })
    await registrarResposta(repo, 'tok-1', { num: 1, escolhida: 'A' })
    await registrarRespostasLote(repo, 'tok-1', [{ num: 1, escolhida: 'C' }, { num: 2, escolhida: 'C' }])
    expect(repo.linhas[0].respostas).toHaveLength(2)
    expect(repo.linhas[0].respostas.find((r) => r.num === 1)?.escolhida).toBe('C')
  })

  it('lança SessaoInvalidaError para token inexistente', async () => {
    const repo = criarFakeSessionRepo()
    await expect(registrarRespostasLote(repo, 'nao-existe', [{ num: 1, escolhida: 'A' }])).rejects.toThrow(SessaoInvalidaError)
  })

  it('lança SessaoConcluidaError para sessão já concluída', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', sessionToken: 'tok-1', evento: EVENTO })
    await registrarRespostasLote(repo, 'tok-1', [
      { num: 1, escolhida: 'C' }, { num: 2, escolhida: 'C' }, { num: 3, escolhida: 'B' }, { num: 4, escolhida: 'A' },
    ])
    await concluirSessao(repo, 'tok-1')
    await expect(registrarRespostasLote(repo, 'tok-1', [{ num: 1, escolhida: 'A' }])).rejects.toThrow(SessaoConcluidaError)
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

  it('calcula e grava os blocos escolhidos', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessao(repo, { nome: 'Ana', whatsapp: '11987654321', email: 'ana@x.com', sessionToken: 'tok-blocos', evento: EVENTO })
    await registrarPerfil(repo, 'tok-blocos', {
      alvo: 'trt', cargo: 'analista', formacao: 'direito', tempo: 't2', provas: 'p1',
      metodo: 'video', vde: 'as_vezes', horas: 'h2', edital: 'sem', dor: 'base',
      momento: 'zero', dinheiro: '150', leitura: 'basica', editais: [],
    })
    await registrarRespostasLote(repo, 'tok-blocos', [
      { num: 1, escolhida: 'C' }, { num: 2, escolhida: 'A' }, { num: 3, escolhida: 'A' }, { num: 4, escolhida: 'A' },
    ])

    const sessao = await concluirSessao(repo, 'tok-blocos')
    expect(sessao.blocos).not.toBeNull()
    expect(sessao.blocos!.length).toBeGreaterThan(0)
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

describe('registrarCliqueWhatsapp', () => {
  it('lança SessaoInvalidaError quando o token não existe', async () => {
    const repo = criarFakeSessionRepo()
    await expect(registrarCliqueWhatsapp(repo, 'tok-inexistente')).rejects.toThrow(SessaoInvalidaError)
  })

  it('grava o horário do clique numa sessão concluída', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', sessionToken: 'tok-1', evento: EVENTO })
    await registrarResposta(repo, 'tok-1', { num: 1, escolhida: 'C' })
    await registrarResposta(repo, 'tok-1', { num: 2, escolhida: 'C' })
    await registrarResposta(repo, 'tok-1', { num: 3, escolhida: 'B' })
    await registrarResposta(repo, 'tok-1', { num: 4, escolhida: 'A' })
    await concluirSessao(repo, 'tok-1')

    expect(repo.linhas[0].whatsappClicadoEm).toBeNull()
    await registrarCliqueWhatsapp(repo, 'tok-1')
    expect(repo.linhas[0].whatsappClicadoEm).not.toBeNull()
  })

  it('mantém o horário do primeiro clique — não sobrescreve em cliques seguintes', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', sessionToken: 'tok-1', evento: EVENTO })
    await registrarCliqueWhatsapp(repo, 'tok-1')
    const primeiro = repo.linhas[0].whatsappClicadoEm
    await registrarCliqueWhatsapp(repo, 'tok-1')
    expect(repo.linhas[0].whatsappClicadoEm).toBe(primeiro)
  })
})
