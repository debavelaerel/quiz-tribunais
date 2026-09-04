import type { SessionRepo } from '../sessionRepo'
import type { QuizSession } from '../types'

let proximoId = 1

export function criarFakeSessionRepo(): SessionRepo & { linhas: QuizSession[] } {
  const linhas: QuizSession[] = []

  return {
    linhas,
    async buscarPorEmail(evento, emailNormalizado) {
      return linhas.find((l) => l.evento === evento && l.emailNormalizado === emailNormalizado) ?? null
    },
    async buscarPorWhatsapp(evento, whatsappNormalizado) {
      return linhas.find((l) => l.evento === evento && l.whatsappNormalizado === whatsappNormalizado) ?? null
    },
    async buscarPorToken(sessionToken) {
      return linhas.find((l) => l.sessionToken === sessionToken) ?? null
    },
    async criar(sessao) {
      const nova: QuizSession = { ...sessao, id: proximoId++ }
      linhas.push(nova)
      return nova
    },
    async atualizar(id, patch) {
      const idx = linhas.findIndex((l) => l.id === id)
      if (idx === -1) throw new Error(`linha ${id} não encontrada`)
      linhas[idx] = { ...linhas[idx], ...patch, updatedAt: new Date().toISOString() }
      return linhas[idx]
    },
  }
}
