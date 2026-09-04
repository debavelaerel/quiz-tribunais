export type EstadoQuiz = {
  sessionToken: string
  nome: string
  whatsapp: string
  email: string
}

const CHAVE = 'quiz-tribunais-comercial:v1'

export function carregarEstado(): EstadoQuiz | null {
  if (typeof window === 'undefined') return null
  try {
    const bruto = localStorage.getItem(CHAVE)
    if (!bruto) return null
    return JSON.parse(bruto) as EstadoQuiz
  } catch {
    return null
  }
}

export function salvarEstado(estado: EstadoQuiz): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado))
  } catch {
    // silencioso de propósito: falha ao persistir não deve travar o quiz
  }
}

export function limparEstado(): void {
  try {
    localStorage.removeItem(CHAVE)
  } catch {
    // idem
  }
}

export function criarNovoSessionToken(): string {
  return crypto.randomUUID()
}
