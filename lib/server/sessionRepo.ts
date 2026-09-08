import type { QuizSession } from './types'

export type FiltroListagem = {
  status?: 'em_andamento' | 'concluido'
  fluxo?: 'padrao' | 'final'
  // Substring, case-insensitive, casada contra nome OU email OU whatsapp.
  busca?: string
  pagina: number
  porPagina: number
}

export type ResultadoListagem = {
  sessoes: QuizSession[]
  total: number
}

export interface SessionRepo {
  buscarPorEmail(evento: string, emailNormalizado: string): Promise<QuizSession | null>
  buscarPorWhatsapp(evento: string, whatsappNormalizado: string): Promise<QuizSession | null>
  buscarPorToken(sessionToken: string): Promise<QuizSession | null>
  criar(sessao: Omit<QuizSession, 'id'>): Promise<QuizSession>
  atualizar(id: number, patch: Partial<QuizSession>): Promise<QuizSession>
  // Listagem paginada pro painel administrativo — ordenada sempre por
  // startedAt desc (mais recente primeiro). Não é usada por nenhuma rota
  // pública do quiz, só pelo /admin.
  listar(evento: string, filtro: FiltroListagem): Promise<ResultadoListagem>
}
