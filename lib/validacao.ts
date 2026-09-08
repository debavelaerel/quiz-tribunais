// Validação dos campos de identificação (capa/nome/contato) — puro, sem I/O.
// Mesma regra usada no cliente (feedback imediato, sem gastar uma
// requisição) e no servidor (fonte de verdade — nunca confia só no
// cliente), pra nunca ficarem dessincronizadas.

// Nome e sobrenome: pelo menos duas palavras não-vazias.
export function nomeValido(nome: string): boolean {
  return nome.trim().split(/\s+/).filter(Boolean).length >= 2
}

// E-mail em formato padrão: local@dominio.tld, sem espaço, TLD só com
// letras (2+). Não tenta cobrir todo o RFC 5322 — é validação de formulário,
// não parser de e-mail.
const REGEX_EMAIL = /^[\w.+-]+@(?:[\w-]+\.)+[a-zA-Z]{2,}$/

export function emailValido(email: string): boolean {
  return REGEX_EMAIL.test(email.trim())
}

// WhatsApp no padrão brasileiro: DDD (2 dígitos) + celular com o 9º dígito
// (9 dígitos) = exatamente 11 dígitos. Aceita qualquer formatação (parênteses,
// espaço, traço, +55 na frente é removido antes de contar).
export function whatsappValido(whatsapp: string): boolean {
  let digitos = whatsapp.replace(/\D/g, '')
  if (digitos.length === 13 && digitos.startsWith('55')) digitos = digitos.slice(2)
  return digitos.length === 11
}
