import type { RespostaResumo, AreaResumo } from '../scoring'
import type { RespostasPerfil, PerfilCalculado } from '../perfil'

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
  // Respostas de perfilamento do funil "Raio-X da Base" (alvo, cargo, formação,
  // editais escolhidos, etc.) — não graduadas, distintas de `respostas`/`areas`.
  perfil: RespostasPerfil
  perfilCalculado: PerfilCalculado | null
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
}
