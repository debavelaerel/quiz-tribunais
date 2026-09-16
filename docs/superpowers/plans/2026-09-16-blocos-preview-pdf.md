# Blocos, Preview com Blur e PDF do Laudo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar ao app "Diagnóstico da Base" (já em produção) os 46 blocos de texto condicionais do pacote `raio-x-da-base` ("ponto a ponto"), mostrá-los na tela de resultado como prévia com blur + CTA, gerar o laudo completo em PDF sob demanda, e exibi-lo no painel admin.

**Architecture:** Este plano estende um app Next.js já existente e maduro — não cria nada do zero. Reaproveita a arquitetura de repositório já em uso (`SessionRepo`/`quizService.ts`, testável com um repo falso em memória, sem precisar de Supabase local pros testes de lógica) e os tipos/funções já implementados (`calcularPerfil`, `DIAG`, `EDITAIS`, `QUESTIONS`). O único motor novo é o dos 46 blocos — um interpretador genérico de regras (`eq`/`ne`/`wrong`/`right`/`score_min`/`score_max`/`editais_min`/`any`/`not`) que lê os dados do pacote, mesma técnica generalista do Python de referência.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, Supabase, Vitest (já configurado no projeto). Adiciona: Playwright (só pro serviço de PDF).

**Spec:** `docs/superpowers/specs/2026-09-16-resultado-laudo-preview-admin-design.md` — mas **leia com a ressalva abaixo**: essa spec foi escrita assumindo um repositório vazio, antes de se descobrir que o app "Diagnóstico da Base" já existe em produção (`origin/main`, 19 PRs mergeados) e já implementa a maior parte do que a spec desenhava do zero (dedupe, sessão, perfil, classe/curso/ritmo, painel admin, auth). Este plano é o que vale — ele descreve com precisão o que falta em cima do código real.

## Global Constraints

- **Fidelidade dos dados e da lógica dos blocos: 100%.** Os 46 blocos (`id`, `when`, `title`, `paragraphs`) vêm do pacote `raio-x-da-base` (`diagnosis.json`, campo `blocos`) e são copiados **sem editar** — nunca reescrever, resumir ou "melhorar" o texto. O motor de regras precisa produzir, pros 8 casos de `casos-de-teste.json`, exatamente a mesma lista de ids de blocos, na mesma ordem, que o `esperado.blocos` de cada caso.
- **Paleta visual: a do app, não a do pacote.** O CSS do pacote usa lilás/roxo (`--lav`, `--purple`) — o `DESIGN.md` do app documenta que o time testou e rejeitou essas cores de propósito. Toda UI nova (seção de blocos, PDF) usa os tokens já existentes em `app/globals.css`/Tailwind (`brand-ink`, `brand-gold`, `brand-gold-deep`, `brand-tint`, `brand-line`, `brand-card`) — decisão confirmada com o cliente depois de comparar as duas em mockup.
- **Nunca reescrever conteúdo que já existe em outro lugar.** `DIAG`, `EDITAIS`, `QUESTIONS`, `calcularPerfil` já existem e já são a fonte de verdade — este plano só adiciona o que falta (blocos), nunca duplica.
- **Servidor sempre recalcula.** Os blocos são calculados em `concluirSessao()` (server-side), nunca aceitos do cliente — mesmo princípio já em uso no resto do `quizService.ts`.
- **Sessão concluída é imutável** — já garantido pelo `quizService.ts` existente; nenhuma mudança deste plano pode contornar isso.
- **Rotas `/api/admin/*` já são protegidas** pelo `middleware.ts` existente (cookie de sessão admin) — uma rota nova sob esse prefixo herda a proteção automaticamente, sem código extra.

---

## File Structure

```
vicio_quiz/  (branch worktree-beta — código real, não é um repo novo)
  reference/raio-x-da-base/          # pacote original, íntegro (novo)
  lib/
    data/
      blocos.json                    # extraído de diagnosis.json (novo)
      casos-de-teste.json            # copiado do pacote, só para teste (novo)
    blocos.ts                        # motor de seleção dos 46 blocos (novo)
    blocos.test.ts                   # TDD: operadores + 8 casos de aceite (novo)
    perfil.ts                        # existente — não muda
    quizContent.ts                   # existente — não muda (fonte de EDITAIS/DIAG)
    server/
      types.ts                       # +campo `blocos` (modificado)
      supabaseSessionRepo.ts         # +mapeamento da coluna `blocos` (modificado)
      quizService.ts                 # concluirSessao() passa a calcular blocos (modificado)
      pdf.ts                         # gera o HTML do laudo + chama Playwright (novo)
      pdf.test.ts                    # teste do HTML gerado, sem abrir browser (novo)
  supabase/migrations/
    <timestamp>_quiz_sessions_blocos.sql   # coluna nova (novo)
  app/
    api/
      quiz/finish/route.ts           # +`blocos` na resposta (modificado)
      quiz/result/route.ts           # +`blocos` na resposta (modificado)
      admin/leads/[token]/pdf/route.ts  # gera e devolve o PDF (novo)
    admin/(painel)/leads/[token]/page.tsx  # +blocos completos +botão baixar PDF (modificado)
  components/
    Quiz.tsx                         # +seção "ponto a ponto" com blur +copy do CTA (modificado)
```

---

## Task 1: Trazer o pacote e extrair os dados dos 46 blocos

**Files:**
- Create: `reference/raio-x-da-base/` (pacote completo)
- Create: `lib/data/blocos.json`
- Create: `lib/data/casos-de-teste.json`

**Interfaces:**
- Produces: `lib/data/blocos.json` (array de grupos `{group, items: [{id, when, title, paragraphs}]}`) e `lib/data/casos-de-teste.json`, consumidos pela Task 2.

- [ ] **Step 1: Extrair o pacote**

```bash
mkdir -p /tmp/raio-x-extraido
unzip -o -q ~/Downloads/raio-x-da-base-dev.zip -d /tmp/raio-x-extraido
mkdir -p reference
cp -r /tmp/raio-x-extraido/raio-x-da-base reference/raio-x-da-base
```

- [ ] **Step 2: Extrair só o campo `blocos` de `diagnosis.json`**

O `diagnosis.json` inteiro tem muito mais do que este plano precisa (perguntas, curso, ritmo — tudo isso já existe no app). Extrai só o array `blocos`:

```bash
mkdir -p lib/data
node -e "
const d = require('./reference/raio-x-da-base/diagnosis.json');
require('fs').writeFileSync('lib/data/blocos.json', JSON.stringify(d.blocos, null, 2) + '\n');
"
cp reference/raio-x-da-base/casos-de-teste.json lib/data/casos-de-teste.json
```

- [ ] **Step 3: Verificar a extração**

```bash
node -e "
const blocos = require('./lib/data/blocos.json');
const original = require('./reference/raio-x-da-base/diagnosis.json').blocos;
console.assert(JSON.stringify(blocos) === JSON.stringify(original), 'blocos.json diverge do original');
console.assert(blocos.length === 12, \`esperava 12 grupos, achou \${blocos.length}\`);
console.log('OK —', blocos.length, 'grupos de blocos extraídos sem diferença do original');
"
```

Expected: imprime `OK — 12 grupos de blocos extraídos sem diferença do original`, sem erro de assert.

- [ ] **Step 4: Commit**

```bash
git add reference/raio-x-da-base lib/data/blocos.json lib/data/casos-de-teste.json
git commit -m "chore: trazer o pacote raio-x-da-base e extrair os dados dos 46 blocos"
```

---

## Task 2: Motor de seleção de blocos (`lib/blocos.ts`)

Porta o avaliador genérico de regras do pacote (`ENTREGA-DEV.md`, seção "Como avaliar uma regra"; `diagnosis/rules.py`, função `matches()`) — mesma semântica, sem reescrever a lógica de negócio existente (`calcularPerfil`, `DIAG`, `EDITAIS` continuam sendo a fonte de verdade pro resto).

**Files:**
- Create: `lib/blocos.ts`
- Test: `lib/blocos.test.ts`

**Interfaces:**
- Consumes: `RespostasPerfil` (`lib/perfil.ts`), `RespostaResumo` (`lib/scoring.ts`), `EDITAIS` (`lib/quizContent.ts`), `QUESTIONS` (`lib/questions.ts`, só no teste, pra decodificar os casos de aceite).
- Produces: `bate(regra, ctx): boolean`, `selecionarBlocos(perfil: RespostasPerfil, respostas: RespostaResumo[]): BlocoEscolhido[]` — usado pela Task 3 (`quizService.concluirSessao`).

- [ ] **Step 1: Escrever os testes do avaliador de regras (falhando)**

Crie `lib/blocos.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { bate, selecionarBlocos } from './blocos'
import { QUESTIONS } from './questions'
import casosDeTesteRaw from './data/casos-de-teste.json'
import type { RespostasPerfil } from './perfil'
import type { RespostaResumo } from './scoring'

type CasoDeAceite = {
  id: string
  resumo: string
  entrada: { codigo: string }
  esperado: { blocos: string[] }
}
const casosDeTeste = casosDeTesteRaw as { casos: CasoDeAceite[] }

const CAMPOS_PERFIL = [
  'alvo', 'cargo', 'formacao', 'tempo', 'provas', 'metodo', 'vde',
  'horas', 'edital', 'dor', 'momento', 'dinheiro', 'leitura',
] as const

// Decodifica o código RX1 dos casos de teste do pacote — só usado aqui, pra
// alimentar o motor com os mesmos leads de exemplo que geraram os 8 PDFs.
function decodeRX1(codigo: string): { perfil: RespostasPerfil; respostas: RespostaResumo[] } {
  const partes = codigo.trim().split('.')
  if (partes[0] !== 'RX1') throw new Error(`código inválido: ${codigo}`)
  const perfilPartes = partes.slice(1, 1 + CAMPOS_PERFIL.length)
  const perfil = {} as RespostasPerfil
  CAMPOS_PERFIL.forEach((campo, i) => {
    ;(perfil as Record<string, string>)[campo] = perfilPartes[i]
  })

  const testeStr = partes[1 + CAMPOS_PERFIL.length]
  const respostas: RespostaResumo[] = Array.from(testeStr).map((letra, i) => {
    const q = QUESTIONS[i]
    return { num: q.num, area: q.area, escolhida: letra === '-' ? '' : letra, gabarito: q.correct, acertou: letra === q.correct }
  })

  const editaisStr = partes[2 + CAMPOS_PERFIL.length]
  perfil.editais = editaisStr ? editaisStr.split('-').filter(Boolean) : []

  return { perfil, respostas }
}

const ctxBase = {
  perfil: { alvo: 'trt', cargo: 'analista' },
  correct: (n: number) => [true, false, true, false][n],
  score: 2,
  qtdEditaisReais: 1,
}

describe('bate', () => {
  it('regra vazia ou ausente bate sempre', () => {
    expect(bate(undefined, ctxBase)).toBe(true)
    expect(bate({}, ctxBase)).toBe(true)
  })

  it('eq: bate quando o valor do campo está na lista', () => {
    expect(bate({ eq: { alvo: ['trt', 'tj'] } }, ctxBase)).toBe(true)
    expect(bate({ eq: { alvo: ['tj'] } }, ctxBase)).toBe(false)
  })

  it('eq com múltiplos campos: precisa bater em todos (E)', () => {
    expect(bate({ eq: { alvo: ['trt'], cargo: ['analista'] } }, ctxBase)).toBe(true)
    expect(bate({ eq: { alvo: ['trt'], cargo: ['tecnico'] } }, ctxBase)).toBe(false)
  })

  it('ne: bate quando o valor do campo NÃO está na lista', () => {
    expect(bate({ ne: { alvo: ['tj'] } }, ctxBase)).toBe(true)
    expect(bate({ ne: { alvo: ['trt'] } }, ctxBase)).toBe(false)
  })

  it('wrong: bate quando errou a questão n', () => {
    expect(bate({ wrong: [1] }, ctxBase)).toBe(true)
    expect(bate({ wrong: [0] }, ctxBase)).toBe(false)
  })

  it('right: bate quando acertou a questão n', () => {
    expect(bate({ right: [0, 2] }, ctxBase)).toBe(true)
    expect(bate({ right: [0, 1] }, ctxBase)).toBe(false)
  })

  it('score_min / score_max', () => {
    expect(bate({ score_min: 2 }, ctxBase)).toBe(true)
    expect(bate({ score_min: 3 }, ctxBase)).toBe(false)
    expect(bate({ score_max: 2 }, ctxBase)).toBe(true)
    expect(bate({ score_max: 1 }, ctxBase)).toBe(false)
  })

  it('editais_min', () => {
    expect(bate({ editais_min: 1 }, ctxBase)).toBe(true)
    expect(bate({ editais_min: 2 }, ctxBase)).toBe(false)
  })

  it('any: basta uma regra bater', () => {
    expect(bate({ any: [{ eq: { alvo: ['tj'] } }, { eq: { alvo: ['trt'] } }] }, ctxBase)).toBe(true)
    expect(bate({ any: [{ eq: { alvo: ['tj'] } }, { eq: { alvo: ['trf'] } }] }, ctxBase)).toBe(false)
  })

  it('not: a regra de dentro não pode bater', () => {
    expect(bate({ not: { eq: { alvo: ['tj'] } } }, ctxBase)).toBe(true)
    expect(bate({ not: { eq: { alvo: ['trt'] } } }, ctxBase)).toBe(false)
  })

  it('chaves diferentes no mesmo objeto são somadas (E)', () => {
    expect(bate({ eq: { alvo: ['trt'] }, score_min: 2 }, ctxBase)).toBe(true)
    expect(bate({ eq: { alvo: ['trt'] }, score_min: 3 }, ctxBase)).toBe(false)
  })

  it('regra com chave desconhecida lança erro, igual ao rules.py de referência', () => {
    expect(() => bate({ chave_que_nao_existe: true } as never, ctxBase)).toThrow()
  })
})

describe('selecionarBlocos — os 8 casos de aceite do pacote raio-x-da-base', () => {
  for (const caso of casosDeTeste.casos) {
    it(`caso ${caso.id}: ${caso.resumo}`, () => {
      const { perfil, respostas } = decodeRX1(caso.entrada.codigo)
      const blocos = selecionarBlocos(perfil, respostas)
      expect(blocos.map((b) => b.id)).toEqual(caso.esperado.blocos)
    })
  }
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- lib/blocos.test`
Expected: FAIL — `lib/blocos.ts` não existe ainda.

- [ ] **Step 3: Implementar `lib/blocos.ts`**

```ts
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

const CHAVES_CONHECIDAS = new Set([
  'eq', 'ne', 'wrong', 'right', 'score_min', 'score_max', 'editais_min', 'any', 'not',
])

export function bate(regra: Regra | undefined, ctx: ContextoRegra): boolean {
  if (!regra || Object.keys(regra).length === 0) return true

  if (regra.eq) {
    for (const [campo, vals] of Object.entries(regra.eq)) {
      if (!vals.includes(ctx.perfil[campo])) return false
    }
  }
  if (regra.ne) {
    for (const [campo, vals] of Object.entries(regra.ne)) {
      if (vals.includes(ctx.perfil[campo])) return false
    }
  }
  if (regra.wrong) {
    for (const n of regra.wrong) if (ctx.correct(n)) return false
  }
  if (regra.right) {
    for (const n of regra.right) if (!ctx.correct(n)) return false
  }
  if (regra.score_min !== undefined && ctx.score < regra.score_min) return false
  if (regra.score_max !== undefined && ctx.score > regra.score_max) return false
  if (regra.editais_min !== undefined && ctx.qtdEditaisReais < regra.editais_min) return false
  if (regra.any && !regra.any.some((r) => bate(r, ctx))) return false
  if (regra.not && bate(regra.not, ctx)) return false

  for (const chave of Object.keys(regra)) {
    if (!CHAVES_CONHECIDAS.has(chave)) throw new Error(`regra desconhecida: ${chave}`)
  }
  return true
}

function aplicarMarcadores(texto: string, marcadores: Record<string, string>): string {
  return texto.replace(/\{(\w+)\}/g, (m, chave) => marcadores[chave] ?? m)
}

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
      const paragraphs = item.paragraphs
        .map((p) => aplicarMarcadores(resolveParagrafo(p, bateFn), marcadores))
        .filter((t) => t.length > 0)
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
```

`correct(n)`: `n` é o índice 0-based do pacote (`teste[0..3]`); `QUESTIONS`/`RespostaResumo.num` no app já é 1-based (`lib/questions.ts`: `num: i + 1`) — por isso `r.num === n + 1`.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- lib/blocos.test`
Expected: PASS (12 testes de `bate` + 8 casos de aceite = 20 testes).

Se um dos 8 casos falhar, o array de ids que diverge aponta exatamente onde — compare a regra do bloco em `lib/data/blocos.json` (mesmo id) com `reference/raio-x-da-base/diagnosis/blocks.py`.

- [ ] **Step 5: Commit**

```bash
git add lib/blocos.ts lib/blocos.test.ts
git commit -m "feat: motor de seleção dos 46 blocos, validado contra os 8 casos de aceite"
```

---

## Task 3: Persistir os blocos escolhidos na sessão

**Files:**
- Create: `supabase/migrations/<timestamp>_quiz_sessions_blocos.sql`
- Modify: `lib/server/types.ts`
- Modify: `lib/server/supabaseSessionRepo.ts`
- Modify: `lib/server/quizService.ts`
- Modify: `app/api/quiz/finish/route.ts`
- Modify: `app/api/quiz/result/route.ts`
- Modify: `lib/server/quizService.test.ts`

**Interfaces:**
- Consumes: `selecionarBlocos`, `BlocoEscolhido` (Task 2).
- Produces: `QuizSession.blocos: BlocoEscolhido[] | null`, populado por `concluirSessao()`, devolvido por `/api/quiz/finish` e `/api/quiz/result`. Consumido pela Task 4 (tela de resultado) e Task 6 (admin).

- [ ] **Step 1: Migration**

Crie `supabase/migrations/20260917000001_quiz_sessions_blocos.sql` (timestamp depois da última migration existente, `20260909210000_...`):

```sql
-- Blocos de texto condicionais ("ponto a ponto") escolhidos pra essa sessão,
-- calculados em concluirSessao() a partir de perfil + respostas graduadas —
-- ver lib/blocos.ts, selecionarBlocos(). Fica null enquanto em_andamento.
alter table quiz_sessions
  add column blocos jsonb;
```

- [ ] **Step 2: Escrever o teste (falhando) de que `concluirSessao` grava os blocos**

Em `lib/server/quizService.test.ts`, no `describe('concluirSessao', ...)` já existente, adicione (ajuste o `it` mais próximo de um caso feliz já existente pra copiar o setup de perfil+respostas completas que já está lá; se não achar um pronto, monte um novo com um `alvo` que tenha pelo menos um grupo de blocos batendo, ex. `alvo: 'trt'`):

```ts
it('calcula e grava os blocos escolhidos', async () => {
  const repo = criarFakeSessionRepo()
  await iniciarSessao(repo, { nome: 'Ana', whatsapp: '11987654321', email: 'ana@x.com', sessionToken: 'tok-blocos', evento: EVENTO })
  await registrarPerfil(repo, 'tok-blocos', {
    alvo: 'trt', cargo: 'analista', formacao: 'direito', tempo: 't2', provas: 'p1',
    metodo: 'video', vde: 'as_vezes', horas: 'h2', edital: 'sem', dor: 'base',
    momento: 'zero', dinheiro: '150', leitura: 'basica', editais: [],
  })
  await registrarRespostasLote(repo, 'tok-blocos', [
    { num: 1, escolhida: 'C' }, { num: 2, escolhida: 'A' }, { num: 3, escolhida: 'A' }, { num: 4, escolhida: 'A' },
  ])

  const sessao = await concluirSessao(repo, 'tok-blocos')
  expect(sessao.blocos).not.toBeNull()
  expect(sessao.blocos!.length).toBeGreaterThan(0)
})
```

Ajuste as respostas do "teste" (`num`/`escolhida`) e os campos de perfil pros valores realmente válidos — confira as opções aceitas em `lib/perfil.ts`/`lib/quizContent.ts` (`L`) antes de rodar; o objetivo é só ter uma sessão completa e válida, o conteúdo exato dos blocos não importa aqui (isso já está coberto pelos 8 casos de aceite da Task 2).

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npm test -- lib/server/quizService.test`
Expected: FAIL — `sessao.blocos` é `undefined` (campo ainda não existe no tipo/serviço).

- [ ] **Step 4: Adicionar o campo ao tipo `QuizSession`**

Em `lib/server/types.ts`, adicione o import e o campo:

```ts
import type { BlocoEscolhido } from '../blocos'
```

E no `type QuizSession`, logo após `perfilCalculado: PerfilCalculado | null`:

```ts
  // Blocos de texto condicionais ("ponto a ponto") — null até a sessão
  // concluir. Ver lib/blocos.ts, selecionarBlocos().
  blocos: BlocoEscolhido[] | null
```

- [ ] **Step 5: Mapear a coluna no repo do Supabase**

Em `lib/server/supabaseSessionRepo.ts`:

- No `type LinhaBanco`, logo após `perfil_calculado: QuizSession['perfilCalculado']`, adicione: `blocos: QuizSession['blocos']`
- Em `paraSessao`, logo após `perfilCalculado: linha.perfil_calculado,`, adicione: `blocos: linha.blocos,`
- Em `paraLinhaPatch`, logo após `if (patch.perfilCalculado !== undefined) linha.perfil_calculado = patch.perfilCalculado`, adicione: `if (patch.blocos !== undefined) linha.blocos = patch.blocos`

- [ ] **Step 6: Inicializar `blocos: null` ao criar a sessão**

Em `lib/server/quizService.ts`, função `iniciarSessao`, encontre a linha `perfilCalculado: null,` (dentro do objeto passado pra `repo.criar(...)`) e adicione logo abaixo: `blocos: null,`

- [ ] **Step 7: Calcular os blocos em `concluirSessao`**

Em `lib/server/quizService.ts`, adicione o import:

```ts
import { selecionarBlocos } from '../blocos'
```

E dentro de `concluirSessao`, depois da linha `const perfilCalculado = calcularPerfil(sessao.perfil, resultado.acertos)`, adicione:

```ts
  const blocos = selecionarBlocos(sessao.perfil, sessao.respostas)
```

E no objeto passado pra `repo.atualizar(sessao.id, { ... })`, adicione `blocos,` (junto de `perfilCalculado,`).

- [ ] **Step 8: Rodar e confirmar que passa**

Run: `npm test -- lib/server/quizService.test`
Expected: PASS.

- [ ] **Step 9: Expor `blocos` nas duas rotas públicas**

Em `app/api/quiz/finish/route.ts`, no corpo do `NextResponse.json({...})` de sucesso, adicione `blocos: sessao.blocos,`.

Em `app/api/quiz/result/route.ts`, no corpo do `NextResponse.json({...})`, adicione `blocos: sessao.blocos,`.

- [ ] **Step 10: Rodar a suíte inteira e commitar**

```bash
npm test
git add supabase/migrations/20260917000001_quiz_sessions_blocos.sql lib/server/types.ts lib/server/supabaseSessionRepo.ts lib/server/quizService.ts lib/server/quizService.test.ts app/api/quiz/finish/route.ts app/api/quiz/result/route.ts
git commit -m "feat: persistir e expor os blocos calculados na sessão"
```

Se estiver rodando com Supabase local, aplique a migration antes de testar em produção/preview:

```bash
npx supabase db push
```

---

## Task 4: Seção "resposta por resposta" com blur na tela de resultado

O resultado hoje já é 100% revelado (gauge, radar, diagnóstico, plano de ação) — isso **não muda**. Só a seção nova (os blocos) entra com blur: o primeiro bloco visível (gancho), o resto borrado, mesmo tratamento aprovado no mockup. Sem esconder o texto do servidor (o app já não faz esse tipo de proteção em nenhuma outra tela do resultado) — é só CSS, consistente com o resto do produto.

**Files:**
- Modify: `components/Quiz.tsx`

**Interfaces:**
- Consumes: `blocos` no objeto `resultado` (Task 3) — precisa ser adicionado ao tipo local que representa a resposta de `/finish` e `/result` nesse componente.

- [ ] **Step 1: Estender o tipo local do resultado**

Rode `grep -n "type Resultado" components/Quiz.tsx` (ou busca equivalente) pra achar a definição do tipo que guarda a resposta de `/api/quiz/finish`/`/api/quiz/result` nesse componente. Adicione um campo:

```ts
blocos: { id: string; group: string; title: string; paragraphs: string[] }[] | null
```

- [ ] **Step 2: Popular o campo nos dois pontos que constroem esse objeto**

Rode `grep -n "setResultado(" components/Quiz.tsx` — são dois pontos: um na conclusão normal (resposta de `POST /api/quiz/finish`) e um na retomada de resultado já existente (resposta de `GET /api/quiz/result`, tela reaberta após F5). Em ambos, adicione `blocos: dados.blocos` (ou o nome que a variável da resposta JSON tiver nesse ponto) ao objeto passado pra `setResultado`.

- [ ] **Step 3: Rodar os testes existentes do componente antes de mexer no JSX**

```bash
npm test -- components/Quiz.test
```

Expected: PASS (garante que a extração de tipo não quebrou nada antes de editar o JSX).

- [ ] **Step 4: Adicionar a seção no JSX**

Em `components/Quiz.tsx`, dentro do bloco `{resultado && (<> ... </>)}` da tela de resultado, logo depois do trecho:

```tsx
              {diagnostico && (
                <>
                  <h3 className="mt-7 font-bold text-brand-navy">Por que essa ordem</h3>
                  {diagnostico.texto.map((t, i) => (
                    <p key={i} className="mt-2 text-brand-ink-soft">{t}</p>
                  ))}
                </>
              )}
```

(e antes do `{frases.map(...)}` que vem em seguida), insira:

```tsx
              {resultado.blocos && resultado.blocos.length > 0 && (
                <div className="mt-7">
                  <h3 className="font-bold text-brand-navy">Resposta por resposta</h3>
                  <p className="mt-2 text-brand-ink-soft">Isso aqui é o que você me contou, ponto a ponto.</p>

                  <div className="mt-3 rounded-[16px] border-[1.5px] border-brand-line px-4 py-4">
                    <h4 className="pl-3 text-[14.5px] font-semibold text-brand-ink" style={{ borderLeft: '3px solid #203C7C' }}>
                      {resultado.blocos[0].title}
                    </h4>
                    {resultado.blocos[0].paragraphs.map((p, i) => (
                      <p key={i} className="mt-2 text-[13px] leading-relaxed text-brand-ink-soft">{p}</p>
                    ))}
                  </div>

                  {resultado.blocos.length > 1 && (
                    <div className="relative mt-2.5">
                      <div className="flex select-none flex-col gap-2.5" style={{ filter: 'blur(5px)' }}>
                        {resultado.blocos.slice(1).map((b) => (
                          <div key={b.id} className="rounded-[16px] border-[1.5px] border-brand-line px-4 py-4">
                            <h4 className="pl-3 text-[14.5px] font-semibold text-brand-ink" style={{ borderLeft: '3px solid #203C7C' }}>
                              {b.title}
                            </h4>
                            {b.paragraphs.map((p, i) => (
                              <p key={i} className="mt-2 text-[13px] leading-relaxed text-brand-ink-soft">{p}</p>
                            ))}
                          </div>
                        ))}
                      </div>
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-white" style={{ backgroundImage: 'linear-gradient(to bottom, rgba(255,255,255,0), #FFFFFF 82%)' }} />
                    </div>
                  )}
                </div>
              )}
```

- [ ] **Step 5: Ajustar a copy do CTA pra mencionar o PDF**

No parágrafo que já existe logo antes do botão do WhatsApp (o que começa com "Este diagnóstico leu o seu caso por cima..."), troque o texto pra também citar o laudo completo em PDF — mantendo a chamada pra call de 20 minutos que **já existe** nesse parágrafo:

```tsx
              <p className="mt-4 text-brand-ink-soft">
                Este diagnóstico leu o seu caso por cima, com o que dá pra ler em doze perguntas e quatro questões. O seu caso tem os requisitos pra ir mais fundo: uma <b className="text-brand-ink">conversa de uns 20 minutos com um consultor do meu time</b>, que cruza o que você respondeu com o edital de {alvoLongo} e monta o seu plano de ação — e te manda, pelo WhatsApp, o seu laudo completo em PDF, com todos os pontos acima destravados.
              </p>
```

- [ ] **Step 6: Rodar os testes do componente e confirmar visualmente no navegador**

```bash
npm test -- components/Quiz.test
npm run dev
```

Complete um diagnóstico até o fim no navegador e confirme: o primeiro bloco aparece legível, os demais aparecem borrados com um gradiente suave até sumir, e o parágrafo do CTA menciona o PDF.

- [ ] **Step 7: Commit**

```bash
git add components/Quiz.tsx
git commit -m "feat: seção 'resposta por resposta' com blur na tela de resultado"
```

---

## Task 5: Serviço de geração de PDF sob demanda

Gera o laudo completo (tudo que já existe + os blocos novos) em PDF, quando alguém pede — nunca salvo como arquivo, sempre recalculado a partir dos dados da sessão. Usa a mesma paleta do app (não a do pacote).

**Files:**
- Modify: `package.json` (+`playwright`)
- Create: `lib/server/pdf.ts`
- Test: `lib/server/pdf.test.ts`
- Create: `app/api/admin/leads/[token]/pdf/route.ts`

**Interfaces:**
- Consumes: `QuizSession` (Task 3, já com `blocos` populado).
- Produces: `montarHtmlLaudo(sessao: QuizSession, nivel: string): string`, `gerarPdfLaudo(sessao: QuizSession, nivel: string): Promise<Buffer>` — a segunda é usada pela rota admin.

- [ ] **Step 1: Instalar o Playwright**

```bash
npm install playwright
npx playwright install --with-deps chromium
```

- [ ] **Step 2: Escrever o teste do HTML gerado (falhando)**

O teste cobre `montarHtmlLaudo` (string, sem abrir browser — rápido) e deixa `gerarPdfLaudo` (que abre o Chromium) fora da suíte padrão, chamada manualmente na Step 6. Crie `lib/server/pdf.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { montarHtmlLaudo } from './pdf'
import type { QuizSession } from './types'

function sessaoDeExemplo(): QuizSession {
  return {
    id: 1, sessionToken: 'tok', evento: 'diagnostico-tribunais-comercial',
    nome: 'Camila Nogueira', whatsapp: '11999998888', whatsappNormalizado: '5511999998888',
    email: 'camila@x.com', emailNormalizado: 'camila@x.com', fluxo: 'padrao', status: 'concluido',
    respostas: [
      { num: 1, area: 'Língua Portuguesa', escolhida: 'C', gabarito: 'C', acertou: true },
      { num: 2, area: 'Direito Constitucional', escolhida: 'A', gabarito: 'C', acertou: false },
      { num: 3, area: 'Direito Processual Civil', escolhida: 'B', gabarito: 'B', acertou: true },
      { num: 4, area: 'Raciocínio Lógico', escolhida: 'D', gabarito: 'A', acertou: false },
    ],
    areas: {}, scoreGeralPct: 50, acertos: 2, total: 4, areaPrioritaria: 'Direito Constitucional',
    perfil: {
      alvo: 'tj', cargo: 'analista', formacao: 'cursando_direito', tempo: 't0', provas: 'p0',
      metodo: 'nenhum', vde: 'nunca', horas: 'h1', edital: 'sem', dor: 'improviso',
      momento: 'zero', dinheiro: '96', leitura: 'completa', editais: [],
    },
    perfilCalculado: { classe: 'A', pontos: 7, curso: 'Curso 2 · Analista de TJ e TRF (231 temas)', cursoCod: 'C2-TJTRF', ritmo: 'base em ~12 meses' },
    blocos: [
      { id: 'iniciante', group: 'Onde você está', title: 'Começando do zero', paragraphs: ['Texto de exemplo do bloco.'] },
    ],
    whatsappClicadoEm: null, startedAt: '2026-09-16T10:00:00Z', updatedAt: '2026-09-16T10:20:00Z', completedAt: '2026-09-16T10:20:00Z',
  }
}

describe('montarHtmlLaudo', () => {
  it('inclui o nome, o diagnóstico e os blocos, sem usar cores do pacote (lilás/roxo)', () => {
    const html = montarHtmlLaudo(sessaoDeExemplo(), 'inicial')
    expect(html).toContain('Camila')
    expect(html).toContain('Começando do zero')
    expect(html).toContain('Texto de exemplo do bloco.')
    expect(html.toLowerCase()).not.toContain('#5421a1') // --purple do pacote
    expect(html.toLowerCase()).not.toContain('#c3bef9') // --lav do pacote
  })

  it('só inclui o plano de ação (ordem numerada) quando leitura é completa', () => {
    const comPlano = montarHtmlLaudo(sessaoDeExemplo(), 'inicial')
    const semPlano = montarHtmlLaudo({ ...sessaoDeExemplo(), perfil: { ...sessaoDeExemplo().perfil, leitura: 'basica' } }, 'inicial')
    expect(comPlano).toContain('A ordem que eu seguiria')
    expect(semPlano).not.toContain('A ordem que eu seguiria')
  })
})
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npm test -- lib/server/pdf.test`
Expected: FAIL — `lib/server/pdf.ts` não existe ainda.

- [ ] **Step 4: Implementar `lib/server/pdf.ts`**

```ts
import { chromium } from 'playwright'
import type { QuizSession } from './types'
import { DIAG, L } from '../quizContent'

const CSS = `
  @page { size: A4; margin: 18mm 15mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Poppins', system-ui, sans-serif; color: #203C7C; }
  .eyebrow { display: inline-block; font-size: 10.5px; font-weight: 600; letter-spacing: .02em;
    color: #8A6A0C; background: #FBF3D6; border-radius: 999px; padding: 5px 11px; margin: 0 0 10px; }
  h1 { font-size: 26px; line-height: 1.2; letter-spacing: -.02em; margin: 0 0 12px; }
  h2 { font-size: 18px; color: #203C7C; margin: 24px 0 10px; }
  h3 { font-size: 14px; color: #203C7C; margin: 0 0 6px; padding-left: 12px; border-left: 3px solid #203C7C; }
  p { font-size: 12.5px; line-height: 1.6; color: #5B6478; margin: 0 0 9px; }
  .resumo { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 16px 0; }
  .resumo div { border: 1.5px solid #E7E7EA; border-radius: 12px; padding: 10px 13px; font-size: 12px; }
  .resumo span:first-child { display: block; color: #7C86A6; font-size: 10.5px; }
  .blk { background: #FFFFFF; border: 1.5px solid #E7E7EA; border-radius: 14px; padding: 13px 16px; margin: 0 0 9px; break-inside: avoid; }
  .box { background: #FFFFFF; border: 1.5px solid #E7E7EA; border-left: 4px solid #C89B18; border-radius: 12px; padding: 12px 15px; margin: 12px 0; }
  ol { list-style: none; margin: 0; padding: 0; counter-reset: passo; }
  ol li { counter-increment: passo; position: relative; padding: 10px 14px 10px 42px; margin-bottom: 7px;
    background: #FFFFFF; border: 1.5px solid #E7E7EA; border-radius: 12px; font-size: 12.5px; color: #5B6478; }
  ol li::before { content: counter(passo); position: absolute; left: 13px; top: 9px; width: 20px; height: 20px;
    border-radius: 50%; background: #203C7C; color: #fff; font-size: 10.5px; font-weight: 600;
    display: flex; align-items: center; justify-content: center; }
`

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function montarHtmlLaudo(sessao: QuizSession, nivel: string): string {
  const momento = sessao.perfil.momento ? DIAG[sessao.perfil.momento] : undefined
  const primeiroNome = sessao.nome.split(' ')[0]
  const blocos = sessao.blocos ?? []
  const mostrarPlano = sessao.perfil.leitura === 'completa' && momento

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>${CSS}</style></head><body>
    <span class="eyebrow">Diagnóstico da Base</span>
    <h1>${escapeHtml(primeiroNome)}, este é o seu raio-x completo.</h1>
    <div class="resumo">
      <div><span>Onde você está</span>${sessao.perfil.momento ? escapeHtml(L.momento[sessao.perfil.momento]) : ''}</div>
      <div><span>Curso indicado</span>${escapeHtml(sessao.perfilCalculado?.curso ?? '')}</div>
      <div><span>Ritmo</span>${escapeHtml(sessao.perfilCalculado?.ritmo ?? '')}</div>
      <div><span>Nível no teste</span>${escapeHtml(nivel)} · ${sessao.acertos ?? 0} de ${sessao.total ?? 0}</div>
    </div>

    ${momento ? `
      <h2>A leitura do seu caso</h2>
      ${momento.texto.map((t) => `<p>${escapeHtml(t)}</p>`).join('')}
      <div class="box"><p><b>Começa por aqui:</b> ${escapeHtml(momento.prescricao)}</p></div>
    ` : ''}

    ${mostrarPlano ? `
      <h2>A ordem que eu seguiria</h2>
      <ol>${momento!.ordem.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol>
    ` : ''}

    ${blocos.length > 0 ? `
      <h2>Ponto a ponto do que você me contou</h2>
      ${blocos.map((b) => `
        <div class="blk">
          <h3>${escapeHtml(b.title)}</h3>
          ${b.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}
        </div>
      `).join('')}
    ` : ''}
  </body></html>`
}

export async function gerarPdfLaudo(sessao: QuizSession, nivel: string): Promise<Buffer> {
  const html = montarHtmlLaudo(sessao, nivel)
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle' })
    const pdf = await page.pdf({ format: 'A4', printBackground: true })
    return pdf
  } finally {
    await browser.close()
  }
}
```

Nota de escopo: a seção "ficha" (respostas legíveis campo a campo) e os cartões extras da capa (Alvo, Tempo disponível) ficam de fora — nenhum teste os exige, e o admin (Task 6) já mostra essas respostas na tela; adicionar ao PDF é uma melhoria incremental futura, não um requisito deste plano.

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npm test -- lib/server/pdf.test`
Expected: PASS (2 testes).

- [ ] **Step 6: Testar a geração real do PDF manualmente (fora da suíte automática)**

```bash
node -e "
require('ts-node/register');
const { gerarPdfLaudo } = require('./lib/server/pdf.ts');
" 2>/dev/null || npx tsx -e "
import { gerarPdfLaudo } from './lib/server/pdf'
import type { QuizSession } from './lib/server/types'
const sessao = { /* copie o objeto sessaoDeExemplo() do teste acima */ } as QuizSession
gerarPdfLaudo(sessao, 'inicial').then((buf) => require('fs').writeFileSync('/tmp/laudo-teste.pdf', buf))
"
open /tmp/laudo-teste.pdf
```

Confirme visualmente: nada de lilás/roxo, layout com capa/leitura/plano/blocos, texto legível.

- [ ] **Step 7: Rota admin de download**

Crie `app/api/admin/leads/[token]/pdf/route.ts` — protegida automaticamente pelo `middleware.ts` existente (prefixo `/api/admin`):

```ts
import { NextResponse } from 'next/server'
import { criarSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { criarSupabaseSessionRepo } from '@/lib/server/supabaseSessionRepo'
import { nivelTeste } from '@/lib/perfil'
import { gerarPdfLaudo } from '@/lib/server/pdf'
import { isUuid } from '@/lib/server/uuid'

export const runtime = 'nodejs'

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await params
  if (!isUuid(token)) return NextResponse.json({ erro: 'não encontrado' }, { status: 404 })

  const repo = criarSupabaseSessionRepo(criarSupabaseAdmin())
  const sessao = await repo.buscarPorToken(token)
  if (!sessao || sessao.status !== 'concluido') return NextResponse.json({ erro: 'não encontrado' }, { status: 404 })

  const nivel = sessao.acertos !== null ? nivelTeste(sessao.acertos) : ''
  const pdf = await gerarPdfLaudo(sessao, nivel)

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="laudo-${sessao.nome.replace(/\s+/g, '-').toLowerCase()}.pdf"`,
    },
  })
}
```

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json lib/server/pdf.ts lib/server/pdf.test.ts app/api/admin/leads/[token]/pdf/route.ts
git commit -m "feat: geração de PDF do laudo sob demanda, a partir dos dados da sessão"
```

---

## Task 6: Painel admin — blocos completos + botão baixar PDF

**Files:**
- Modify: `app/admin/(painel)/leads/[token]/page.tsx`

**Interfaces:**
- Consumes: `sessao.blocos` (Task 3), `GET /api/admin/leads/[token]/pdf` (Task 5).

- [ ] **Step 1: Adicionar o botão de download e a seção de blocos**

Em `app/admin/(painel)/leads/[token]/page.tsx`, dentro do componente, adicione (perto do cabeçalho da página, ex. logo após o link "voltar" já existente):

```tsx
{sessao.status === 'concluido' && (
  <a
    href={`/api/admin/leads/${token}/pdf`}
    className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-brand-ink px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-navy-2"
  >
    Baixar PDF do laudo
  </a>
)}
```

E, na parte da página que já lista os dados do perfil (perto de `CHAVES_FICHA`/`rotuloPerfil`), adicione a seção dos blocos completos:

```tsx
{sessao.blocos && sessao.blocos.length > 0 && (
  <section className="mt-8">
    <h2 className="text-[15px] font-bold text-brand-ink">Ponto a ponto ({sessao.blocos.length} blocos)</h2>
    <div className="mt-3 flex flex-col gap-2.5">
      {sessao.blocos.map((b) => (
        <div key={b.id} className="rounded-[14px] border-[1.5px] border-brand-line px-4 py-3.5">
          <h3 className="pl-3 text-[13.5px] font-semibold text-brand-ink" style={{ borderLeft: '3px solid #203C7C' }}>
            {b.title}
          </h3>
          {b.paragraphs.map((p, i) => (
            <p key={i} className="mt-1.5 text-[12.5px] leading-relaxed text-brand-ink-soft">{p}</p>
          ))}
        </div>
      ))}
    </div>
  </section>
)}
```

- [ ] **Step 2: Verificar manualmente no navegador**

```bash
npm run dev
```

Abra `/admin/leads`, entre no detalhe de um lead concluído, confirme que os blocos aparecem e que "Baixar PDF do laudo" baixa um PDF válido.

- [ ] **Step 3: Commit**

```bash
git add "app/admin/(painel)/leads/[token]/page.tsx"
git commit -m "feat: painel admin mostra os blocos completos e baixa o PDF do laudo"
```

---

## Self-Review

**1. Cobertura**: os 46 blocos (Task 1-2, validado contra os 8 casos reais do pacote), persistência (Task 3), preview com blur mantendo o resto do resultado como já é hoje (Task 4), PDF sob demanda na paleta certa (Task 5), admin (Task 6). Tudo em cima do código real já em produção — nada duplicado do que já existe (`calcularPerfil`, `DIAG`, `EDITAIS`, `QUESTIONS`, auth do admin, dedupe).

**2. Placeholder scan**: sem "TBD"/"implementar depois". A "ficha" do PDF (Task 5) e o CTA de agendamento de fato (link real de calendário) ficam de fora, documentados como corte de escopo explícito, não lacuna escondida — nenhum teste exige nenhum dos dois.

**3. Consistência de tipos**: `BlocoEscolhido` (Task 2) é o mesmo tipo usado em `QuizSession.blocos` (Task 3), na resposta das rotas (Task 3), no tipo local do `Quiz.tsx` (Task 4) e em `montarHtmlLaudo`/admin (Tasks 5-6) — mesmos campos (`id`, `group`, `title`, `paragraphs`) em todo lugar.

**4. Paleta**: nenhuma cor do pacote (`--lav #C3BEF9`, `--purple #5421A1`, `--navy #01123A`, `--creme #F7F5F0`) aparece em nenhum código deste plano — só os tokens do app (`brand-ink #203C7C`, `brand-gold-deep #C89B18`, `brand-line #E7E7EA` etc.), decisão confirmada com o cliente via mockup comparativo antes de escrever este plano.
