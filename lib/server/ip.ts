// Extraído das 4 rotas /api/quiz/* que duplicavam essa mesma função —
// também usado agora por /api/admin/login pro rate-limit de tentativa de senha.
//
// Pega o ÚLTIMO valor, não o primeiro: na Vercel (e em qualquer proxy que
// segue a convenção padrão de X-Forwarded-For), a borda ANEXA o IP real de
// quem conectou ao final do header — não substitui um valor que o próprio
// cliente já tenha mandado. Ler o índice 0 pegava o valor que o requisitante
// escolhe mandar (`X-Forwarded-For: 1.2.3.4`), não o IP real, deixando
// qualquer rate-limit por IP (inclusive o de tentativa de senha do /admin)
// trivialmente contornável com um header diferente a cada requisição.
export function ipDaRequisicao(req: Request): string {
  const partes = req.headers.get('x-forwarded-for')?.split(',').map((p) => p.trim()).filter(Boolean)
  return partes?.[partes.length - 1] ?? 'desconhecido'
}
