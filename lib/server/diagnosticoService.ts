// Cliente do serviço de PDF em Python (services/laudo-pdf) — chamado pela
// rota do admin em vez de lib/server/pdf.ts (o port em TS, descontinuado
// depois que o serviço em Python real foi validado contra os 8 casos de
// aceite do pacote e revisado).
//
// answers.py::Lead._check() do serviço recusa (422) qualquer sessão com um
// campo de perfil faltando ou fora das opções válidas — pela interface
// normal do quiz isso nunca acontece (cada pergunta trava o avanço até
// responder, ver components/Quiz.tsx::responderPerfilSingle/
// confirmarPerfilMulti), mas nada impede uma chamada direta à API. Valida
// aqui antes de gastar uma chamada de rede: mensagem específica pro admin
// em vez do 422 genérico do serviço.
import { PERFIL_SCREENS, CONFIG, mensagemWhatsapp } from '../quizContent'
import type { QuizSession } from './types'
import type { RespostasPerfil } from '../perfil'

const CAMPOS_OBRIGATORIOS: Array<keyof RespostasPerfil> = [
  'alvo', 'cargo', 'formacao', 'tempo', 'provas', 'metodo', 'vde',
  'horas', 'edital', 'dor', 'momento', 'dinheiro', 'leitura',
]

// 'leitura' e 'dinheiro' não vêm de PERFIL_SCREENS (são TELA_LEITURA /
// TELA_DINHEIRO, definidas à parte em quizContent.ts) — só confere presença
// pra esses dois, não a opção exata, já que suas telas não entram no motor
// de perfilamento genérico que PERFIL_SCREENS descreve.
const CAMPOS_SEM_VALIDACAO_DE_OPCAO = new Set<keyof RespostasPerfil>(['leitura', 'dinheiro'])

export function validarSessaoParaDiagnostico(sessao: QuizSession): string[] {
  const perfil = sessao.perfil
  const problemas: string[] = []

  for (const campo of CAMPOS_OBRIGATORIOS) {
    const valor = perfil[campo]
    if (!valor || typeof valor !== 'string') {
      problemas.push(`falta responder "${campo}"`)
      continue
    }
    if (CAMPOS_SEM_VALIDACAO_DE_OPCAO.has(campo)) continue

    const tela = PERFIL_SCREENS.find((t) => t.key === campo)
    if (!tela) continue
    const opts = typeof tela.opts === 'function' ? tela.opts(perfil) : tela.opts
    if (!opts.some((o) => o[0] === valor)) {
      problemas.push(`"${valor}" não é uma opção válida de "${campo}"`)
    }
  }

  if (sessao.respostas.length === 0) {
    problemas.push('nenhuma resposta do teste graduado (4 questões) registrada')
  }

  return problemas
}

type PayloadDiagnostico = {
  nome: string
  email: string
  tel: string
  alvo: string
  cargo: string
  formacao: string
  tempo: string
  provas: string
  metodo: string
  vde: string
  horas: string
  edital: string
  dor: string
  momento: string
  dinheiro: string
  leitura: string
  editais: string[]
  teste: Array<{ num: number; escolhida: string }>
  whatsapp_numero: string
  whatsapp_mensagem: string
  session_token?: string
}

function montarPayload(sessao: QuizSession, nivel: string): PayloadDiagnostico {
  const perfil = sessao.perfil
  // whatsapp_numero fica "" enquanto CONFIG.whatsapp for o placeholder
  // ("5500000...", ver lib/quizContent.ts) — o serviço já trata "" (ou
  // qualquer prefixo "5500000") como "ainda não configurado" e devolve o
  // CTA final sem link, não um link morto (ver brand.cta_whatsapp_com_mensagem).
  const numeroConfigurado = Boolean(CONFIG.whatsapp) && !CONFIG.whatsapp.startsWith('5500000')
  const mensagem = sessao.perfilCalculado && numeroConfigurado
    ? mensagemWhatsapp(perfil, sessao.perfilCalculado.classe, sessao.perfilCalculado.cursoCod, nivel, sessao.acertos ?? 0, sessao.total ?? 0)
    : ''

  return {
    nome: sessao.nome,
    email: sessao.email,
    tel: sessao.whatsapp,
    alvo: perfil.alvo ?? '',
    cargo: perfil.cargo ?? '',
    formacao: perfil.formacao ?? '',
    tempo: perfil.tempo ?? '',
    provas: perfil.provas ?? '',
    metodo: perfil.metodo ?? '',
    vde: perfil.vde ?? '',
    horas: perfil.horas ?? '',
    edital: perfil.edital ?? '',
    dor: perfil.dor ?? '',
    momento: perfil.momento ?? '',
    dinheiro: perfil.dinheiro ?? '',
    leitura: perfil.leitura ?? '',
    editais: perfil.editais ?? [],
    teste: sessao.respostas.map((r) => ({ num: r.num, escolhida: r.escolhida })),
    whatsapp_numero: numeroConfigurado ? CONFIG.whatsapp : '',
    whatsapp_mensagem: mensagem,
  }
}

export class DiagnosticoIndisponivel extends Error {}

export type ResultadoDiagnostico = {
  pdf: Buffer
  // Chave do objeto no S3 (não a URL — ver lib/server/diagnosticoPdfBackground.ts
  // pro porquê). null se `salvarS3` não foi pedido, ou se foi pedido mas o
  // serviço ainda não tem S3_BUCKET configurado (ver services/laudo-pdf/s3.py) —
  // as duas situações são "sem link ainda", não erro; um S3 configurado que
  // falhar de verdade vira DiagnosticoIndisponivel (o serviço devolve 502 nesse caso).
  s3Key: string | null
}

export async function gerarDiagnosticoPdf(
  sessao: QuizSession,
  nivel: string,
  opts?: { salvarS3?: boolean },
): Promise<ResultadoDiagnostico> {
  const baseUrl = process.env.LAUDO_SERVICE_URL
  const segredo = process.env.LAUDO_SERVICE_SECRET
  if (!baseUrl || !segredo) {
    throw new DiagnosticoIndisponivel('LAUDO_SERVICE_URL e LAUDO_SERVICE_SECRET precisam estar definidos')
  }

  const payload = montarPayload(sessao, nivel)
  if (opts?.salvarS3) payload.session_token = sessao.sessionToken

  // AbortSignal.timeout, não a promessa nua: sem isso, um serviço travado
  // (não caído — travado, sem responder) prende a requisição do admin até o
  // timeout da própria função serverless da Vercel (maxDuration da rota),
  // sem chance de devolver um erro específico antes disso.
  const resposta = await fetch(`${baseUrl.replace(/\/$/, '')}/laudo`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Laudo-Secret': segredo,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(55_000),
  })

  if (!resposta.ok) {
    const corpo = await resposta.text().catch(() => '')
    throw new DiagnosticoIndisponivel(`serviço de diagnóstico respondeu ${resposta.status}: ${corpo.slice(0, 500)}`)
  }

  const arrayBuffer = await resposta.arrayBuffer()
  return { pdf: Buffer.from(arrayBuffer), s3Key: resposta.headers.get('X-Laudo-S3-Key') }
}

// Mesmo serviço, mesma validação, mesmo payload do diagnóstico (POST /apresentacao
// em vez de /laudo) — a apresentação comercial (deck de call 1:1, 22 telas)
// usa exatamente os mesmos dados de perfil, só personaliza um HTML
// diferente (services/laudo-pdf/vendor/vde-tribunais-call/deck.html). Ao
// contrário do diagnóstico, gerada só sob demanda pelo admin, nunca em background.
export async function gerarApresentacaoPdf(
  sessao: QuizSession,
  nivel: string,
  opts?: { salvarS3?: boolean },
): Promise<ResultadoDiagnostico> {
  const baseUrl = process.env.LAUDO_SERVICE_URL
  const segredo = process.env.LAUDO_SERVICE_SECRET
  if (!baseUrl || !segredo) {
    throw new DiagnosticoIndisponivel('LAUDO_SERVICE_URL e LAUDO_SERVICE_SECRET precisam estar definidos')
  }

  const payload = montarPayload(sessao, nivel)
  if (opts?.salvarS3) payload.session_token = sessao.sessionToken

  const resposta = await fetch(`${baseUrl.replace(/\/$/, '')}/apresentacao`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Laudo-Secret': segredo,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(55_000),
  })

  if (!resposta.ok) {
    const corpo = await resposta.text().catch(() => '')
    throw new DiagnosticoIndisponivel(`serviço de apresentação respondeu ${resposta.status}: ${corpo.slice(0, 500)}`)
  }

  const arrayBuffer = await resposta.arrayBuffer()
  return { pdf: Buffer.from(arrayBuffer), s3Key: resposta.headers.get('X-Apresentacao-S3-Key') }
}
