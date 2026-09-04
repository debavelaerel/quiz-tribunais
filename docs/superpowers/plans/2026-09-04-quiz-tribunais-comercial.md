# Quiz de Diagnóstico — Funil Comercial Tribunais — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js quiz that identifies a lead, records answers incrementally, computes a deterministic diagnostic, and persists one deduplicated row per person in Supabase for a sales team's downstream CRM sync.

**Architecture:** Next.js 16 App Router single-page component (cover → quiz → result states) calling four Route Handlers (`/api/quiz/start|answer|finish|result`). Route Handlers are thin wrappers around a pure, dependency-injected `quizService` that talks to a `SessionRepo` interface — a Supabase-backed implementation in production, an in-memory fake in tests. One Postgres table (`quiz_sessions`) holds one row per person per `evento`, RLS-locked to `service_role` only.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, `@supabase/supabase-js`, Vitest + Testing Library, Vercel deploy.

**Spec:** `docs/superpowers/specs/2026-09-03-quiz-tribunais-comercial-design.md`

## Global Constraints

- Next.js 16 (App Router), React 19, TypeScript — no other frontend framework.
- Tailwind CSS v4 (`@import "tailwindcss"` + `@theme` in CSS, no legacy `tailwind.config.js` needed).
- All writes to Supabase go through `supabase-js` using the `service_role` key, only inside Route Handlers (`runtime = 'nodejs'`) — never `NEXT_PUBLIC_`-prefixed, never reachable from client code.
- RLS is enabled on `quiz_sessions` with **no public policies** — only `service_role` can read/write.
- `session_token` is generated **client-side** (`crypto.randomUUID()`), persisted in `localStorage`, and never placed in a page URL or shareable link.
- The server always recomputes score/areas/priority from stored `respostas` — a client-submitted score/correctness value is never trusted or accepted by any endpoint.
- Dedupe is scoped **per `evento`** via `unique (evento, email_normalizado)` — email matches first, then `whatsapp_normalizado`; a `session_token`-only match never merges, it always creates a new row.
- A concluded session (`status = 'concluido'`) is immutable within that attempt; only a fresh `/start` call (which may reuse-and-reset the same row) starts a new attempt.
- Rate-limit (simple, per-IP, in-memory) on all three write endpoints — explicitly minimal per spec, not a full anti-bot system.
- Quiz question content is **placeholder/sample data** pending a separate copywriting task — the type shape is final, the text is not.
- Two visual identity values are pending (exact hex for gold/deep-purple/secondary colors, Degular font license) — the Tailwind theme task uses only the two confirmed hex values (`#203C7C`, `#B7ADFD`) plus neutral Tailwind defaults, and Poppins only (no Degular yet).

---

## File Structure

```
package.json
tsconfig.json
next.config.ts
postcss.config.mjs
vitest.config.ts
.env.example
app/
  layout.tsx
  globals.css
  page.tsx
  api/quiz/start/route.ts
  api/quiz/answer/route.ts
  api/quiz/finish/route.ts
  api/quiz/result/route.ts
components/
  Quiz.tsx
lib/
  normalize.ts
  questions.ts
  scoring.ts
  storage.ts
  server/
    types.ts
    sessionRepo.ts
    rateLimit.ts
    quizService.ts
    supabaseAdmin.ts
    supabaseSessionRepo.ts
    testHelpers/fakeSessionRepo.ts
supabase/
  migrations/20260904000001_quiz_sessions.sql
```

---

### Task 1: Scaffold the Next.js project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `vitest.config.ts`, `.env.example`
- Create: `app/layout.tsx`, `app/globals.css`, `app/page.tsx`
- Modify: `.gitignore`

**Interfaces:**
- Produces: a running `next dev` app at `/`, a working `npm test` (Vitest) command that later tasks add test files into.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "quiz-tribunais-comercial",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run"
  },
  "dependencies": {
    "next": "16.2.6",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "@supabase/supabase-js": "^2.45.4"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/postcss": "^4.0.0",
    "vitest": "^2.1.4",
    "@vitejs/plugin-react": "^4.3.3",
    "jsdom": "^25.0.1",
    "@testing-library/react": "^16.0.1",
    "@testing-library/jest-dom": "^6.6.2"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Write `next.config.ts`**

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {}

export default nextConfig
```

- [ ] **Step 4: Write `postcss.config.mjs`**

```javascript
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
```

- [ ] **Step 5: Write `app/globals.css`** (Tailwind v4 + confirmed brand tokens only — pending colors intentionally omitted, see Global Constraints)

```css
@import "tailwindcss";

@theme {
  --color-brand-navy: #203C7C;
  --color-brand-lilac: #B7ADFD;
  --font-brand: "Poppins", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

body {
  font-family: var(--font-brand);
}
```

- [ ] **Step 6: Write `app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Diagnóstico VDE Tribunais',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 7: Write `app/page.tsx`** (placeholder root — Task 15 replaces the body with `<Quiz />`)

```tsx
export default function Page() {
  return <main>Carregando…</main>
}
```

- [ ] **Step 8: Write `.env.example`**

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 9: Write `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

- [ ] **Step 10: Update `.gitignore`**

```
/node_modules
/.next
/out
/build
.DS_Store
*.pem
.env*.local
.vercel
next-env.d.ts
```

- [ ] **Step 11: Install and verify the dev server boots**

Run: `npm install && npm run build`
Expected: build completes with no errors (there are no pages beyond the placeholder yet).

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 16 + Tailwind v4 + Vitest project

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Normalization helpers

**Files:**
- Create: `lib/normalize.ts`
- Test: `lib/normalize.test.ts`

**Interfaces:**
- Produces: `normalizeEmail(email: string): string`, `normalizeWhatsapp(whatsapp: string): string` — used by Task 7 (`quizService`) and Task 10-13 (route handlers).

- [ ] **Step 1: Write the failing test**

```typescript
// lib/normalize.test.ts
import { describe, it, expect } from 'vitest'
import { normalizeEmail, normalizeWhatsapp } from './normalize'

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  Maria@Example.COM  ')).toBe('maria@example.com')
  })
})

describe('normalizeWhatsapp', () => {
  it('adds 55 prefix to an 11-digit number without DDI', () => {
    expect(normalizeWhatsapp('(11) 91234-5678')).toBe('5511912345678')
  })

  it('adds 55 prefix to a 10-digit number without DDI', () => {
    expect(normalizeWhatsapp('11 3123-4567')).toBe('551131234567')
  })

  it('keeps a number that already has the 55 prefix', () => {
    expect(normalizeWhatsapp('+55 11 91234-5678')).toBe('5511912345678')
  })

  it('strips all non-digit characters first', () => {
    expect(normalizeWhatsapp('55-(11)-91234.5678')).toBe('5511912345678')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/normalize.test.ts`
Expected: FAIL with "Cannot find module './normalize'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/normalize.ts
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function normalizeWhatsapp(whatsapp: string): string {
  const digits = whatsapp.replace(/\D/g, '')
  if (digits.length >= 12 && digits.startsWith('55')) return digits
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  return digits
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/normalize.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/normalize.ts lib/normalize.test.ts
git commit -m "feat: add email/whatsapp normalization helpers

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Question bank types and sample data

**Files:**
- Create: `lib/questions.ts`

**Interfaces:**
- Produces: `type Option`, `type Question`, `const QUESTIONS: Question[]`, `const EVENTO: string` — consumed by Task 4 (`scoring`) and Task 10 (`/start` route).

- [ ] **Step 1: Write `lib/questions.ts`**

Sample content below is **placeholder pending the copywriting task** (spec: "Fora de escopo" — conteúdo novo escrito separadamente). The type shape and `EVENTO` value are final; swapping in the real question bank later requires no code change elsewhere.

```typescript
// Banco de perguntas do quiz. Conteúdo AMOSTRA — será substituído pelo
// conteúdo final (tarefa de copywriting separada, ver spec "Fora de escopo").
// O formato ({num, area, statement, options, correct, comment}) é definitivo.

export type Option = { letter: string; text: string }
export type Question = {
  num: number
  area: string
  statement: string
  options: Option[]
  correct: string
  comment: string[]
}

export const EVENTO = 'diagnostico-tribunais-comercial'

export const QUESTIONS: Question[] = [
  {
    num: 1,
    area: 'Direito Constitucional',
    statement: 'Segundo a Constituição Federal de 1988, o remédio constitucional cabível para proteger o acesso a informações pessoais constantes de bancos de dados públicos é:',
    options: [
      { letter: 'A', text: 'Mandado de segurança' },
      { letter: 'B', text: 'Habeas data' },
      { letter: 'C', text: 'Habeas corpus' },
      { letter: 'D', text: 'Ação popular' },
    ],
    correct: 'B',
    comment: [
      'A) Incorreto. O mandado de segurança protege direito líquido e certo não amparado por habeas corpus ou habeas data.',
      'B) Correto. O art. 5º, LXXII, da CF/88 prevê o habeas data para assegurar o conhecimento e a retificação de informações pessoais em bancos de dados públicos.',
      'C) Incorreto. O habeas corpus protege a liberdade de locomoção.',
      'D) Incorreto. A ação popular visa anular ato lesivo ao patrimônio público, não o acesso a dados pessoais.',
    ],
  },
  {
    num: 2,
    area: 'Direito Administrativo',
    statement: 'Um ato administrativo praticado por agente incompetente, quando a competência é delegável e foi exercida de forma discricionária, admite:',
    options: [
      { letter: 'A', text: 'Convalidação obrigatória' },
      { letter: 'B', text: 'Convalidação facultativa' },
      { letter: 'C', text: 'Nulidade insanável' },
      { letter: 'D', text: 'Anulação automática, sem análise da autoridade competente' },
    ],
    correct: 'B',
    comment: [
      'A) Incorreto. A convalidação de vício de competência discricionária não é obrigatória.',
      'B) Correto. Sendo a competência discricionária e delegável, a autoridade competente pode optar por convalidar ou anular o ato.',
      'C) Incorreto. Nem todo vício de competência é insanável — apenas os relativos à matéria, atribuídos com exclusividade por lei.',
      'D) Incorreto. A anulação não é automática; depende de análise da autoridade competente.',
    ],
  },
  {
    num: 3,
    area: 'Direito Civil',
    statement: 'No regime de separação convencional de bens, o cônjuge sobrevivente, em concorrência com os descendentes do falecido:',
    options: [
      { letter: 'A', text: 'Não é herdeiro, apenas meeiro' },
      { letter: 'B', text: 'É herdeiro necessário e concorre com os descendentes' },
      { letter: 'C', text: 'Só herda se provar esforço comum na aquisição dos bens' },
      { letter: 'D', text: 'Recebe a totalidade da herança, excluindo os descendentes' },
    ],
    correct: 'B',
    comment: [
      'A) Incorreto. No regime de separação de bens não há meação, mas o cônjuge é herdeiro.',
      'B) Correto. O art. 1.829, I, do Código Civil inclui o cônjuge como herdeiro necessário em concorrência com os descendentes, mesmo na separação convencional.',
      'C) Incorreto. Esse requisito não se aplica à condição de herdeiro necessário.',
      'D) Incorreto. O cônjuge concorre com os descendentes, não os exclui.',
    ],
  },
]
```

- [ ] **Step 2: Commit**

```bash
git add lib/questions.ts
git commit -m "feat: add question bank types with sample data

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Scoring logic

**Files:**
- Create: `lib/scoring.ts`
- Test: `lib/scoring.test.ts`

**Interfaces:**
- Consumes: `Question`, `QUESTIONS` from `lib/questions.ts` (Task 3).
- Produces: `type RespostaEntrada = { num: number; escolhida: string }`, `type RespostaResumo = { num: number; area: string; escolhida: string; gabarito: string; acertou: boolean }`, `type AreaResumo = { acertos: number; total: number; pct: number }`, `montarRespostaResumo(entrada: RespostaEntrada): RespostaResumo`, `calcularAreas(respostas: RespostaResumo[]): Record<string, AreaResumo>`, `calcularResultado(respostas: RespostaResumo[]): { acertos: number; total: number; scoreGeralPct: number; areas: Record<string, AreaResumo>; areaPrioritaria: string | null }`, `respostasCobremTodasPerguntas(respostas: RespostaResumo[]): boolean` — consumed by Task 7 (`quizService`).

- [ ] **Step 1: Write the failing test**

```typescript
// lib/scoring.test.ts
import { describe, it, expect } from 'vitest'
import {
  montarRespostaResumo,
  calcularAreas,
  calcularResultado,
  respostasCobremTodasPerguntas,
} from './scoring'

describe('montarRespostaResumo', () => {
  it('deriva area e gabarito da pergunta, marca acertou quando bate', () => {
    const resumo = montarRespostaResumo({ num: 1, escolhida: 'B' })
    expect(resumo).toEqual({ num: 1, area: 'Direito Constitucional', escolhida: 'B', gabarito: 'B', acertou: true })
  })

  it('marca acertou=false quando a escolha não bate com o gabarito', () => {
    const resumo = montarRespostaResumo({ num: 1, escolhida: 'A' })
    expect(resumo.acertou).toBe(false)
  })

  it('lança erro para um num que não existe no banco de perguntas', () => {
    expect(() => montarRespostaResumo({ num: 999, escolhida: 'A' })).toThrow()
  })
})

describe('calcularAreas', () => {
  it('agrupa acertos e total por área, calculando pct', () => {
    const respostas = [
      { num: 1, area: 'Direito Constitucional', escolhida: 'B', gabarito: 'B', acertou: true },
      { num: 2, area: 'Direito Administrativo', escolhida: 'A', gabarito: 'B', acertou: false },
    ]
    const areas = calcularAreas(respostas)
    expect(areas['Direito Constitucional']).toEqual({ acertos: 1, total: 1, pct: 100 })
    expect(areas['Direito Administrativo']).toEqual({ acertos: 0, total: 1, pct: 0 })
  })
})

describe('calcularResultado', () => {
  it('calcula score geral, areas e area prioritaria (menor pct)', () => {
    const respostas = [
      { num: 1, area: 'Direito Constitucional', escolhida: 'B', gabarito: 'B', acertou: true },
      { num: 2, area: 'Direito Administrativo', escolhida: 'A', gabarito: 'B', acertou: false },
    ]
    const resultado = calcularResultado(respostas)
    expect(resultado.acertos).toBe(1)
    expect(resultado.total).toBe(2)
    expect(resultado.scoreGeralPct).toBe(50)
    expect(resultado.areaPrioritaria).toBe('Direito Administrativo')
  })
})

describe('respostasCobremTodasPerguntas', () => {
  it('retorna false quando falta pelo menos uma pergunta', () => {
    expect(respostasCobremTodasPerguntas([{ num: 1, area: 'x', escolhida: 'A', gabarito: 'A', acertou: true }])).toBe(false)
  })

  it('retorna true quando todas as perguntas do banco foram respondidas', () => {
    const respostas = [1, 2, 3].map((num) => ({ num, area: 'x', escolhida: 'A', gabarito: 'A', acertou: true }))
    expect(respostasCobremTodasPerguntas(respostas)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/scoring.test.ts`
Expected: FAIL with "Cannot find module './scoring'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/scoring.ts
import { QUESTIONS } from './questions'

export type RespostaEntrada = { num: number; escolhida: string }
export type RespostaResumo = { num: number; area: string; escolhida: string; gabarito: string; acertou: boolean }
export type AreaResumo = { acertos: number; total: number; pct: number }

export function montarRespostaResumo(entrada: RespostaEntrada): RespostaResumo {
  const questao = QUESTIONS.find((q) => q.num === entrada.num)
  if (!questao) throw new Error(`pergunta ${entrada.num} não existe`)
  return {
    num: questao.num,
    area: questao.area,
    escolhida: entrada.escolhida,
    gabarito: questao.correct,
    acertou: entrada.escolhida === questao.correct,
  }
}

export function calcularAreas(respostas: RespostaResumo[]): Record<string, AreaResumo> {
  const areas: Record<string, AreaResumo> = {}
  for (const r of respostas) {
    if (!areas[r.area]) areas[r.area] = { acertos: 0, total: 0, pct: 0 }
    areas[r.area].total += 1
    if (r.acertou) areas[r.area].acertos += 1
  }
  for (const area of Object.keys(areas)) {
    const a = areas[area]
    a.pct = a.total === 0 ? 0 : Math.round((a.acertos / a.total) * 100)
  }
  return areas
}

export function calcularAreaPrioritaria(areas: Record<string, AreaResumo>): string | null {
  const entradas = Object.entries(areas)
  if (entradas.length === 0) return null
  return entradas.sort((a, b) => a[1].pct - b[1].pct)[0][0]
}

export function calcularResultado(respostas: RespostaResumo[]) {
  const acertos = respostas.filter((r) => r.acertou).length
  const total = respostas.length
  const scoreGeralPct = total === 0 ? 0 : Math.round((acertos / total) * 100)
  const areas = calcularAreas(respostas)
  const areaPrioritaria = calcularAreaPrioritaria(areas)
  return { acertos, total, scoreGeralPct, areas, areaPrioritaria }
}

export function respostasCobremTodasPerguntas(respostas: RespostaResumo[]): boolean {
  const numsRespondidos = new Set(respostas.map((r) => r.num))
  return QUESTIONS.every((q) => numsRespondidos.has(q.num))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/scoring.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/scoring.ts lib/scoring.test.ts
git commit -m "feat: add deterministic scoring logic

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Rate limiting helper

**Files:**
- Create: `lib/server/rateLimit.ts`
- Test: `lib/server/rateLimit.test.ts`

**Interfaces:**
- Produces: `permitirRequisicao(chave: string, limite: number, janelaMs: number): boolean` — consumed by Task 10-12 (write route handlers).

- [ ] **Step 1: Write the failing test**

```typescript
// lib/server/rateLimit.test.ts
import { describe, it, expect } from 'vitest'
import { permitirRequisicao } from './rateLimit'

describe('permitirRequisicao', () => {
  it('permite até o limite dentro da janela', () => {
    const chave = `teste-${Math.random()}`
    expect(permitirRequisicao(chave, 3, 60_000)).toBe(true)
    expect(permitirRequisicao(chave, 3, 60_000)).toBe(true)
    expect(permitirRequisicao(chave, 3, 60_000)).toBe(true)
  })

  it('recusa a partir da requisição que excede o limite', () => {
    const chave = `teste-${Math.random()}`
    permitirRequisicao(chave, 2, 60_000)
    permitirRequisicao(chave, 2, 60_000)
    expect(permitirRequisicao(chave, 2, 60_000)).toBe(false)
  })

  it('chaves diferentes têm contadores independentes', () => {
    const a = `teste-a-${Math.random()}`
    const b = `teste-b-${Math.random()}`
    permitirRequisicao(a, 1, 60_000)
    expect(permitirRequisicao(b, 1, 60_000)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/server/rateLimit.test.ts`
Expected: FAIL with "Cannot find module './rateLimit'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/server/rateLimit.ts
// Rate-limit mínimo por chave (ex.: "start:<ip>"), em memória do processo.
// Escopo deliberadamente simples (spec: "não é proteção anti-bot sofisticada").
const janelas = new Map<string, { contagem: number; resetEm: number }>()

export function permitirRequisicao(chave: string, limite: number, janelaMs: number): boolean {
  const agora = Date.now()
  const atual = janelas.get(chave)
  if (!atual || agora > atual.resetEm) {
    janelas.set(chave, { contagem: 1, resetEm: agora + janelaMs })
    return true
  }
  if (atual.contagem >= limite) return false
  atual.contagem += 1
  return true
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/server/rateLimit.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/server/rateLimit.ts lib/server/rateLimit.test.ts
git commit -m "feat: add minimal per-key rate limiter

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Shared types, `SessionRepo` interface, fake repo

**Files:**
- Create: `lib/server/types.ts`, `lib/server/sessionRepo.ts`, `lib/server/testHelpers/fakeSessionRepo.ts`

**Interfaces:**
- Consumes: `RespostaResumo`, `AreaResumo` from `lib/scoring.ts` (Task 4).
- Produces: `type QuizSession`, `type IniciarSessaoInput`, `type IniciarSessaoResultado`, `interface SessionRepo { buscarPorEmail, buscarPorWhatsapp, buscarPorToken, criar, atualizar }`, `criarFakeSessionRepo(): SessionRepo & { linhas: QuizSession[] }` — consumed by Task 7 (`quizService`), Task 9 (Supabase repo impl), Task 10-13 (route handler tests).

- [ ] **Step 1: Write `lib/server/types.ts`**

```typescript
import type { RespostaResumo, AreaResumo } from '../scoring'

export type QuizSession = {
  id: number
  sessionToken: string
  evento: string
  nome: string
  whatsapp: string
  whatsappNormalizado: string
  email: string
  emailNormalizado: string
  status: 'em_andamento' | 'concluido'
  respostas: RespostaResumo[]
  areas: Record<string, AreaResumo>
  scoreGeralPct: number | null
  acertos: number | null
  total: number | null
  areaPrioritaria: string | null
  startedAt: string
  updatedAt: string
  completedAt: string | null
}

export type IniciarSessaoInput = {
  nome: string
  whatsapp: string
  email: string
  sessionToken: string
  evento: string
}

export type IniciarSessaoResultado = {
  sessionToken: string
  retomando: boolean
  respostasSalvas: RespostaResumo[]
}
```

- [ ] **Step 2: Write `lib/server/sessionRepo.ts`**

```typescript
import type { QuizSession } from './types'

export interface SessionRepo {
  buscarPorEmail(evento: string, emailNormalizado: string): Promise<QuizSession | null>
  buscarPorWhatsapp(evento: string, whatsappNormalizado: string): Promise<QuizSession | null>
  buscarPorToken(sessionToken: string): Promise<QuizSession | null>
  criar(sessao: Omit<QuizSession, 'id'>): Promise<QuizSession>
  atualizar(id: number, patch: Partial<QuizSession>): Promise<QuizSession>
}
```

- [ ] **Step 3: Write `lib/server/testHelpers/fakeSessionRepo.ts`**

```typescript
import type { SessionRepo } from '../sessionRepo'
import type { QuizSession } from '../types'

let proximoId = 1

export function criarFakeSessionRepo(): SessionRepo & { linhas: QuizSession[] } {
  const linhas: QuizSession[] = []

  return {
    linhas,
    async buscarPorEmail(evento, emailNormalizado) {
      return linhas.find((l) => l.evento === evento && l.emailNormalizado === emailNormalizado) ?? null
    },
    async buscarPorWhatsapp(evento, whatsappNormalizado) {
      return linhas.find((l) => l.evento === evento && l.whatsappNormalizado === whatsappNormalizado) ?? null
    },
    async buscarPorToken(sessionToken) {
      return linhas.find((l) => l.sessionToken === sessionToken) ?? null
    },
    async criar(sessao) {
      const nova: QuizSession = { ...sessao, id: proximoId++ }
      linhas.push(nova)
      return nova
    },
    async atualizar(id, patch) {
      const idx = linhas.findIndex((l) => l.id === id)
      if (idx === -1) throw new Error(`linha ${id} não encontrada`)
      linhas[idx] = { ...linhas[idx], ...patch, updatedAt: new Date().toISOString() }
      return linhas[idx]
    },
  }
}
```

- [ ] **Step 4: Verify the project still typechecks**

Run: `npx tsc --noEmit`
Expected: no errors (these are new files with no consumers yet, so nothing can be wrong beyond internal syntax)

- [ ] **Step 5: Commit**

```bash
git add lib/server/types.ts lib/server/sessionRepo.ts lib/server/testHelpers/fakeSessionRepo.ts
git commit -m "feat: add QuizSession types, SessionRepo interface, in-memory fake

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Quiz service (dedupe cascade, answer, finish, result)

**Files:**
- Create: `lib/server/quizService.ts`
- Test: `lib/server/quizService.test.ts`

**Interfaces:**
- Consumes: `SessionRepo`, `QuizSession`, `IniciarSessaoInput`, `IniciarSessaoResultado` (Task 6); `normalizeEmail`, `normalizeWhatsapp` (Task 2); `montarRespostaResumo`, `calcularAreas`, `calcularResultado`, `respostasCobremTodasPerguntas`, `RespostaEntrada` (Task 4); `criarFakeSessionRepo` (Task 6, test-only).
- Produces: `iniciarSessao(repo, input): Promise<IniciarSessaoResultado>`, `registrarResposta(repo, sessionToken, entrada): Promise<void>`, `concluirSessao(repo, sessionToken): Promise<QuizSession>`, `buscarResultado(repo, sessionToken): Promise<QuizSession | null>`, `class SessaoInvalidaError extends Error`, `class SessaoConcluidaError extends Error`, `class SessaoIncompletaError extends Error` — consumed by Task 10-13 (route handlers).

- [ ] **Step 1: Write the failing test**

```typescript
// lib/server/quizService.test.ts
import { describe, it, expect } from 'vitest'
import { criarFakeSessionRepo } from './testHelpers/fakeSessionRepo'
import {
  iniciarSessao,
  registrarResposta,
  concluirSessao,
  buscarResultado,
  SessaoInvalidaError,
  SessaoConcluidaError,
  SessaoIncompletaError,
} from './quizService'

const EVENTO = 'diagnostico-tribunais-comercial'

describe('iniciarSessao', () => {
  it('cria linha nova quando email e whatsapp não existem', async () => {
    const repo = criarFakeSessionRepo()
    const r = await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', sessionToken: 'tok-1', evento: EVENTO })
    expect(r.retomando).toBe(false)
    expect(repo.linhas).toHaveLength(1)
  })

  it('reaproveita e retoma progresso quando o email já existe e está em_andamento', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', sessionToken: 'tok-1', evento: EVENTO })
    await registrarResposta(repo, 'tok-1', { num: 1, escolhida: 'B' })
    const r = await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'MARIA@X.COM', sessionToken: 'tok-2', evento: EVENTO })
    expect(r.retomando).toBe(true)
    expect(r.respostasSalvas).toHaveLength(1)
    expect(repo.linhas).toHaveLength(1)
  })

  it('reaproveita por whatsapp quando o email é diferente, e sobrescreve os dados', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', sessionToken: 'tok-1', evento: EVENTO })
    const r = await iniciarSessao(repo, { nome: 'Maria Silva', whatsapp: '(11) 98765-4321', email: 'maria2@x.com', sessionToken: 'tok-2', evento: EVENTO })
    expect(repo.linhas).toHaveLength(1)
    expect(repo.linhas[0].nome).toBe('Maria Silva')
    expect(repo.linhas[0].emailNormalizado).toBe('maria2@x.com')
  })

  it('sobrescreve (reseta) quando reaproveita uma sessão já concluída', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', sessionToken: 'tok-1', evento: EVENTO })
    await registrarResposta(repo, 'tok-1', { num: 1, escolhida: 'B' })
    await registrarResposta(repo, 'tok-1', { num: 2, escolhida: 'B' })
    await registrarResposta(repo, 'tok-1', { num: 3, escolhida: 'B' })
    await concluirSessao(repo, 'tok-1')

    const r = await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', sessionToken: 'tok-2', evento: EVENTO })
    expect(r.retomando).toBe(false)
    expect(r.respostasSalvas).toHaveLength(0)
    expect(repo.linhas).toHaveLength(1)
    expect(repo.linhas[0].status).toBe('em_andamento')
    expect(repo.linhas[0].completedAt).toBeNull()
  })

  it('não funde por session_token isolado — cria linha nova mesmo com o mesmo navegador', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', sessionToken: 'tok-mesmo-navegador', evento: EVENTO })
    await iniciarSessao(repo, { nome: 'Joao', whatsapp: '11900000000', email: 'joao@x.com', sessionToken: 'tok-mesmo-navegador', evento: EVENTO })
    expect(repo.linhas).toHaveLength(2)
  })

  it('mesmo email em eventos diferentes não conflita', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', sessionToken: 'tok-1', evento: 'evento-a' })
    await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', sessionToken: 'tok-2', evento: 'evento-b' })
    expect(repo.linhas).toHaveLength(2)
  })
})

describe('registrarResposta', () => {
  it('lança SessaoInvalidaError para token inexistente', async () => {
    const repo = criarFakeSessionRepo()
    await expect(registrarResposta(repo, 'nao-existe', { num: 1, escolhida: 'A' })).rejects.toThrow(SessaoInvalidaError)
  })

  it('lança SessaoConcluidaError para sessão já concluída', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', sessionToken: 'tok-1', evento: EVENTO })
    await registrarResposta(repo, 'tok-1', { num: 1, escolhida: 'B' })
    await registrarResposta(repo, 'tok-1', { num: 2, escolhida: 'B' })
    await registrarResposta(repo, 'tok-1', { num: 3, escolhida: 'B' })
    await concluirSessao(repo, 'tok-1')
    await expect(registrarResposta(repo, 'tok-1', { num: 1, escolhida: 'A' })).rejects.toThrow(SessaoConcluidaError)
  })

  it('faz upsert por num — responder a mesma pergunta duas vezes não duplica', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', sessionToken: 'tok-1', evento: EVENTO })
    await registrarResposta(repo, 'tok-1', { num: 1, escolhida: 'A' })
    await registrarResposta(repo, 'tok-1', { num: 1, escolhida: 'B' })
    expect(repo.linhas[0].respostas).toHaveLength(1)
    expect(repo.linhas[0].respostas[0].escolhida).toBe('B')
  })
})

describe('concluirSessao', () => {
  it('lança SessaoIncompletaError quando faltam perguntas', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', sessionToken: 'tok-1', evento: EVENTO })
    await registrarResposta(repo, 'tok-1', { num: 1, escolhida: 'B' })
    await expect(concluirSessao(repo, 'tok-1')).rejects.toThrow(SessaoIncompletaError)
  })

  it('calcula e grava o resultado quando todas as perguntas foram respondidas', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', sessionToken: 'tok-1', evento: EVENTO })
    await registrarResposta(repo, 'tok-1', { num: 1, escolhida: 'B' })
    await registrarResposta(repo, 'tok-1', { num: 2, escolhida: 'B' })
    await registrarResposta(repo, 'tok-1', { num: 3, escolhida: 'B' })
    const sessao = await concluirSessao(repo, 'tok-1')
    expect(sessao.status).toBe('concluido')
    expect(sessao.scoreGeralPct).toBe(100)
    expect(sessao.completedAt).not.toBeNull()
  })

  it('lança SessaoConcluidaError numa segunda chamada de finish', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', sessionToken: 'tok-1', evento: EVENTO })
    await registrarResposta(repo, 'tok-1', { num: 1, escolhida: 'B' })
    await registrarResposta(repo, 'tok-1', { num: 2, escolhida: 'B' })
    await registrarResposta(repo, 'tok-1', { num: 3, escolhida: 'B' })
    await concluirSessao(repo, 'tok-1')
    await expect(concluirSessao(repo, 'tok-1')).rejects.toThrow(SessaoConcluidaError)
  })
})

describe('buscarResultado', () => {
  it('retorna null quando a sessão não está concluída', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', sessionToken: 'tok-1', evento: EVENTO })
    expect(await buscarResultado(repo, 'tok-1')).toBeNull()
  })

  it('retorna a sessão quando concluída', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessao(repo, { nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', sessionToken: 'tok-1', evento: EVENTO })
    await registrarResposta(repo, 'tok-1', { num: 1, escolhida: 'B' })
    await registrarResposta(repo, 'tok-1', { num: 2, escolhida: 'B' })
    await registrarResposta(repo, 'tok-1', { num: 3, escolhida: 'B' })
    await concluirSessao(repo, 'tok-1')
    const sessao = await buscarResultado(repo, 'tok-1')
    expect(sessao?.status).toBe('concluido')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/server/quizService.test.ts`
Expected: FAIL with "Cannot find module './quizService'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/server/quizService.ts
import type { SessionRepo } from './sessionRepo'
import type { IniciarSessaoInput, IniciarSessaoResultado, QuizSession } from './types'
import { normalizeEmail, normalizeWhatsapp } from '../normalize'
import { montarRespostaResumo, calcularAreas, calcularResultado, respostasCobremTodasPerguntas, type RespostaEntrada } from '../scoring'

export class SessaoInvalidaError extends Error {}
export class SessaoConcluidaError extends Error {}
export class SessaoIncompletaError extends Error {}

export async function iniciarSessao(repo: SessionRepo, input: IniciarSessaoInput): Promise<IniciarSessaoResultado> {
  const emailNormalizado = normalizeEmail(input.email)
  const whatsappNormalizado = normalizeWhatsapp(input.whatsapp)

  let existente = await repo.buscarPorEmail(input.evento, emailNormalizado)
  if (!existente) existente = await repo.buscarPorWhatsapp(input.evento, whatsappNormalizado)

  if (existente) {
    if (existente.status === 'em_andamento') {
      const atualizada = await repo.atualizar(existente.id, {
        sessionToken: input.sessionToken,
        nome: input.nome,
        email: input.email,
        emailNormalizado,
        whatsapp: input.whatsapp,
        whatsappNormalizado,
      })
      return { sessionToken: atualizada.sessionToken, retomando: true, respostasSalvas: atualizada.respostas }
    }
    const reiniciada = await repo.atualizar(existente.id, {
      sessionToken: input.sessionToken,
      nome: input.nome,
      email: input.email,
      emailNormalizado,
      whatsapp: input.whatsapp,
      whatsappNormalizado,
      status: 'em_andamento',
      respostas: [],
      areas: {},
      scoreGeralPct: null,
      acertos: null,
      total: null,
      areaPrioritaria: null,
      startedAt: new Date().toISOString(),
      completedAt: null,
    })
    return { sessionToken: reiniciada.sessionToken, retomando: false, respostasSalvas: [] }
  }

  const agora = new Date().toISOString()
  const criada = await repo.criar({
    sessionToken: input.sessionToken,
    evento: input.evento,
    nome: input.nome,
    whatsapp: input.whatsapp,
    whatsappNormalizado,
    email: input.email,
    emailNormalizado,
    status: 'em_andamento',
    respostas: [],
    areas: {},
    scoreGeralPct: null,
    acertos: null,
    total: null,
    areaPrioritaria: null,
    startedAt: agora,
    updatedAt: agora,
    completedAt: null,
  })
  return { sessionToken: criada.sessionToken, retomando: false, respostasSalvas: [] }
}

export async function registrarResposta(repo: SessionRepo, sessionToken: string, entrada: RespostaEntrada): Promise<void> {
  const sessao = await repo.buscarPorToken(sessionToken)
  if (!sessao) throw new SessaoInvalidaError('sessão não encontrada')
  if (sessao.status === 'concluido') throw new SessaoConcluidaError('sessão já concluída')

  const resumo = montarRespostaResumo(entrada)
  const respostas = sessao.respostas.filter((r) => r.num !== resumo.num)
  respostas.push(resumo)
  const areas = calcularAreas(respostas)
  await repo.atualizar(sessao.id, { respostas, areas })
}

export async function concluirSessao(repo: SessionRepo, sessionToken: string): Promise<QuizSession> {
  const sessao = await repo.buscarPorToken(sessionToken)
  if (!sessao) throw new SessaoInvalidaError('sessão não encontrada')
  if (sessao.status === 'concluido') throw new SessaoConcluidaError('sessão já concluída')
  if (!respostasCobremTodasPerguntas(sessao.respostas)) throw new SessaoIncompletaError('faltam respostas')

  const resultado = calcularResultado(sessao.respostas)
  return repo.atualizar(sessao.id, {
    status: 'concluido',
    areas: resultado.areas,
    scoreGeralPct: resultado.scoreGeralPct,
    acertos: resultado.acertos,
    total: resultado.total,
    areaPrioritaria: resultado.areaPrioritaria,
    completedAt: new Date().toISOString(),
  })
}

export async function buscarResultado(repo: SessionRepo, sessionToken: string): Promise<QuizSession | null> {
  const sessao = await repo.buscarPorToken(sessionToken)
  if (!sessao || sessao.status !== 'concluido') return null
  return sessao
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/server/quizService.test.ts`
Expected: PASS (13 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/server/quizService.ts lib/server/quizService.test.ts
git commit -m "feat: add quiz service with dedupe cascade and lifecycle rules

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Supabase migration

**Files:**
- Create: `supabase/migrations/20260904000001_quiz_sessions.sql`

**Interfaces:**
- Produces: the `quiz_sessions` table matching `lib/server/types.ts`'s `QuizSession` shape (snake_case columns) — consumed by Task 9 (`supabaseSessionRepo`).

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260904000001_quiz_sessions.sql
create table quiz_sessions (
  id                   bigint generated always as identity primary key,
  session_token        uuid not null unique,
  evento               text not null default 'diagnostico-tribunais-comercial',
  nome                 text not null,
  whatsapp             text not null,
  whatsapp_normalizado text not null,
  email                text not null,
  email_normalizado    text not null,
  status               text not null default 'em_andamento'
                         check (status in ('em_andamento', 'concluido')),
  respostas            jsonb not null default '[]'::jsonb,
  areas                jsonb not null default '{}'::jsonb,
  score_geral_pct      numeric(5,2),
  acertos              int,
  total                int,
  area_prioritaria     text,
  started_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  completed_at         timestamptz,

  constraint uq_quiz_sessions_evento_email unique (evento, email_normalizado)
);

create index idx_quiz_sessions_status_updated on quiz_sessions (status, updated_at);
create index idx_quiz_sessions_evento_whatsapp on quiz_sessions (evento, whatsapp_normalizado);

create function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_quiz_sessions_updated_at
  before update on quiz_sessions
  for each row execute function set_updated_at();

alter table quiz_sessions enable row level security;
-- Nenhuma policy pública: só a service_role (usada nas Route Handlers) acessa a tabela.
```

- [ ] **Step 2: Verify the migration applies cleanly to a local Postgres**

Run:
```bash
createdb quiz_tribunais_scratch
psql -v ON_ERROR_STOP=1 -d quiz_tribunais_scratch -f supabase/migrations/20260904000001_quiz_sessions.sql
```
Expected: no errors; then verify the constraint works:
```bash
psql -d quiz_tribunais_scratch -c "insert into quiz_sessions (session_token, nome, whatsapp, whatsapp_normalizado, email, email_normalizado) values (gen_random_uuid(), 'A', 'x', 'x', 'a@a.com', 'a@a.com');"
psql -d quiz_tribunais_scratch -c "insert into quiz_sessions (session_token, nome, whatsapp, whatsapp_normalizado, email, email_normalizado) values (gen_random_uuid(), 'B', 'y', 'y', 'a@a.com', 'a@a.com');"
```
Expected: second insert fails with `duplicate key value violates unique constraint "uq_quiz_sessions_evento_email"`.
Then: `dropdb quiz_tribunais_scratch`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260904000001_quiz_sessions.sql
git commit -m "feat: add quiz_sessions migration with RLS and evento-scoped dedupe

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Supabase admin client and repo implementation

**Files:**
- Create: `lib/server/supabaseAdmin.ts`, `lib/server/supabaseSessionRepo.ts`

**Interfaces:**
- Consumes: `SessionRepo`, `QuizSession` (Task 6).
- Produces: `criarSupabaseAdmin(): SupabaseClient`, `criarSupabaseSessionRepo(client: SupabaseClient): SessionRepo` — consumed by Task 10-13 (route handlers, production wiring only — not by their tests, which use the fake repo).

- [ ] **Step 1: Write `lib/server/supabaseAdmin.ts`**

```typescript
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export function criarSupabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configuradas')
  return createClient(url, key, { auth: { persistSession: false } })
}
```

- [ ] **Step 2: Write `lib/server/supabaseSessionRepo.ts`**

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import type { SessionRepo } from './sessionRepo'
import type { QuizSession } from './types'

type LinhaBanco = {
  id: number
  session_token: string
  evento: string
  nome: string
  whatsapp: string
  whatsapp_normalizado: string
  email: string
  email_normalizado: string
  status: 'em_andamento' | 'concluido'
  respostas: QuizSession['respostas']
  areas: QuizSession['areas']
  score_geral_pct: number | null
  acertos: number | null
  total: number | null
  area_prioritaria: string | null
  started_at: string
  updated_at: string
  completed_at: string | null
}

function paraSessao(linha: LinhaBanco): QuizSession {
  return {
    id: linha.id,
    sessionToken: linha.session_token,
    evento: linha.evento,
    nome: linha.nome,
    whatsapp: linha.whatsapp,
    whatsappNormalizado: linha.whatsapp_normalizado,
    email: linha.email,
    emailNormalizado: linha.email_normalizado,
    status: linha.status,
    respostas: linha.respostas,
    areas: linha.areas,
    scoreGeralPct: linha.score_geral_pct,
    acertos: linha.acertos,
    total: linha.total,
    areaPrioritaria: linha.area_prioritaria,
    startedAt: linha.started_at,
    updatedAt: linha.updated_at,
    completedAt: linha.completed_at,
  }
}

function paraLinhaPatch(patch: Partial<QuizSession>): Record<string, unknown> {
  const linha: Record<string, unknown> = {}
  if (patch.sessionToken !== undefined) linha.session_token = patch.sessionToken
  if (patch.evento !== undefined) linha.evento = patch.evento
  if (patch.nome !== undefined) linha.nome = patch.nome
  if (patch.email !== undefined) linha.email = patch.email
  if (patch.emailNormalizado !== undefined) linha.email_normalizado = patch.emailNormalizado
  if (patch.whatsapp !== undefined) linha.whatsapp = patch.whatsapp
  if (patch.whatsappNormalizado !== undefined) linha.whatsapp_normalizado = patch.whatsappNormalizado
  if (patch.status !== undefined) linha.status = patch.status
  if (patch.respostas !== undefined) linha.respostas = patch.respostas
  if (patch.areas !== undefined) linha.areas = patch.areas
  if (patch.scoreGeralPct !== undefined) linha.score_geral_pct = patch.scoreGeralPct
  if (patch.acertos !== undefined) linha.acertos = patch.acertos
  if (patch.total !== undefined) linha.total = patch.total
  if (patch.areaPrioritaria !== undefined) linha.area_prioritaria = patch.areaPrioritaria
  if (patch.startedAt !== undefined) linha.started_at = patch.startedAt
  if (patch.completedAt !== undefined) linha.completed_at = patch.completedAt
  return linha
}

export function criarSupabaseSessionRepo(client: SupabaseClient): SessionRepo {
  return {
    async buscarPorEmail(evento, emailNormalizado) {
      const { data, error } = await client.from('quiz_sessions').select('*')
        .eq('evento', evento).eq('email_normalizado', emailNormalizado).maybeSingle()
      if (error) throw error
      return data ? paraSessao(data as LinhaBanco) : null
    },
    async buscarPorWhatsapp(evento, whatsappNormalizado) {
      const { data, error } = await client.from('quiz_sessions').select('*')
        .eq('evento', evento).eq('whatsapp_normalizado', whatsappNormalizado).maybeSingle()
      if (error) throw error
      return data ? paraSessao(data as LinhaBanco) : null
    },
    async buscarPorToken(sessionToken) {
      const { data, error } = await client.from('quiz_sessions').select('*')
        .eq('session_token', sessionToken).maybeSingle()
      if (error) throw error
      return data ? paraSessao(data as LinhaBanco) : null
    },
    async criar(sessao) {
      const { data, error } = await client.from('quiz_sessions').insert(paraLinhaPatch(sessao)).select('*').single()
      if (error) throw error
      return paraSessao(data as LinhaBanco)
    },
    async atualizar(id, patch) {
      const { data, error } = await client.from('quiz_sessions').update(paraLinhaPatch(patch)).eq('id', id).select('*').single()
      if (error) throw error
      return paraSessao(data as LinhaBanco)
    },
  }
}
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add lib/server/supabaseAdmin.ts lib/server/supabaseSessionRepo.ts
git commit -m "feat: add Supabase-backed SessionRepo implementation

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: `POST /api/quiz/start`

**Files:**
- Create: `app/api/quiz/start/route.ts`
- Test: `app/api/quiz/start/route.test.ts`

**Interfaces:**
- Consumes: `iniciarSessao` (Task 7), `permitirRequisicao` (Task 5), `EVENTO` (Task 3), `criarFakeSessionRepo` (Task 6, test-only), `SessionRepo` (Task 6), `criarSupabaseSessionRepo`/`criarSupabaseAdmin` (Task 9, production wiring only).
- Produces: `criarHandlerStart(repo: SessionRepo): (req: Request) => Promise<Response>`, exported `POST` — the handler-factory pattern is reused identically by Tasks 11-13 so their tests can inject a fake repo without touching real env vars.

- [ ] **Step 1: Write the failing test**

```typescript
// app/api/quiz/start/route.test.ts
import { describe, it, expect } from 'vitest'
import { criarHandlerStart } from './route'
import { criarFakeSessionRepo } from '@/lib/server/testHelpers/fakeSessionRepo'

function fazerRequisicao(corpo: unknown) {
  return new Request('http://localhost/api/quiz/start', {
    method: 'POST',
    body: JSON.stringify(corpo),
    headers: { 'x-forwarded-for': `10.0.0.${Math.floor(Math.random() * 250)}` },
  })
}

describe('POST /api/quiz/start', () => {
  it('cria sessão nova com corpo válido', async () => {
    const handler = criarHandlerStart(criarFakeSessionRepo())
    const res = await handler(fazerRequisicao({
      nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', session_token: 'aaaaaaaa-1111-1111-1111-111111111111',
    }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.retomando).toBe(false)
  })

  it('recusa email inválido com 422', async () => {
    const handler = criarHandlerStart(criarFakeSessionRepo())
    const res = await handler(fazerRequisicao({
      nome: 'Maria', whatsapp: '11987654321', email: 'invalido', session_token: 'aaaaaaaa-1111-1111-1111-111111111111',
    }))
    expect(res.status).toBe(422)
  })

  it('recusa whatsapp com poucos dígitos com 422', async () => {
    const handler = criarHandlerStart(criarFakeSessionRepo())
    const res = await handler(fazerRequisicao({
      nome: 'Maria', whatsapp: '123', email: 'maria@x.com', session_token: 'aaaaaaaa-1111-1111-1111-111111111111',
    }))
    expect(res.status).toBe(422)
  })

  it('recusa nome vazio com 422', async () => {
    const handler = criarHandlerStart(criarFakeSessionRepo())
    const res = await handler(fazerRequisicao({
      nome: '  ', whatsapp: '11987654321', email: 'maria@x.com', session_token: 'aaaaaaaa-1111-1111-1111-111111111111',
    }))
    expect(res.status).toBe(422)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/quiz/start/route.test.ts`
Expected: FAIL with "Cannot find module './route'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// app/api/quiz/start/route.ts
import { NextResponse } from 'next/server'
import { criarSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { criarSupabaseSessionRepo } from '@/lib/server/supabaseSessionRepo'
import type { SessionRepo } from '@/lib/server/sessionRepo'
import { iniciarSessao } from '@/lib/server/quizService'
import { permitirRequisicao } from '@/lib/server/rateLimit'
import { EVENTO } from '@/lib/questions'

export const runtime = 'nodejs'

function ipDaRequisicao(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'desconhecido'
}

function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function criarHandlerStart(repo: SessionRepo) {
  return async function handler(req: Request): Promise<Response> {
    if (!permitirRequisicao(`start:${ipDaRequisicao(req)}`, 10, 60_000)) {
      return NextResponse.json({ erro: 'muitas requisições' }, { status: 429 })
    }

    let corpo: unknown
    try {
      corpo = await req.json()
    } catch {
      return NextResponse.json({ erro: 'json inválido' }, { status: 400 })
    }

    const { nome, whatsapp, email, session_token: sessionToken } = (corpo ?? {}) as Record<string, unknown>
    if (typeof nome !== 'string' || nome.trim() === '') {
      return NextResponse.json({ erro: 'nome obrigatório' }, { status: 422 })
    }
    if (typeof email !== 'string' || !emailValido(email)) {
      return NextResponse.json({ erro: 'email inválido' }, { status: 422 })
    }
    const digitos = typeof whatsapp === 'string' ? whatsapp.replace(/\D/g, '').length : 0
    if (digitos < 10 || digitos > 13) {
      return NextResponse.json({ erro: 'whatsapp inválido' }, { status: 422 })
    }
    if (typeof sessionToken !== 'string' || sessionToken.length < 10) {
      return NextResponse.json({ erro: 'session_token inválido' }, { status: 422 })
    }

    const resultado = await iniciarSessao(repo, {
      nome, whatsapp: whatsapp as string, email, sessionToken, evento: EVENTO,
    })
    return NextResponse.json(resultado, { status: 200 })
  }
}

export async function POST(req: Request): Promise<Response> {
  return criarHandlerStart(criarSupabaseSessionRepo(criarSupabaseAdmin()))(req)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/quiz/start/route.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/quiz/start/route.ts app/api/quiz/start/route.test.ts
git commit -m "feat: add POST /api/quiz/start route handler

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 11: `POST /api/quiz/answer`

**Files:**
- Create: `app/api/quiz/answer/route.ts`
- Test: `app/api/quiz/answer/route.test.ts`

**Interfaces:**
- Consumes: `registrarResposta`, `SessaoInvalidaError`, `SessaoConcluidaError` (Task 7); `permitirRequisicao` (Task 5); `criarFakeSessionRepo` (Task 6, test-only).
- Produces: `criarHandlerAnswer(repo: SessionRepo): (req: Request) => Promise<Response>`, exported `POST`.

- [ ] **Step 1: Write the failing test**

```typescript
// app/api/quiz/answer/route.test.ts
import { describe, it, expect } from 'vitest'
import { criarHandlerAnswer } from './route'
import { criarHandlerStart } from '../start/route'
import { criarFakeSessionRepo } from '@/lib/server/testHelpers/fakeSessionRepo'

function fazerRequisicao(corpo: unknown) {
  return new Request('http://localhost/api/quiz/answer', {
    method: 'POST',
    body: JSON.stringify(corpo),
    headers: { 'x-forwarded-for': `10.0.1.${Math.floor(Math.random() * 250)}` },
  })
}

async function iniciarSessaoDeTeste(repo: ReturnType<typeof criarFakeSessionRepo>) {
  const start = criarHandlerStart(repo)
  await start(new Request('http://localhost/api/quiz/start', {
    method: 'POST',
    body: JSON.stringify({ nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', session_token: 'aaaaaaaa-1111-1111-1111-111111111111' }),
    headers: { 'x-forwarded-for': `10.0.2.${Math.floor(Math.random() * 250)}` },
  }))
}

describe('POST /api/quiz/answer', () => {
  it('registra uma resposta válida', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarSessaoDeTeste(repo)
    const handler = criarHandlerAnswer(repo)
    const res = await handler(fazerRequisicao({ session_token: 'aaaaaaaa-1111-1111-1111-111111111111', num: 1, escolhida: 'B' }))
    expect(res.status).toBe(200)
    expect(repo.linhas[0].respostas).toHaveLength(1)
  })

  it('retorna 404 para session_token inexistente', async () => {
    const repo = criarFakeSessionRepo()
    const handler = criarHandlerAnswer(repo)
    const res = await handler(fazerRequisicao({ session_token: 'nao-existe', num: 1, escolhida: 'B' }))
    expect(res.status).toBe(404)
  })

  it('retorna 422 para corpo com tipos errados', async () => {
    const repo = criarFakeSessionRepo()
    const handler = criarHandlerAnswer(repo)
    const res = await handler(fazerRequisicao({ session_token: 123, num: '1', escolhida: 'B' }))
    expect(res.status).toBe(422)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/quiz/answer/route.test.ts`
Expected: FAIL with "Cannot find module './route'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// app/api/quiz/answer/route.ts
import { NextResponse } from 'next/server'
import { criarSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { criarSupabaseSessionRepo } from '@/lib/server/supabaseSessionRepo'
import type { SessionRepo } from '@/lib/server/sessionRepo'
import { registrarResposta, SessaoInvalidaError, SessaoConcluidaError } from '@/lib/server/quizService'
import { permitirRequisicao } from '@/lib/server/rateLimit'

export const runtime = 'nodejs'

function ipDaRequisicao(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'desconhecido'
}

export function criarHandlerAnswer(repo: SessionRepo) {
  return async function handler(req: Request): Promise<Response> {
    if (!permitirRequisicao(`answer:${ipDaRequisicao(req)}`, 60, 60_000)) {
      return NextResponse.json({ erro: 'muitas requisições' }, { status: 429 })
    }

    let corpo: unknown
    try {
      corpo = await req.json()
    } catch {
      return NextResponse.json({ erro: 'json inválido' }, { status: 400 })
    }

    const { session_token: sessionToken, num, escolhida } = (corpo ?? {}) as Record<string, unknown>
    if (typeof sessionToken !== 'string' || typeof num !== 'number' || typeof escolhida !== 'string') {
      return NextResponse.json({ erro: 'corpo inválido' }, { status: 422 })
    }

    try {
      await registrarResposta(repo, sessionToken, { num, escolhida })
    } catch (e) {
      if (e instanceof SessaoInvalidaError) return NextResponse.json({ erro: 'sessão não encontrada' }, { status: 404 })
      if (e instanceof SessaoConcluidaError) return NextResponse.json({ erro: 'sessão já concluída' }, { status: 409 })
      throw e
    }
    return NextResponse.json({ ok: true }, { status: 200 })
  }
}

export async function POST(req: Request): Promise<Response> {
  return criarHandlerAnswer(criarSupabaseSessionRepo(criarSupabaseAdmin()))(req)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/quiz/answer/route.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/quiz/answer/route.ts app/api/quiz/answer/route.test.ts
git commit -m "feat: add POST /api/quiz/answer route handler

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 12: `POST /api/quiz/finish`

**Files:**
- Create: `app/api/quiz/finish/route.ts`
- Test: `app/api/quiz/finish/route.test.ts`

**Interfaces:**
- Consumes: `concluirSessao`, `SessaoInvalidaError`, `SessaoConcluidaError`, `SessaoIncompletaError` (Task 7); `permitirRequisicao` (Task 5); `criarHandlerStart`/`criarHandlerAnswer` (Tasks 10-11, test-only, to set up fixtures); `criarFakeSessionRepo` (Task 6, test-only).
- Produces: `criarHandlerFinish(repo: SessionRepo): (req: Request) => Promise<Response>`, exported `POST`.

- [ ] **Step 1: Write the failing test**

```typescript
// app/api/quiz/finish/route.test.ts
import { describe, it, expect } from 'vitest'
import { criarHandlerFinish } from './route'
import { criarHandlerStart } from '../start/route'
import { criarHandlerAnswer } from '../answer/route'
import { criarFakeSessionRepo } from '@/lib/server/testHelpers/fakeSessionRepo'

const TOKEN = 'aaaaaaaa-1111-1111-1111-111111111111'

function ip() {
  return `10.0.3.${Math.floor(Math.random() * 250)}`
}

async function iniciarEResponderTudo(repo: ReturnType<typeof criarFakeSessionRepo>) {
  const start = criarHandlerStart(repo)
  await start(new Request('http://localhost/api/quiz/start', {
    method: 'POST',
    body: JSON.stringify({ nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', session_token: TOKEN }),
    headers: { 'x-forwarded-for': ip() },
  }))
  const answer = criarHandlerAnswer(repo)
  for (const num of [1, 2, 3]) {
    await answer(new Request('http://localhost/api/quiz/answer', {
      method: 'POST',
      body: JSON.stringify({ session_token: TOKEN, num, escolhida: 'B' }),
      headers: { 'x-forwarded-for': ip() },
    }))
  }
}

function fazerRequisicao(corpo: unknown) {
  return new Request('http://localhost/api/quiz/finish', {
    method: 'POST',
    body: JSON.stringify(corpo),
    headers: { 'x-forwarded-for': ip() },
  })
}

describe('POST /api/quiz/finish', () => {
  it('conclui e retorna o resultado quando todas as perguntas foram respondidas', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarEResponderTudo(repo)
    const handler = criarHandlerFinish(repo)
    const res = await handler(fazerRequisicao({ session_token: TOKEN }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.score_geral_pct).toBe(100)
  })

  it('retorna 422 quando faltam respostas', async () => {
    const repo = criarFakeSessionRepo()
    const start = criarHandlerStart(repo)
    await start(new Request('http://localhost/api/quiz/start', {
      method: 'POST',
      body: JSON.stringify({ nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', session_token: TOKEN }),
      headers: { 'x-forwarded-for': ip() },
    }))
    const handler = criarHandlerFinish(repo)
    const res = await handler(fazerRequisicao({ session_token: TOKEN }))
    expect(res.status).toBe(422)
  })

  it('retorna 409 numa segunda chamada de finish', async () => {
    const repo = criarFakeSessionRepo()
    await iniciarEResponderTudo(repo)
    const handler = criarHandlerFinish(repo)
    await handler(fazerRequisicao({ session_token: TOKEN }))
    const res = await handler(fazerRequisicao({ session_token: TOKEN }))
    expect(res.status).toBe(409)
  })

  it('retorna 404 para session_token inexistente', async () => {
    const repo = criarFakeSessionRepo()
    const handler = criarHandlerFinish(repo)
    const res = await handler(fazerRequisicao({ session_token: 'nao-existe' }))
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/quiz/finish/route.test.ts`
Expected: FAIL with "Cannot find module './route'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// app/api/quiz/finish/route.ts
import { NextResponse } from 'next/server'
import { criarSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { criarSupabaseSessionRepo } from '@/lib/server/supabaseSessionRepo'
import type { SessionRepo } from '@/lib/server/sessionRepo'
import { concluirSessao, SessaoInvalidaError, SessaoConcluidaError, SessaoIncompletaError } from '@/lib/server/quizService'
import { permitirRequisicao } from '@/lib/server/rateLimit'

export const runtime = 'nodejs'

function ipDaRequisicao(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'desconhecido'
}

export function criarHandlerFinish(repo: SessionRepo) {
  return async function handler(req: Request): Promise<Response> {
    if (!permitirRequisicao(`finish:${ipDaRequisicao(req)}`, 10, 60_000)) {
      return NextResponse.json({ erro: 'muitas requisições' }, { status: 429 })
    }

    let corpo: unknown
    try {
      corpo = await req.json()
    } catch {
      return NextResponse.json({ erro: 'json inválido' }, { status: 400 })
    }

    const { session_token: sessionToken } = (corpo ?? {}) as Record<string, unknown>
    if (typeof sessionToken !== 'string') {
      return NextResponse.json({ erro: 'corpo inválido' }, { status: 422 })
    }

    try {
      const sessao = await concluirSessao(repo, sessionToken)
      return NextResponse.json({
        score_geral_pct: sessao.scoreGeralPct,
        acertos: sessao.acertos,
        total: sessao.total,
        area_prioritaria: sessao.areaPrioritaria,
        areas: sessao.areas,
      }, { status: 200 })
    } catch (e) {
      if (e instanceof SessaoInvalidaError) return NextResponse.json({ erro: 'sessão não encontrada' }, { status: 404 })
      if (e instanceof SessaoConcluidaError) return NextResponse.json({ erro: 'sessão já concluída' }, { status: 409 })
      if (e instanceof SessaoIncompletaError) return NextResponse.json({ erro: 'faltam respostas' }, { status: 422 })
      throw e
    }
  }
}

export async function POST(req: Request): Promise<Response> {
  return criarHandlerFinish(criarSupabaseSessionRepo(criarSupabaseAdmin()))(req)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/quiz/finish/route.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/quiz/finish/route.ts app/api/quiz/finish/route.test.ts
git commit -m "feat: add POST /api/quiz/finish route handler

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 13: `GET /api/quiz/result`

**Files:**
- Create: `app/api/quiz/result/route.ts`
- Test: `app/api/quiz/result/route.test.ts`

**Interfaces:**
- Consumes: `buscarResultado` (Task 7); `criarHandlerStart`/`criarHandlerAnswer`/`criarHandlerFinish` (Tasks 10-12, test-only, to set up fixtures); `criarFakeSessionRepo` (Task 6, test-only).
- Produces: `criarHandlerResult(repo: SessionRepo): (req: Request) => Promise<Response>`, exported `GET`.

- [ ] **Step 1: Write the failing test**

```typescript
// app/api/quiz/result/route.test.ts
import { describe, it, expect } from 'vitest'
import { criarHandlerResult } from './route'
import { criarHandlerStart } from '../start/route'
import { criarHandlerAnswer } from '../answer/route'
import { criarHandlerFinish } from '../finish/route'
import { criarFakeSessionRepo } from '@/lib/server/testHelpers/fakeSessionRepo'

const TOKEN = 'aaaaaaaa-1111-1111-1111-111111111111'

function ip() {
  return `10.0.4.${Math.floor(Math.random() * 250)}`
}

describe('GET /api/quiz/result', () => {
  it('retorna 404 quando a sessão não existe', async () => {
    const repo = criarFakeSessionRepo()
    const handler = criarHandlerResult(repo)
    const res = await handler(new Request(`http://localhost/api/quiz/result?session_token=nao-existe`))
    expect(res.status).toBe(404)
  })

  it('retorna 404 quando a sessão existe mas não foi concluída', async () => {
    const repo = criarFakeSessionRepo()
    const start = criarHandlerStart(repo)
    await start(new Request('http://localhost/api/quiz/start', {
      method: 'POST',
      body: JSON.stringify({ nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', session_token: TOKEN }),
      headers: { 'x-forwarded-for': ip() },
    }))
    const handler = criarHandlerResult(repo)
    const res = await handler(new Request(`http://localhost/api/quiz/result?session_token=${TOKEN}`))
    expect(res.status).toBe(404)
  })

  it('retorna o resultado quando a sessão está concluída', async () => {
    const repo = criarFakeSessionRepo()
    const start = criarHandlerStart(repo)
    await start(new Request('http://localhost/api/quiz/start', {
      method: 'POST',
      body: JSON.stringify({ nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com', session_token: TOKEN }),
      headers: { 'x-forwarded-for': ip() },
    }))
    const answer = criarHandlerAnswer(repo)
    for (const num of [1, 2, 3]) {
      await answer(new Request('http://localhost/api/quiz/answer', {
        method: 'POST',
        body: JSON.stringify({ session_token: TOKEN, num, escolhida: 'B' }),
        headers: { 'x-forwarded-for': ip() },
      }))
    }
    await criarHandlerFinish(repo)(new Request('http://localhost/api/quiz/finish', {
      method: 'POST',
      body: JSON.stringify({ session_token: TOKEN }),
      headers: { 'x-forwarded-for': ip() },
    }))

    const handler = criarHandlerResult(repo)
    const res = await handler(new Request(`http://localhost/api/quiz/result?session_token=${TOKEN}`))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.score_geral_pct).toBe(100)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/quiz/result/route.test.ts`
Expected: FAIL with "Cannot find module './route'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// app/api/quiz/result/route.ts
import { NextResponse } from 'next/server'
import { criarSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { criarSupabaseSessionRepo } from '@/lib/server/supabaseSessionRepo'
import type { SessionRepo } from '@/lib/server/sessionRepo'
import { buscarResultado } from '@/lib/server/quizService'

export const runtime = 'nodejs'

export function criarHandlerResult(repo: SessionRepo) {
  return async function handler(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const sessionToken = url.searchParams.get('session_token')
    if (!sessionToken) return NextResponse.json({ erro: 'session_token obrigatório' }, { status: 422 })

    const sessao = await buscarResultado(repo, sessionToken)
    if (!sessao) return NextResponse.json({ erro: 'não encontrado' }, { status: 404 })

    return NextResponse.json({
      score_geral_pct: sessao.scoreGeralPct,
      acertos: sessao.acertos,
      total: sessao.total,
      area_prioritaria: sessao.areaPrioritaria,
      areas: sessao.areas,
    }, { status: 200 })
  }
}

export async function GET(req: Request): Promise<Response> {
  return criarHandlerResult(criarSupabaseSessionRepo(criarSupabaseAdmin()))(req)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/quiz/result/route.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/quiz/result/route.ts app/api/quiz/result/route.test.ts
git commit -m "feat: add GET /api/quiz/result route handler

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 14: Client-side storage helper

**Files:**
- Create: `lib/storage.ts`
- Test: `lib/storage.test.ts`

**Interfaces:**
- Produces: `type EstadoQuiz = { sessionToken: string; nome: string; whatsapp: string; email: string }`, `carregarEstado(): EstadoQuiz | null`, `salvarEstado(estado: EstadoQuiz): void`, `criarNovoSessionToken(): string`, `limparEstado(): void` — consumed by Task 15 (`Quiz.tsx`).

- [ ] **Step 1: Write the failing test**

```typescript
// lib/storage.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { carregarEstado, salvarEstado, limparEstado, criarNovoSessionToken } from './storage'

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('retorna null quando não há estado salvo', () => {
    expect(carregarEstado()).toBeNull()
  })

  it('salva e recupera o estado', () => {
    const estado = { sessionToken: 'tok-1', nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com' }
    salvarEstado(estado)
    expect(carregarEstado()).toEqual(estado)
  })

  it('limpa o estado', () => {
    salvarEstado({ sessionToken: 'tok-1', nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com' })
    limparEstado()
    expect(carregarEstado()).toBeNull()
  })

  it('gera um session token no formato uuid', () => {
    const token = criarNovoSessionToken()
    expect(token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/storage.test.ts`
Expected: FAIL with "Cannot find module './storage'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/storage.ts
export type EstadoQuiz = {
  sessionToken: string
  nome: string
  whatsapp: string
  email: string
}

const CHAVE = 'quiz-tribunais-comercial:v1'

export function carregarEstado(): EstadoQuiz | null {
  if (typeof window === 'undefined') return null
  try {
    const bruto = localStorage.getItem(CHAVE)
    if (!bruto) return null
    return JSON.parse(bruto) as EstadoQuiz
  } catch {
    return null
  }
}

export function salvarEstado(estado: EstadoQuiz): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado))
  } catch {
    // silencioso de propósito: falha ao persistir não deve travar o quiz
  }
}

export function limparEstado(): void {
  try {
    localStorage.removeItem(CHAVE)
  } catch {
    // idem
  }
}

export function criarNovoSessionToken(): string {
  return crypto.randomUUID()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/storage.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/storage.ts lib/storage.test.ts
git commit -m "feat: add client-side localStorage helper for quiz state

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 15: Quiz component (cover → quiz → result)

**Files:**
- Create: `components/Quiz.tsx`
- Test: `components/Quiz.test.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `carregarEstado`, `salvarEstado`, `criarNovoSessionToken` (Task 14); `QUESTIONS` (Task 3) — for rendering only, the component never derives `gabarito`/`acertou` itself, it only sends `{num, escolhida}` to `/api/quiz/answer`.
- Produces: default export `Quiz` React component — consumed by Task 15's own `app/page.tsx` wiring (final consumer, no later task depends on this).

- [ ] **Step 1: Write the failing test**

```tsx
// components/Quiz.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Quiz from './Quiz'

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/api/quiz/start')) {
      return new Response(JSON.stringify({ session_token: 'tok-1', retomando: false, respostasSalvas: [] }), { status: 200 })
    }
    if (url.includes('/api/quiz/answer')) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }
    return new Response(JSON.stringify({}), { status: 200 })
  }))
})

describe('Quiz', () => {
  it('mostra a tela de capa com o formulário de identificação', () => {
    render(<Quiz />)
    expect(screen.getByPlaceholderText('Seu nome')).toBeInTheDocument()
  })

  it('avança para a primeira pergunta depois de preencher o formulário e iniciar', async () => {
    render(<Quiz />)
    fireEvent.change(screen.getByPlaceholderText('Seu nome'), { target: { value: 'Maria' } })
    fireEvent.change(screen.getByPlaceholderText('(DDD) 00000-0000'), { target: { value: '11987654321' } })
    fireEvent.change(screen.getByPlaceholderText('Seu melhor e-mail'), { target: { value: 'maria@x.com' } })
    fireEvent.click(screen.getByText('Iniciar diagnóstico'))
    await waitFor(() => expect(screen.getByText(/Questão 1/)).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/Quiz.test.tsx`
Expected: FAIL with "Cannot find module './Quiz'"

- [ ] **Step 3: Write minimal implementation**

```tsx
// components/Quiz.tsx
'use client'

import { useEffect, useState } from 'react'
import { QUESTIONS } from '@/lib/questions'
import { carregarEstado, salvarEstado, criarNovoSessionToken, type EstadoQuiz } from '@/lib/storage'

type Tela = 'capa' | 'quiz' | 'resultado'
type Resultado = {
  score_geral_pct: number
  acertos: number
  total: number
  area_prioritaria: string
  areas: Record<string, { acertos: number; total: number; pct: number }>
}

const TOTAL = QUESTIONS.length

export default function Quiz() {
  const [tela, setTela] = useState<Tela>('capa')
  const [atual, setAtual] = useState(0)
  const [estado, setEstado] = useState<EstadoQuiz | null>(null)
  const [nome, setNome] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<Resultado | null>(null)

  useEffect(() => {
    const salvo = carregarEstado()
    if (salvo) setEstado(salvo)
  }, [])

  async function iniciar() {
    setErro(null)
    const sessionToken = estado?.sessionToken ?? criarNovoSessionToken()
    const res = await fetch('/api/quiz/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, whatsapp, email, session_token: sessionToken }),
    })
    if (!res.ok) {
      setErro('Não foi possível iniciar. Confira seus dados.')
      return
    }
    const json = await res.json()
    const novoEstado: EstadoQuiz = { sessionToken: json.session_token, nome, whatsapp, email }
    salvarEstado(novoEstado)
    setEstado(novoEstado)
    setAtual(json.respostasSalvas?.length ?? 0)
    setTela('quiz')
  }

  async function responder(letra: string) {
    if (!estado) return
    const questao = QUESTIONS[atual]
    await fetch('/api/quiz/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_token: estado.sessionToken, num: questao.num, escolhida: letra }),
    })
    if (atual === TOTAL - 1) {
      await concluir()
    } else {
      setAtual((n) => n + 1)
    }
  }

  async function concluir() {
    if (!estado) return
    const res = await fetch('/api/quiz/finish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_token: estado.sessionToken }),
    })
    if (res.ok) {
      setResultado(await res.json())
      setTela('resultado')
    }
  }

  if (tela === 'capa') {
    return (
      <div>
        <h1>Descubra seu nível para carreiras de Tribunais</h1>
        {erro && <p role="alert">{erro}</p>}
        <input placeholder="Seu nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        <input placeholder="(DDD) 00000-0000" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
        <input placeholder="Seu melhor e-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button onClick={iniciar}>Iniciar diagnóstico</button>
      </div>
    )
  }

  if (tela === 'quiz') {
    const questao = QUESTIONS[atual]
    return (
      <div>
        <p>Questão {atual + 1} de {TOTAL}</p>
        <p>{questao.statement}</p>
        {questao.options.map((o) => (
          <button key={o.letter} onClick={() => responder(o.letter)}>
            {o.letter}) {o.text}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div>
      <h2>Diagnóstico concluído</h2>
      {resultado && (
        <>
          <p>{resultado.score_geral_pct}% de aproveitamento</p>
          <p>{resultado.acertos} de {resultado.total} corretas</p>
          <p>Área prioritária: {resultado.area_prioritaria}</p>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/Quiz.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Wire the root page**

```tsx
// app/page.tsx
import Quiz from '@/components/Quiz'

export default function Page() {
  return <Quiz />
}
```

- [ ] **Step 6: Verify the full build still succeeds**

Run: `npm run build`
Expected: build completes with no errors (route handlers still fail at runtime without real Supabase env vars, but that's expected — this only checks compilation)

- [ ] **Step 7: Commit**

```bash
git add components/Quiz.tsx components/Quiz.test.tsx app/page.tsx
git commit -m "feat: add Quiz component wired to the four API endpoints

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 16: RLS verification script

**Files:**
- Create: `scripts/verificar-rls.md`

**Interfaces:**
- None — this is a manual verification runbook, not code other tasks depend on.

- [ ] **Step 1: Write the verification runbook**

```markdown
# Verificação de RLS — quiz_sessions

Depois de aplicar a migration no projeto Supabase real (`supabase db push` ou pelo dashboard), confirme que a chave `anon` não consegue ler nem escrever na tabela:

## 1. Tentar ler com a chave anon (deve falhar)

\`\`\`bash
curl -s "$SUPABASE_URL/rest/v1/quiz_sessions?select=*" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY"
\`\`\`

Esperado: array vazio `[]` (RLS bloqueia sem retornar erro, por padrão do PostgREST) — nunca dados reais, mesmo que existam linhas na tabela.

## 2. Tentar escrever com a chave anon (deve falhar)

\`\`\`bash
curl -s -X POST "$SUPABASE_URL/rest/v1/quiz_sessions" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"session_token":"00000000-0000-0000-0000-000000000000","nome":"teste","whatsapp":"x","whatsapp_normalizado":"x","email":"x@x.com","email_normalizado":"x@x.com"}'
\`\`\`

Esperado: erro (RLS impede o insert; resposta HTTP não-2xx, corpo indicando violação de policy/permissão).

## 3. Confirmar que a service_role consegue ler/escrever

\`\`\`bash
curl -s "$SUPABASE_URL/rest/v1/quiz_sessions?select=*" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
\`\`\`

Esperado: `200` com os dados reais (a service_role ignora RLS).
```

- [ ] **Step 2: Commit**

```bash
git add scripts/verificar-rls.md
git commit -m "docs: add manual RLS verification runbook

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Identificação do lead + validação → Task 10.
- Gravação incremental por resposta / saber onde parou → Task 11 (upsert por `num`).
- Diagnóstico determinístico (score/área/área prioritária) → Task 4.
- Sem link para o resultado / reexibição só se concluído → Task 13, enforced in `buscarResultado` (Task 7).
- Dedupe por pessoa (cascata email → whatsapp → sem merge por uid isolado), sobrescrita em retomada/conclusão → Task 7, `unique (evento, email_normalizado)` → Task 8.
- RLS sem policy pública → Task 8 (migration) + Task 16 (verification).
- `service_role` só no servidor → Task 9 + Task 10-13 (`runtime = 'nodejs'`, env vars never `NEXT_PUBLIC_`).
- Servidor sempre recalcula resultado, nunca aceita do cliente → Task 7 (`registrarResposta` only accepts `{num, escolhida}`), Task 15 (component only ever sends that shape).
- Rate-limit mínimo nos 3 endpoints de escrita → Task 5 + Task 10-12.
- Identidade visual com os 2 hex confirmados, resto pendente → Task 1, Step 5.
- Perguntas novas (placeholder) → Task 3, explicitly labeled.
- Deploy Vercel, env vars via `vercel env` → not a code task; covered by `.env.example` (Task 1) — no plan task needed since it's an operational step the user runs outside this codebase.

**Placeholder scan:** no "TBD"/"implement later" strings; the one intentionally-placeholder content (Task 3's sample questions) is real, concrete text explicitly labeled as sample per the spec's own scope decision, not a vague instruction.

**Type consistency:** `QuizSession`, `SessionRepo`, `RespostaResumo`, `AreaResumo`, `RespostaEntrada` are defined once (Tasks 4, 6) and referenced identically by name in every later task. `criarHandlerX(repo: SessionRepo)` factory pattern is consistent across Tasks 10-13, confirmed by cross-task test imports (Task 11 imports `criarHandlerStart` from Task 10, Task 12 imports both, Task 13 imports all three) — a naming mismatch here would break those tests during development, self-enforcing consistency.
