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
      // Espelha `session_token uuid not null unique` da migration: sem isso, o fake
      // aceitaria colisões que o Postgres recusaria em produção.
      if (linhas.some((l) => l.sessionToken === sessao.sessionToken)) {
        throw new Error(`session_token duplicado: ${sessao.sessionToken}`)
      }
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
    async listar(evento, filtro) {
      let resultado = linhas.filter((l) => l.evento === evento)
      if (filtro.status) resultado = resultado.filter((l) => l.status === filtro.status)
      if (filtro.fluxo) resultado = resultado.filter((l) => l.fluxo === filtro.fluxo)
      if (filtro.busca) {
        const alvo = filtro.busca.toLowerCase()
        resultado = resultado.filter(
          (l) =>
            l.nome.toLowerCase().includes(alvo) ||
            l.email.toLowerCase().includes(alvo) ||
            l.whatsapp.toLowerCase().includes(alvo),
        )
      }
      // Mais recente primeiro, igual ao repo real (`order('started_at', desc)`).
      resultado = [...resultado].sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      const total = resultado.length
      const inicio = (filtro.pagina - 1) * filtro.porPagina
      const sessoes = resultado.slice(inicio, inicio + filtro.porPagina)
      return { sessoes, total }
    },
  }
}
