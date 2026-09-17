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

// Python usa `.format(**placeholders)`, que lança `KeyError` pra um marcador
// que não existe em `placeholders()` — não deixa o `{token}` passar
// silenciosamente. Espelhamos isso lançando também; os 46 blocos reais só
// usam `edital_label`, `edital_sub` e `disciplinas` (conferido contra
// `lib/data/blocos.json`), então isso nunca dispara hoje — só protege contra
// um marcador novo digitado errado em texto futuro.
function aplicarMarcadores(texto: string, marcadores: Record<string, string>): string {
  return texto.replace(/\{(\w+)\}/g, (m, chave) => {
    if (!(chave in marcadores)) throw new Error(`marcador desconhecido: ${chave}`)
    return marcadores[chave]
  })
}

// Espelha `resolve()` de rules.py: texto literal, ou "then"/"else" (vazio se
// "else" não existir) conforme a regra `if` bater.
function resolveParagrafo(p: Paragrafo, bateFn: (r: Regra | undefined) => boolean): string {
  if (typeof p === 'string') return p
  return bateFn(p.if) ? p.then : (p.else ?? '')
}

// Só os 4 grupos que existem no `EDITAIS` do pacote Python (`questions.py`:
// tj, trf, trt, fe). `lib/quizContent.ts` define um `EDITAIS.any` extra — uma
// lista sintética só pra UI do quiz (trt.slice(0,2) + trf + tj.slice(0,3)) —
// que NÃO existe na referência; se o motor de blocos indexasse `EDITAIS`
// direto, um lead com `alvo === 'any'` bateria nesse `any` da UI em vez de
// cair no fallback `trt` que o Python usa (`EDITAIS.get(alvo) or
// EDITAIS.get("trt", [])`), incluindo blocos que a referência nunca
// selecionaria pra esse lead (ex.: "mira", quando o único edital marcado é
// de um tribunal fora da lista `trt`).
export const EDITAIS_BASE = { tj: EDITAIS.tj, trf: EDITAIS.trf, trt: EDITAIS.trt, fe: EDITAIS.fe } as const

// Nota de fidelidade: esse é o único lookup do arquivo que precisa do
// cuidado `?.length` acima em vez de `??` — porque é o único ponto em que
// espelhamos um `dict.get(chave) or fallback` do Python contra uma chave que
// hoje pode mesmo mapear pra lista vazia (`alvo` fora de tj/trf/trt/fe). Os
// outros `??`/`?? ''` no arquivo (ex.: `primeiroEdital?.label ?? ''`,
// `p.else ?? ''`) são defaults de "campo ausente", não "campo presente mas
// vazio", então não têm essa armadilha — mas se um dia outro campo passar a
// mapear pra `[]` do mesmo jeito, vale checar de novo.

export function selecionarBlocos(perfil: RespostasPerfil, respostas: RespostaResumo[]): BlocoEscolhido[] {
  // `?.length` (não `??`) porque o `or` do Python também cai no fallback
  // quando a lista existe mas está vazia, não só quando a chave falta.
  const listaEditais = EDITAIS_BASE[perfil.alvo as keyof typeof EDITAIS_BASE]?.length
    ? EDITAIS_BASE[perfil.alvo as keyof typeof EDITAIS_BASE]
    : EDITAIS.trt
  const porId = new Map(listaEditais.map((e) => [e.id, e]))
  const editaisReais = (perfil.editais ?? [])
    .map((id) => porId.get(id))
    .filter((e): e is (typeof listaEditais)[number] => e !== undefined)

  const ctx: ContextoRegra = {
    perfil: perfil as unknown as Record<string, string>,
    // Python: `TEST[n]["gabarito"]` — n é sempre 0 a 3 (as 4 questões reais
    // do pacote; ver ENTREGA-DEV.md); fora disso o Python levanta
    // `IndexError`. `lib/blocos.ts` não importa `QUESTIONS` (só o teste
    // importa, pra decodificar os casos de aceite — ver Interfaces no
    // brief), então checamos contra a constante 0..3 em vez do tamanho real
    // do banco de questões.
    correct: (n) => {
      if (n < 0 || n > 3) throw new Error(`índice de questão fora do intervalo (0 a 3): ${n}`)
      return respostas.find((r) => r.num === n + 1)?.acertou ?? false
    },
    // Nota de fidelidade: Python soma `lead.correct(n)` só para `n` em
    // `range(len(TEST))`, isto é, exatamente as 4 questões reais — nunca
    // mais, nunca menos. Aqui contamos `acertou` em todo o array
    // `respostas` recebido; é equivalente sempre que o chamador (Task 3,
    // `quizService.concluirSessao`) passar exatamente as 4 respostas do
    // teste graduado, como o contrato de `RespostaResumo[]` pressupõe, mas
    // diverge se algum dia o array vier com itens extras ou duplicados.
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
