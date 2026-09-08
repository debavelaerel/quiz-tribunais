// Rate-limit mínimo por chave (ex.: "start:<ip>"), em memória do processo.
// Escopo deliberadamente simples (spec: "não é proteção anti-bot sofisticada").
const janelas = new Map<string, { contagem: number; resetEm: number }>()

export function permitirRequisicao(chave: string, limite: number, janelaMs: number): boolean {
  const agora = Date.now()
  const atual = janelas.get(chave)
  if (!atual || agora > atual.resetEm) {
    janelas.set(chave, { contagem: 1, resetEm: agora + janelaMs })
    return true
  }
  if (atual.contagem >= limite) return false
  atual.contagem += 1
  return true
}
