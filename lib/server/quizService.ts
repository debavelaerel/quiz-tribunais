import type { SessionRepo } from './sessionRepo'
import type { IniciarSessaoInput, IniciarSessaoResultado, QuizSession } from './types'
import { normalizeEmail, normalizeWhatsapp } from '../normalize'
import { montarRespostaResumo, calcularAreas, calcularResultado, respostasCobremTodasPerguntas, type RespostaEntrada } from '../scoring'
import { calcularPerfil, type RespostasPerfil } from '../perfil'

export class SessaoInvalidaError extends Error {}
export class SessaoConcluidaError extends Error {}
export class SessaoIncompletaError extends Error {}

export async function iniciarSessao(repo: SessionRepo, input: IniciarSessaoInput): Promise<IniciarSessaoResultado> {
  const emailNormalizado = normalizeEmail(input.email)
  const whatsappNormalizado = normalizeWhatsapp(input.whatsapp)
  const fluxo = input.fluxo ?? 'padrao'

  let existente = await repo.buscarPorEmail(input.evento, emailNormalizado)
  if (!existente) existente = await repo.buscarPorWhatsapp(input.evento, whatsappNormalizado)

  if (existente) {
    // NUNCA reseta uma sessão já existente, concluída ou não — achado do
    // /security-review, deixado pendente até agora: qualquer um que soubesse
    // o e-mail ou WhatsApp de um lead conseguia, batendo aqui, apagar o
    // diagnóstico já concluído dele (perfil/respostas voltavam pra vazio) e
    // recomeçar do zero "como" essa pessoa — perda de dado irreversível pra
    // quem já tinha terminado, sem precisar de senha nenhuma. Sem
    // autenticação de verdade (fora de escopo por ora — precisaria de um elo
    // como confirmação por SMS/e-mail), a troca do session_token pro valor
    // que o requisitante mandou continua sendo uma limitação conhecida
    // (quem sabe o contato de alguém ainda consegue *retomar* a sessão
    // dela) — mas o pior efeito, destruir um resultado já pronto, para aqui.
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

  const agora = new Date().toISOString()
  const criada = await repo.criar({
    sessionToken: input.sessionToken,
    evento: input.evento,
    nome: input.nome,
    whatsapp: input.whatsapp,
    whatsappNormalizado,
    email: input.email,
    emailNormalizado,
    fluxo,
    status: 'em_andamento',
    respostas: [],
    areas: {},
    scoreGeralPct: null,
    acertos: null,
    total: null,
    areaPrioritaria: null,
    perfil: {},
    perfilCalculado: null,
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

// Mescla (não substitui) respostas de perfilamento na sessão — cada tela do
// funil manda só a chave que acabou de responder. Não são graduadas: ao
// contrário de registrarResposta, não passam por lib/scoring.ts.
export async function registrarPerfil(repo: SessionRepo, sessionToken: string, entrada: Partial<RespostasPerfil>): Promise<void> {
  const sessao = await repo.buscarPorToken(sessionToken)
  if (!sessao) throw new SessaoInvalidaError('sessão não encontrada')
  if (sessao.status === 'concluido') throw new SessaoConcluidaError('sessão já concluída')

  await repo.atualizar(sessao.id, { perfil: { ...sessao.perfil, ...entrada } })
}

export async function concluirSessao(repo: SessionRepo, sessionToken: string): Promise<QuizSession> {
  const sessao = await repo.buscarPorToken(sessionToken)
  if (!sessao) throw new SessaoInvalidaError('sessão não encontrada')
  if (sessao.status === 'concluido') throw new SessaoConcluidaError('sessão já concluída')
  if (!respostasCobremTodasPerguntas(sessao.respostas)) throw new SessaoIncompletaError('faltam respostas')

  const resultado = calcularResultado(sessao.respostas)
  const perfilCalculado = calcularPerfil(sessao.perfil, resultado.acertos)
  return repo.atualizar(sessao.id, {
    status: 'concluido',
    areas: resultado.areas,
    scoreGeralPct: resultado.scoreGeralPct,
    acertos: resultado.acertos,
    total: resultado.total,
    areaPrioritaria: resultado.areaPrioritaria,
    perfilCalculado,
    completedAt: new Date().toISOString(),
  })
}

export async function buscarResultado(repo: SessionRepo, sessionToken: string): Promise<QuizSession | null> {
  const sessao = await repo.buscarPorToken(sessionToken)
  if (!sessao || sessao.status !== 'concluido') return null
  return sessao
}
