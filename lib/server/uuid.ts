// `session_token` é uma coluna `uuid` no Postgres: um valor fora do formato faz o
// PostgREST devolver erro 22P02 ("invalid input syntax for type uuid"), que viraria
// um 500 sem sentido. As rotas validam o formato antes de chegar no repositório.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}
