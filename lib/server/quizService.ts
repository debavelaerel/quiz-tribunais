import type { SessionRepo } from './sessionRepo'
import type { IniciarSessaoInput, IniciarSessaoResultado, QuizSession } from './types'
import { normalizeEmail, normalizeWhatsapp } from '../normalize'
import { montarRespostaResumo, calcularAreas, calcularResultado, respostasCobremTodasPerguntas, type RespostaEntrada } from '../scoring'
import { calcularPerfil, type RespostasPerfil } from '../perfil'
import { selecionarBlocos } from '../blocos'

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
    return {
      sessionToken: atualizada.sessionToken,
      retomando: true,
      respostasSalvas: atualizada.respostas,
      // `existente.status` (de ANTES do atualizar acima) — atualizar só troca
      // token/nome/contato, nunca o status, mas ler do valor pré-atualização
      // deixa isso explícito em vez de depender de `atualizada` não mudar algo
      // que hoje não muda.
      jaConcluida: existente.status === 'concluido',
    }
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
    blocos: null,
    whatsappClicadoEm: null,
    laudoPdfS3Key: null,
    laudoPdfErro: null,
    apresentacaoPdfS3Key: null,
    apresentacaoPdfErro: null,
    startedAt: agora,
    updatedAt: agora,
    completedAt: null,
  })
  return { sessionToken: criada.sessionToken, retomando: false, respostasSalvas: [], jaConcluida: false }
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

// Mesma regra de registrarResposta (upsert por num), só que pra várias
// respostas de uma vez — uma leitura + uma escrita, não uma por resposta.
// Existe só pro fluxo final (?fluxo=final — ver componentes/Quiz.tsx): a
// pessoa responde tudo em memória e só no clique de contato o app grava
// junto com o perfilamento e a sessão; sem isso, fechar a sessão nesse
// fluxo virava até 4 chamadas /answer sequenciais (uma ida e volta ao
// banco cada), sentido como lentidão real na tela final.
export async function registrarRespostasLote(repo: SessionRepo, sessionToken: string, entradas: RespostaEntrada[]): Promise<void> {
  const sessao = await repo.buscarPorToken(sessionToken)
  if (!sessao) throw new SessaoInvalidaError('sessão não encontrada')
  if (sessao.status === 'concluido') throw new SessaoConcluidaError('sessão já concluída')

  let respostas = sessao.respostas
  for (const entrada of entradas) {
    const resumo = montarRespostaResumo(entrada)
    respostas = respostas.filter((r) => r.num !== resumo.num)
    respostas.push(resumo)
  }
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
  const blocos = selecionarBlocos(sessao.perfil, sessao.respostas)
  return repo.atualizar(sessao.id, {
    status: 'concluido',
    areas: resultado.areas,
    scoreGeralPct: resultado.scoreGeralPct,
    acertos: resultado.acertos,
    total: resultado.total,
    areaPrioritaria: resultado.areaPrioritaria,
    perfilCalculado,
    blocos,
    completedAt: new Date().toISOString(),
  })
}

export async function buscarResultado(repo: SessionRepo, sessionToken: string): Promise<QuizSession | null> {
  const sessao = await repo.buscarPorToken(sessionToken)
  if (!sessao || sessao.status !== 'concluido') return null
  return sessao
}

// Sinal de intenção de compra (clicou no CTA de WhatsApp na tela de
// resultado) — não é um passo do funil, por isso não usa SessaoConcluidaError:
// funciona mesmo com a sessão já concluída (é justamente o caso normal).
// Só grava o PRIMEIRO clique — cliques repetidos (reabriu a tela, clicou de
// novo) não empurram o horário pra frente.
export async function registrarCliqueWhatsapp(repo: SessionRepo, sessionToken: string): Promise<void> {
  const sessao = await repo.buscarPorToken(sessionToken)
  if (!sessao) throw new SessaoInvalidaError('sessão não encontrada')
  if (sessao.whatsappClicadoEm) return
  await repo.atualizar(sessao.id, { whatsappClicadoEm: new Date().toISOString() })
}
