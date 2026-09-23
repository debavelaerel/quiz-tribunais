// Rate-limit mínimo por chave (ex.: "start:<ip>"), em memória do processo.
// Escopo deliberadamente simples (spec: "não é proteção anti-bot sofisticada").
const janelas = new Map<string, { contagem: number; resetEm: number }>()

// Sem isso, `janelas` só cresce: toda chave (ex. um IP novo) que já passou
// da própria janela fica pra trás pra sempre, nunca é removida. Numa
// instância de Fluid Compute reaproveitada por muito tempo (várias
// requisições, muitos IPs diferentes), isso é um vazamento de memória lento.
// Varredura periódica (a cada N chamadas, não um setInterval) em vez de
// limpar a cada chamada — não vale o custo de iterar o Map inteiro toda
// vez só pra tirar pouca coisa.
const INTERVALO_LIMPEZA = 500
let chamadasDesdeLimpeza = 0

function limparExpiradas(agora: number): void {
  for (const [chave, janela] of janelas) {
    if (agora > janela.resetEm) janelas.delete(chave)
  }
}

export function permitirRequisicao(chave: string, limite: number, janelaMs: number): boolean {
  const agora = Date.now()

  chamadasDesdeLimpeza += 1
  if (chamadasDesdeLimpeza >= INTERVALO_LIMPEZA) {
    chamadasDesdeLimpeza = 0
    limparExpiradas(agora)
  }

  const atual = janelas.get(chave)
  if (!atual || agora > atual.resetEm) {
    janelas.set(chave, { contagem: 1, resetEm: agora + janelaMs })
    return true
  }
  if (atual.contagem >= limite) return false
  atual.contagem += 1
  return true
}

// Só pra rateLimit.test.ts inspecionar o tamanho do Map sem exportar ele
// inteiro — sem isso não dá pra provar que a limpeza periódica funciona
// de fora do módulo.
export function _tamanhoInternoParaTeste(): number {
  return janelas.size
}
