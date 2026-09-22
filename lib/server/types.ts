import type { RespostaResumo, AreaResumo } from '../scoring'
import type { RespostasPerfil, PerfilCalculado } from '../perfil'
import type { BlocoEscolhido } from '../blocos'

export type QuizSession = {
  id: number
  sessionToken: string
  // Identificador do link do laudo (/api/laudo/[token]) — ao contrário de
  // sessionToken, NUNCA muda depois de criado (sessionToken é reescrito toda
  // vez que a mesma pessoa retoma o quiz, ver iniciarSessao; um link pro CRM
  // baseado nele quebraria nesse momento). Gerado pelo banco
  // (`default gen_random_uuid()`) — nunca passado em `criar()`.
  laudoToken: string
  evento: string
  nome: string
  whatsapp: string
  whatsappNormalizado: string
  email: string
  emailNormalizado: string
  // Variante do funil que gerou a sessão — puramente informativa pro painel
  // administrativo, não afeta nenhuma regra de negócio.
  fluxo: 'padrao' | 'final'
  status: 'em_andamento' | 'concluido'
  respostas: RespostaResumo[]
  areas: Record<string, AreaResumo>
  scoreGeralPct: number | null
  acertos: number | null
  total: number | null
  areaPrioritaria: string | null
  // Respostas de perfilamento do funil "Diagnóstico da Base" (alvo, cargo, formação,
  // editais escolhidos, etc.) — não graduadas, distintas de `respostas`/`areas`.
  perfil: RespostasPerfil
  perfilCalculado: PerfilCalculado | null
  // Blocos de texto condicionais ("ponto a ponto") — null até a sessão
  // concluir. Ver lib/blocos.ts, selecionarBlocos().
  blocos: BlocoEscolhido[] | null
  // Horário do primeiro clique no CTA "Falar com o time no WhatsApp" na tela
  // de resultado — sinal de intenção de compra, não de diagnóstico. Só o
  // primeiro clique é gravado (ver registrarCliqueWhatsapp em quizService.ts).
  whatsappClicadoEm: string | null
  // Chave do objeto no S3 (não a URL — a URL assinada expira em até 7 dias,
  // a chave não). Gerado em background na conclusão (ver
  // lib/server/laudoPdfBackground.ts); null até terminar ou se a geração
  // falhar. /api/laudo/[token] usa essa chave pra montar a URL assinada na
  // hora de cada acesso.
  laudoPdfS3Key: string | null
  // Mensagem da última falha ao gerar/subir o laudo em background — só pra
  // diagnóstico (ver acima). null quando nunca falhou ou quando um sucesso
  // posterior limpou o valor.
  laudoPdfErro: string | null
  // Mesma ideia de laudoPdfS3Key/laudoPdfErro, mas pra apresentação comercial
  // (deck de call 1:1) — só que gerada sob demanda pelo admin, não em
  // background: fica null até alguém clicar "Baixar apresentação comercial"
  // pela primeira vez (ver app/api/admin/leads/[token]/apresentacao/route.ts).
  apresentacaoPdfS3Key: string | null
  apresentacaoPdfErro: string | null
  startedAt: string
  updatedAt: string
  completedAt: string | null
}

export type IniciarSessaoInput = {
  nome: string
  whatsapp: string
  email: string
  sessionToken: string
  evento: string
  // Opcional (default 'padrao' em iniciarSessao) pra não forçar todo call
  // site de teste a especificar algo irrelevante pro que cada um cobre.
  fluxo?: 'padrao' | 'final'
}

export type IniciarSessaoResultado = {
  sessionToken: string
  retomando: boolean
  respostasSalvas: RespostaResumo[]
  // A sessão retomada (por email/whatsapp) já estava concluída antes desta
  // chamada — sinaliza pro chamador não tentar regravar perfil/respostas
  // nem concluir de novo (o backend recusa mexer numa sessão fechada); ele
  // deve mostrar o resultado já existente em vez disso. Sempre false quando
  // a sessão é nova ou estava em_andamento.
  jaConcluida: boolean
}
