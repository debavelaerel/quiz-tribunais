import type { RespostaResumo, AreaResumo } from '../scoring'
import type { RespostasPerfil, PerfilCalculado } from '../perfil'
import type { BlocoEscolhido } from '../blocos'

export type QuizSession = {
  id: number
  sessionToken: string
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
