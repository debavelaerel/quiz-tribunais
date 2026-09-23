// Validação dos campos de identificação (capa/nome/contato) — puro, sem I/O.
// Mesma regra usada no cliente (feedback imediato, sem gastar uma
// requisição) e no servidor (fonte de verdade — nunca confia só no
// cliente), pra nunca ficarem dessincronizadas.

// Achado num teste de segurança: sem teto nenhum, um nome de centenas de KB
// passava de boa (rate-limit já existe, mas não é motivo pra aceitar
// qualquer tamanho). 200 é folgado pra qualquer nome de verdade, mesmo
// composto — não é um limite pensado pra apertar, só pra não aceitar lixo.
const TAMANHO_MAXIMO_NOME = 200

// Nome e sobrenome: pelo menos duas palavras não-vazias.
export function nomeValido(nome: string): boolean {
  const aparado = nome.trim()
  if (aparado.length > TAMANHO_MAXIMO_NOME) return false
  return aparado.split(/\s+/).filter(Boolean).length >= 2
}

// E-mail em formato padrão: local@dominio.tld, sem espaço, TLD só com
// letras (2+). Não tenta cobrir todo o RFC 5322 — é validação de formulário,
// não parser de e-mail.
const REGEX_EMAIL = /^[\w.+-]+@(?:[\w-]+\.)+[a-zA-Z]{2,}$/
// RFC 5321 §4.5.3.1.3: 254 é o teto prático de um endereço de e-mail
// inteiro (não só um número redondo escolhido à toa).
const TAMANHO_MAXIMO_EMAIL = 254

export function emailValido(email: string): boolean {
  const aparado = email.trim()
  if (aparado.length > TAMANHO_MAXIMO_EMAIL) return false
  return REGEX_EMAIL.test(aparado)
}

// WhatsApp no padrão brasileiro: DDD (2 dígitos) + celular com o 9º dígito
// (9 dígitos) = exatamente 11 dígitos. Aceita qualquer formatação (parênteses,
// espaço, traço, +55 na frente é removido antes de contar).
export function whatsappValido(whatsapp: string): boolean {
  let digitos = whatsapp.replace(/\D/g, '')
  if (digitos.length === 13 && digitos.startsWith('55')) digitos = digitos.slice(2)
  return digitos.length === 11
}
