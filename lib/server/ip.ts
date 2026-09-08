// Extraído das 4 rotas /api/quiz/* que duplicavam essa mesma função —
// também usado agora por /api/admin/login pro rate-limit de tentativa de senha.
export function ipDaRequisicao(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'desconhecido'
}
