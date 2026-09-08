import { createHmac, timingSafeEqual } from 'node:crypto'

// Autenticação do painel /admin: senha única (ADMIN_PASSWORD) + cookie
// httpOnly assinado com HMAC-SHA256 (ADMIN_SESSION_SECRET) — sem tabela de
// usuário, sem provedor externo. Tudo aqui é puro (recebe os segredos como
// parâmetro, não lê process.env diretamente) pra ser testável sem mock de
// ambiente; os call sites (middleware, rota de login) leem as env vars.

export const NOME_COOKIE_ADMIN = 'admin_session'
const UM_DIA_MS = 24 * 60 * 60 * 1000
const VALIDADE_MS = 7 * UM_DIA_MS

function assinar(payload: string, segredo: string): string {
  return createHmac('sha256', segredo).update(payload).digest('hex')
}

// Comparação em tempo constante — evita vazar, por timing, quanto da senha
// digitada bate com a real.
export function senhaConfere(digitada: string, esperada: string): boolean {
  const a = Buffer.from(digitada)
  const b = Buffer.from(esperada)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

// "<expiraEm>.<assinatura>" — sem dado de usuário nenhum dentro (senha
// única, não há "quem" pra guardar).
export function assinarSessao(segredo: string, agora: number = Date.now()): string {
  const expiraEm = agora + VALIDADE_MS
  const payload = String(expiraEm)
  return `${payload}.${assinar(payload, segredo)}`
}

export function verificarSessao(cookie: string | undefined | null, segredo: string, agora: number = Date.now()): boolean {
  if (!cookie) return false
  const [payload, assinatura] = cookie.split('.')
  if (!payload || !assinatura) return false
  const esperada = assinar(payload, segredo)
  if (!senhaConfere(assinatura, esperada)) return false
  const expiraEm = Number(payload)
  if (!Number.isFinite(expiraEm)) return false
  return agora < expiraEm
}
