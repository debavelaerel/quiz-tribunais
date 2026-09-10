// As 4 áreas do teste graduado (ver lib/quizContent.ts, TESTE) na ordem
// fixa das questões (1-4) — usada tanto pelo radar do resultado (lead)
// quanto pelas colunas da ficha do lead (admin), pra manter os eixos/barras
// sempre na mesma posição independente da ordem que `resultado.areas` (um
// objeto) happens a iterar.
export const ORDEM_AREAS = [
  'Língua Portuguesa',
  'Direito Constitucional',
  'Direito Processual Civil',
  'Raciocínio Lógico',
] as const

// Nome curto pra caber em eixo de gráfico/rótulo pequeno — não é abreviação
// genérica (ex.: "Civil" perderia o sentido), é o nome mais curto que ainda
// identifica a área sem ambiguidade.
export const LABEL_CURTO_AREA: Record<string, string> = {
  'Língua Portuguesa': 'Português',
  'Direito Constitucional': 'Constitucional',
  'Direito Processual Civil': 'Processual',
  'Raciocínio Lógico': 'Raciocínio',
}
