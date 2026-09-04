import type { SessionRepo } from './sessionRepo'
import type { IniciarSessaoInput, IniciarSessaoResultado, QuizSession } from './types'
import { normalizeEmail, normalizeWhatsapp } from '../normalize'
import { montarRespostaResumo, calcularAreas, calcularResultado, respostasCobremTodasPerguntas, type RespostaEntrada } from '../scoring'

export class SessaoInvalidaError extends Error {}
export class SessaoConcluidaError extends Error {}
export class SessaoIncompletaError extends Error {}

export async function iniciarSessao(repo: SessionRepo, input: IniciarSessaoInput): Promise<IniciarSessaoResultado> {
  const emailNormalizado = normalizeEmail(input.email)
  const whatsappNormalizado = normalizeWhatsapp(input.whatsapp)

  let existente = await repo.buscarPorEmail(input.evento, emailNormalizado)
  if (!existente) existente = await repo.buscarPorWhatsapp(input.evento, whatsappNormalizado)

  if (existente) {
    if (existente.status === 'em_andamento') {
      const atualizada = await repo.atualizar(existente.id, {
        sessionToken: input.sessionToken,
        nome: input.nome,
        email: input.email,
        emailNormalizado,
        whatsapp: input.whatsapp,
        whatsappNormalizado,
      })
      return { sessionToken: atualizada.sessionToken, retomando: true, respostasSalvas: atualizada.respostas }
    }
    const reiniciada = await repo.atualizar(existente.id, {
      sessionToken: input.sessionToken,
      nome: input.nome,
      email: input.email,
      emailNormalizado,
      whatsapp: input.whatsapp,
      whatsappNormalizado,
      status: 'em_andamento',
      respostas: [],
      areas: {},
      scoreGeralPct: null,
      acertos: null,
      total: null,
      areaPrioritaria: null,
      startedAt: new Date().toISOString(),
      completedAt: null,
    })
    return { sessionToken: reiniciada.sessionToken, retomando: false, respostasSalvas: [] }
  }

  const agora = new Date().toISOString()
  const criada = await repo.criar({
    sessionToken: input.sessionToken,
    evento: input.evento,
    nome: input.nome,
    whatsapp: input.whatsapp,
    whatsappNormalizado,
    email: input.email,
    emailNormalizado,
    status: 'em_andamento',
    respostas: [],
    areas: {},
    scoreGeralPct: null,
    acertos: null,
    total: null,
    areaPrioritaria: null,
    startedAt: agora,
    updatedAt: agora,
    completedAt: null,
  })
  return { sessionToken: criada.sessionToken, retomando: false, respostasSalvas: [] }
}

export async function registrarResposta(repo: SessionRepo, sessionToken: string, entrada: RespostaEntrada): Promise<void> {
  const sessao = await repo.buscarPorToken(sessionToken)
  if (!sessao) throw new SessaoInvalidaError('sessão não encontrada')
  if (sessao.status === 'concluido') throw new SessaoConcluidaError('sessão já concluída')

  const resumo = montarRespostaResumo(entrada)
  const respostas = sessao.respostas.filter((r) => r.num !== resumo.num)
  respostas.push(resumo)
  const areas = calcularAreas(respostas)
  await repo.atualizar(sessao.id, { respostas, areas })
}

export async function concluirSessao(repo: SessionRepo, sessionToken: string): Promise<QuizSession> {
  const sessao = await repo.buscarPorToken(sessionToken)
  if (!sessao) throw new SessaoInvalidaError('sessão não encontrada')
  if (sessao.status === 'concluido') throw new SessaoConcluidaError('sessão já concluída')
  if (!respostasCobremTodasPerguntas(sessao.respostas)) throw new SessaoIncompletaError('faltam respostas')

  const resultado = calcularResultado(sessao.respostas)
  return repo.atualizar(sessao.id, {
    status: 'concluido',
    areas: resultado.areas,
    scoreGeralPct: resultado.scoreGeralPct,
    acertos: resultado.acertos,
    total: resultado.total,
    areaPrioritaria: resultado.areaPrioritaria,
    completedAt: new Date().toISOString(),
  })
}

export async function buscarResultado(repo: SessionRepo, sessionToken: string): Promise<QuizSession | null> {
  const sessao = await repo.buscarPorToken(sessionToken)
  if (!sessao || sessao.status !== 'concluido') return null
  return sessao
}
