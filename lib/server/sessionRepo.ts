import type { QuizSession } from './types'

export interface SessionRepo {
  buscarPorEmail(evento: string, emailNormalizado: string): Promise<QuizSession | null>
  buscarPorWhatsapp(evento: string, whatsappNormalizado: string): Promise<QuizSession | null>
  buscarPorToken(sessionToken: string): Promise<QuizSession | null>
  criar(sessao: Omit<QuizSession, 'id'>): Promise<QuizSession>
  atualizar(id: number, patch: Partial<QuizSession>): Promise<QuizSession>
}
