// Cálculo de perfil do funil "Raio-X da Base" — puro, sem I/O.
// Não é a nota do teste graduado (isso é lib/scoring.ts) — é a classificação
// de qualificação comercial (classe A/B, curso indicado, ritmo de estudo)
// a partir das respostas de perfilamento, não graduadas.

export type RespostasPerfil = {
  alvo?: string
  cargo?: string
  formacao?: string
  tempo?: string
  provas?: string
  metodo?: string
  vde?: string
  horas?: string
  edital?: string
  editais?: string[]
  dor?: string
  momento?: string
  dinheiro?: string
  leitura?: string
}

export type PerfilCalculado = {
  classe: 'A' | 'B'
  pontos: number
  curso: string
  cursoCod: 'C1-TRT' | 'C2-TJTRF'
  ritmo: string
}

const RITMOS_TRT: Record<string, string> = {
  h0: 'abaixo do ritmo mínimo; com 1h30 a base fecha em ~8 meses',
  h1: 'base em ~8 meses',
  h2: 'base em ~6 meses',
  h3: 'base em menos de 6 meses',
  h4: 'base em menos de 6 meses',
}

const RITMOS_TJTRF: Record<string, string> = {
  h0: 'abaixo do ritmo mínimo; com 1h30 a base fecha em ~12 meses',
  h1: 'base em ~12 meses',
  h2: 'base em ~8 meses',
  h3: 'base em ~6 meses',
  h4: 'base em ~6 meses',
}

export function calcularPerfil(r: RespostasPerfil, acertosTeste: number): PerfilCalculado {
  let pontos = 0
  if (r.cargo === 'analista' || r.cargo === 'oficial') pontos += 2
  else if (r.cargo === 'any' || r.cargo === 'unsure') pontos += 1
  else if (r.cargo === 'tecnico' && r.alvo !== 'tj') pontos += 1

  if (r.formacao === 'direito') pontos += 2
  else pontos += 1

  if (r.horas === 'h1') pontos += 1
  else if (r.horas === 'h2' || r.horas === 'h3' || r.horas === 'h4') pontos += 2

  if (r.edital === 'previsto' || r.edital === 'sem') pontos += 2
  else if (r.edital === 'nao') pontos += 1

  if (r.dor === 'base' || r.dor === 'improviso' || r.dor === 'banca' || r.dor === 'todas') pontos += 1

  const classe: 'A' | 'B' = pontos >= 7 ? 'A' : 'B'
  const curso1 = r.alvo === 'trt'
  const curso = curso1 ? 'Curso 1 · Analista de TRT (168 temas)' : 'Curso 2 · Analista de TJ e TRF (231 temas)'
  const cursoCod: 'C1-TRT' | 'C2-TJTRF' = curso1 ? 'C1-TRT' : 'C2-TJTRF'
  const ritmos = curso1 ? RITMOS_TRT : RITMOS_TJTRF
  const ritmo = (r.horas && ritmos[r.horas]) || ''

  // acertosTeste não entra na pontuação (o teste é diagnóstico, não classificatório
  // no funil original) — mantido como parâmetro explícito para deixar isso claro
  // no call site e permitir uso futuro sem mudar a assinatura.
  void acertosTeste

  return { classe, pontos, curso, cursoCod, ritmo }
}

export function nivelTeste(acertos: number): string {
  const niveis: Record<number, string> = { 0: 'inicial', 1: 'inicial', 2: 'intermediário', 3: 'avançado', 4: 'avançado' }
  return niveis[acertos] ?? 'inicial'
}

const ANOS_POR_TEMPO: Record<string, number> = { t0: 0, t1: 0.5, t2: 0.75, t3: 1.5, t4: 3, t5: 5 }
const ROTULO_POR_TEMPO: Record<string, string> = { t1: 'seis meses', t2: 'quase um ano', t3: 'um ano e meio', t4: 'três anos', t5: 'cinco anos' }

export type Conta = { titulo: string; paragrafo: string }

// Calculadora de custo da espera (tela "conta") — texto muda conforme o
// tempo de estudo já investido (retrospectivo) ou não (prospectivo).
export function calcularConta(r: RespostasPerfil): Conta {
  const anual = Number(r.dinheiro || 120)
  const anos = ANOS_POR_TEMPO[r.tempo ?? ''] ?? 0
  const rotulo = ROTULO_POR_TEMPO[r.tempo ?? ''] ?? ''
  const acumulado = Math.round(anual * anos)
  const retro = anos > 0

  if (retro) {
    return {
      titulo: 'O que a espera já te custou.',
      paragrafo: `Você estuda há ${rotulo}. Nesse tempo, a diferença entre o que você ganha hoje e o salário do cargo que você mira soma perto de R$ ${acumulado} mil que já não entraram na sua conta.`,
    }
  }
  return {
    titulo: 'O que a espera custa.',
    paragrafo: `Cada ano que você adia o começo custa cerca de R$ ${anual} mil, a diferença entre o que você ganha hoje e o salário do cargo que você mira.`,
  }
}
