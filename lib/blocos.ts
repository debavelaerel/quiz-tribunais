// Motor de seleção dos 46 blocos condicionais do laudo — porta operador-a-
// operador de `reference/raio-x-da-base/diagnosis/rules.py` (`matches`,
// `resolve`, `selected_blocks`), conforme ENTREGA-DEV.md, seção "Como avaliar
// uma regra". Não reescreve lógica de negócio: `calcularPerfil`, `DIAG` e
// `EDITAIS` continuam a fonte de verdade pro resto do funil.

import type { RespostasPerfil } from './perfil'
import type { RespostaResumo } from './scoring'
import { EDITAIS } from './quizContent'
import blocosDataRaw from './data/blocos.json'

export type Regra = {
  eq?: Record<string, string[]>
  ne?: Record<string, string[]>
  wrong?: number[]
  right?: number[]
  score_min?: number
  score_max?: number
  editais_min?: number
  any?: Regra[]
  not?: Regra
}

export type Paragrafo = string | { if: Regra; then: string; else?: string }
export type BlocoItem = { id: string; when: Regra; title: string; paragraphs: Paragrafo[] }
export type GrupoDeBlocos = { group: string; items: BlocoItem[] }
export type BlocoEscolhido = { id: string; group: string; title: string; paragraphs: string[] }

const BLOCOS = blocosDataRaw as GrupoDeBlocos[]

export type ContextoRegra = {
  perfil: Record<string, string>
  correct: (n: number) => boolean
  score: number
  qtdEditaisReais: number
}

// `matches()` em rules.py itera `cond.items()` numa única passada e resolve
// cada chave em sequência, lançando na primeira chave desconhecida que
// alcançar. Reproduzimos isso com um único loop sobre `Object.entries`, em
// vez de um `if` por chave seguido de uma varredura de chaves desconhecidas
// no fim — que teria uma ordem de avaliação diferente da do Python sempre
// que uma regra malformada combinasse uma chave desconhecida com uma chave
// válida que já falha (nesse caso o Python lança ou não dependendo de qual
// chave vem primeiro no JSON; um `if` por chave sempre falharia antes de
// checar chaves desconhecidas). Não afeta nenhum dos 46 blocos reais (todos
// bem formados), mas é o jeito fiel de portar.
export function bate(regra: Regra | undefined, ctx: ContextoRegra): boolean {
  if (!regra || Object.keys(regra).length === 0) return true

  for (const [chave, valor] of Object.entries(regra)) {
    switch (chave) {
      case 'eq': {
        const eq = valor as Record<string, string[]>
        if (!Object.entries(eq).every(([campo, vals]) => vals.includes(ctx.perfil[campo]))) return false
        break
      }
      case 'ne': {
        const ne = valor as Record<string, string[]>
        if (Object.entries(ne).some(([campo, vals]) => vals.includes(ctx.perfil[campo]))) return false
        break
      }
      case 'wrong': {
        const ns = valor as number[]
        if (!ns.every((n) => !ctx.correct(n))) return false
        break
      }
      case 'right': {
        const ns = valor as number[]
        if (!ns.every((n) => ctx.correct(n))) return false
        break
      }
      case 'score_min':
        if (ctx.score < (valor as number)) return false
        break
      case 'score_max':
        if (ctx.score > (valor as number)) return false
        break
      case 'editais_min':
        if (ctx.qtdEditaisReais < (valor as number)) return false
        break
      case 'any': {
        const opcoes = valor as Regra[]
        if (!opcoes.some((r) => bate(r, ctx))) return false
        break
      }
      case 'not':
        if (bate(valor as Regra, ctx)) return false
        break
      default:
        throw new Error(`regra desconhecida: ${chave}`)
    }
  }
  return true
}

function aplicarMarcadores(texto: string, marcadores: Record<string, string>): string {
  return texto.replace(/\{(\w+)\}/g, (m, chave) => marcadores[chave] ?? m)
}

// Espelha `resolve()` de rules.py: texto literal, ou "then"/"else" (vazio se
// "else" não existir) conforme a regra `if` bater.
function resolveParagrafo(p: Paragrafo, bateFn: (r: Regra | undefined) => boolean): string {
  if (typeof p === 'string') return p
  return bateFn(p.if) ? p.then : (p.else ?? '')
}

export function selecionarBlocos(perfil: RespostasPerfil, respostas: RespostaResumo[]): BlocoEscolhido[] {
  const listaEditais = EDITAIS[perfil.alvo ?? ''] ?? EDITAIS.trt
  const porId = new Map(listaEditais.map((e) => [e.id, e]))
  const editaisReais = (perfil.editais ?? [])
    .map((id) => porId.get(id))
    .filter((e): e is (typeof listaEditais)[number] => e !== undefined)

  const ctx: ContextoRegra = {
    perfil: perfil as unknown as Record<string, string>,
    correct: (n) => respostas.find((r) => r.num === n + 1)?.acertou ?? false,
    score: respostas.filter((r) => r.acertou).length,
    qtdEditaisReais: editaisReais.length,
  }
  const bateFn = (r: Regra | undefined) => bate(r, ctx)

  const primeiroEdital = editaisReais[0]
  const marcadores = {
    edital_label: primeiroEdital?.label ?? '',
    edital_sub: primeiroEdital?.sub ?? '',
    disciplinas: perfil.alvo === 'trt' ? 'as 12 disciplinas do TRT' : 'as 16 disciplinas de TJ e TRF',
  }

  const escolhidos: BlocoEscolhido[] = []
  for (const grupo of BLOCOS) {
    for (const item of grupo.items) {
      if (!bateFn(item.when)) continue
      // Igual a `selected_blocks()` em rules.py: resolve todos os parágrafos
      // primeiro, descarta os vazios (comparando o texto ainda sem
      // marcadores aplicados) e só então substitui os marcadores nos que
      // sobraram — nessa ordem, não na ordem inversa. Não afeta os 46
      // blocos reais (nenhum parágrafo é só um marcador isolado), mas é a
      // ordem fiel ao Python.
      const paragraphs = item.paragraphs
        .map((p) => resolveParagrafo(p, bateFn))
        .filter((t) => t.length > 0)
        .map((t) => aplicarMarcadores(t, marcadores))
      escolhidos.push({
        id: item.id,
        group: grupo.group,
        title: aplicarMarcadores(item.title, marcadores),
        paragraphs,
      })
      break
    }
  }
  return escolhidos
}
