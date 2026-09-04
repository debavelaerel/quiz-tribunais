import type { RespostaResumo, AreaResumo } from '../scoring'

export type QuizSession = {
  id: number
  sessionToken: string
  evento: string
  nome: string
  whatsapp: string
  whatsappNormalizado: string
  email: string
  emailNormalizado: string
  status: 'em_andamento' | 'concluido'
  respostas: RespostaResumo[]
  areas: Record<string, AreaResumo>
  scoreGeralPct: number | null
  acertos: number | null
  total: number | null
  areaPrioritaria: string | null
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
}

export type IniciarSessaoResultado = {
  sessionToken: string
  retomando: boolean
  respostasSalvas: RespostaResumo[]
}
