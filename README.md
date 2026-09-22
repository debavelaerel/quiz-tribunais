# Diagnóstico da Base — Quiz VDE Tribunais

Funil de quiz comercial: a pessoa responde um teste graduado (4 questões
reais de concurso) + um perfilamento (alvo, cargo, tempo de estudo, dor,
momento etc.), e o sistema devolve um resultado personalizado na tela, um
**laudo em PDF** (gerado sozinho, em background) e — sob demanda, pelo
painel administrativo — uma **apresentação comercial em PDF** (deck pra
call 1:1 de vendas).

> Design system (cores, tipografia, componentes) está em [DESIGN.md](DESIGN.md) —
> não duplicado aqui.

## Stack

| Camada | Tecnologia |
|---|---|
| Front-end + API | Next.js 16 (App Router), React 19, TypeScript, Tailwind v4 |
| Banco de dados | Supabase (Postgres), acessado só pela `service_role` (sem policy pública) |
| Geração de PDF | Serviço próprio em Python (FastAPI + Playwright/Chromium headless), deploy separado, como container |
| Armazenamento de PDF | S3 (AWS SDK v3 no lado Next.js; boto3 no lado Python) |
| Autenticação do painel admin | Senha única + cookie HMAC-SHA256 (`node:crypto`), sem tabela de usuário |
| Testes | Vitest + Testing Library |

## Arquitetura

```
┌──────────────┐   fetch (JSON)    ┌────────────────────────┐
│  Quiz (React) │ ───────────────▶ │  Next.js API routes     │
│ components/   │ ◀─────────────── │  app/api/quiz/*          │
│  Quiz.tsx     │                  │  (Node.js runtime)       │
└──────────────┘                  └───────────┬──────────────┘
                                               │ service_role
                                               ▼
                                   ┌────────────────────────┐
                                   │   Supabase (Postgres)    │
                                   │   quiz_sessions           │
                                   │   leads_desqualificados   │
                                   └───────────┬──────────────┘
                                               │
                     laudo em background ──────┤──── apresentação sob demanda
                     (após /quiz/finish)       │     (clique do admin)
                                               ▼
                                   ┌────────────────────────┐
                                   │ services/laudo-pdf        │
                                   │ FastAPI + Chromium (Python)│
                                   │ POST /laudo, /apresentacao │
                                   └───────────┬──────────────┘
                                               │ sobe o PDF
                                               ▼
                                   ┌────────────────────────┐
                                   │           S3               │
                                   └────────────────────────┘
```

Dois deploys separados na Vercel:
- **App Next.js** (raiz do repo) — quiz público + painel `/admin`.
- **`services/laudo-pdf`** — container Docker à parte (Playwright precisa
  de Chromium instalado no sistema; não roda numa function serverless
  comum). No projeto da Vercel desse serviço, *Root Directory* precisa ser
  `services/laudo-pdf` (ver comentário no topo do `Dockerfile`).

## Estrutura de pastas

```
app/
  page.tsx                    — página pública do quiz (renderiza <Quiz />)
  api/quiz/                   — start, answer, perfil, finish, result, whatsapp
  api/leads/desqualificado/   — captura de lead fora do público-alvo
  api/laudo/[token]/          — link estável do laudo (redirect pro S3), usado no CRM
  api/apresentacao/[token]/   — (mesma família de rota, ver abaixo)
  api/admin/                  — login/logout, export CSV, geração de PDF sob demanda
  admin/                      — painel administrativo (login, leads, analytics)
components/
  Quiz.tsx                    — máquina de estados do funil inteiro (todas as telas)
  admin/                      — gráficos e tabelas do painel
lib/
  quizContent.ts              — conteúdo do funil (perguntas de perfil, editais, textos)
  questions.ts                — as 4 questões graduadas (deriva de quizContent.ts)
  scoring.ts / perfil.ts / blocos.ts / normalize.ts / validacao.ts / mascara.ts
  server/                     — tudo que roda só no servidor (ver abaixo)
services/laudo-pdf/           — serviço Python de geração de PDF (deploy próprio)
reference/raio-x-da-base/     — pacote de referência de conteúdo/estrutura do laudo (não editar)
supabase/migrations/          — schema do banco, em ordem cronológica
```

`lib/server/` é o núcleo do backend:

| Arquivo | Responsabilidade |
|---|---|
| `quizService.ts` | Regras do funil: iniciar/retomar sessão, registrar respostas/perfil, concluir, buscar resultado |
| `sessionRepo.ts` / `supabaseSessionRepo.ts` | Interface de persistência + implementação Supabase de `quiz_sessions` |
| `leadsDesqualificados.ts` / `*Repo.ts` | Mesma ideia, pra `leads_desqualificados` |
| `laudoService.ts` | Cliente HTTP do serviço Python (`/laudo` e `/apresentacao`) |
| `laudoPdfBackground.ts` | Orquestra a geração do laudo em background após `/quiz/finish` |
| `s3.ts` | URL assinada do laudo no S3 |
| `adminAuth.ts` | Login por senha única + cookie assinado (HMAC) |
| `rateLimit.ts` | Rate limit em memória (por IP, por rota) |
| `csv.ts` / `listarTudo.ts` | Exportação CSV do painel admin (com paginação) |

## O funil, passo a passo

1. **Capa / nome** (`components/Quiz.tsx`) — a pessoa informa nome (a
   versão principal do quiz só pede o nome nessa tela; e-mail/whatsapp vêm
   depois, na tela `contato`).
2. **`POST /api/quiz/start`** — cria (ou retoma) uma `quiz_session`.
   - Retomada é por e-mail **ou** whatsapp normalizado, não por
     `session_token` — a mesma pessoa reabrindo o quiz noutro aparelho cai
     na mesma sessão.
   - Uma sessão **já concluída nunca é resetada** — retomar só atualiza
     `session_token`/contato, preserva respostas e resultado.
3. **Vídeo** — tela `video`, autoplay mudo (Panda Video, `CONFIG.videoSrc`
   em `lib/quizContent.ts`).
4. **Teste graduado** (tela `quiz`, 4 questões reais de concurso, gabarito
   oficial FGV/FCC) — cada resposta:
   - **`POST /api/quiz/answer`** (fluxo `padrao`, uma chamada por questão), ou
   - fica em memória e vai tudo junto no fluxo `final` (ver item 6).
5. **Correção** (tela `correcao`) + **Perfilamento** (tela `perfil`, ~13
   perguntas: alvo, cargo, formação, tempo de estudo, provas feitas,
   método, edital de interesse, dor, momento, dinheiro, leitura...).
   - Quem não se qualifica (carreira jurídica, cargo abaixo do alvo) cai em
     `desqualificado` → `desqualificado_contato` → **`POST
     /api/leads/desqualificado`** (tabela separada, não polui as métricas
     do funil principal).
   - Fluxo `padrao`: cada resposta de perfil vai por **`POST
     /api/quiz/perfil`** (merge, não substitui).
6. **Contato + conclusão**
   - Fluxo `padrao`: contato já foi capturado em `start`; a tela final só
     chama **`POST /api/quiz/finish`**.
   - Fluxo `final`: a pessoa respondeu tudo em memória; no clique de
     contato, o app grava respostas + perfil em lote (uma leitura + uma
     escrita) e conclui — evita várias idas ao banco na tela final.
   - `finish` calcula score/áreas (`lib/scoring.ts`), perfil calculado
     (`lib/perfil.ts`) e os blocos de texto condicionais
     (`lib/blocos.ts`), marca `status = concluido` e **dispara em
     background** (via `after()` do Next.js, fire-and-forget) a geração do
     laudo em PDF — sem atrasar a resposta pra quem terminou.
7. **Resultado** (tela final) — busca via **`GET
   /api/quiz/result?session_token=`**: score geral, áreas fortes/fracas,
   blocos de conteúdo personalizados, CTA de WhatsApp.
   - Clique no CTA dispara **`POST /api/quiz/whatsapp`** (fire-and-forget,
     só grava o primeiro clique — sinal de intenção de compra pro painel).
8. **Laudo em PDF (background)** — `lib/server/laudoPdfBackground.ts`
   chama o serviço Python (`POST /laudo`), que renderiza com Chromium
   headless e sobe pro S3; a chave do objeto S3 fica salva em
   `quiz_sessions.laudo_pdf_s3_key` (erro, se houver, em
   `laudo_pdf_erro` — nunca propaga pro usuário).
9. **Link estável pro CRM** — **`GET /api/laudo/[laudoToken]`**: gera uma
   URL assinada do S3 (5 min) a cada acesso e redireciona (302). O
   `laudoToken` é fixo desde a criação da sessão (ao contrário do
   `session_token`, que muda a cada retomada) — por isso é ele, não o
   `session_token`, que vai pro CRM.
10. **Apresentação comercial (sob demanda)** — no painel admin, o botão
    "Baixar apresentação comercial" chama **`GET
    /api/admin/leads/[token]/apresentacao`**: mesmo serviço Python, mesmo
    payload de perfil, endpoint `/apresentacao` (deck de 22 telas pra call
    1:1, template HTML diferente do laudo). Não roda em background, não
    tem link público — o PDF volta direto na resposta pro admin.

## Banco de dados

Duas tabelas em Supabase/Postgres, sem policy pública de RLS — só a
`service_role` (usada nas Route Handlers) acessa. Schema evolui por
migrations em `supabase/migrations/` (ordem cronológica no nome do
arquivo):

**`quiz_sessions`** — uma linha por pessoa/sessão de quiz.
- Identidade: `session_token` (uuid, reescrito a cada retomada),
  `laudo_token` (uuid, fixo — usado no link do CRM), `evento`, `fluxo`
  (`padrao`/`final`, só informativo).
- Contato: `nome`, `whatsapp[_normalizado]`, `email[_normalizado]` (unique
  por `evento` + `email_normalizado`).
- Progresso/resultado: `status`, `respostas` (jsonb), `areas` (jsonb),
  `score_geral_pct`, `acertos`, `total`, `area_prioritaria`, `perfil`
  (jsonb), `blocos` (jsonb).
- Sinal comercial: `whatsapp_clicado_em`.
- Materiais gerados: `laudo_pdf_s3_key`/`laudo_pdf_erro`,
  `apresentacao_pdf_s3_key`/`apresentacao_pdf_erro` — **colunas na mesma
  tabela**, não tabelas separadas; os dois materiais pertencem 1:1 à mesma
  sessão.
- `started_at`, `updated_at` (trigger automático), `completed_at`.

**`leads_desqualificados`** — captura de contato de quem não é público-alvo
do Tribunais (interesse em carreira jurídica, cargo abaixo do alvo). Tabela
independente, sem dedupe, sem update — captura de uma vez só, pra não
contaminar as métricas do funil principal.

## Perguntas frequentes

**Criou uma tabela nova pros 2 materiais (laudo e apresentação)?**
Não. Os dois vivem como colunas na mesma tabela `quiz_sessions`:
`laudo_pdf_s3_key`/`laudo_pdf_erro` (já existiam) e
`apresentacao_pdf_s3_key`/`apresentacao_pdf_erro` (novas, adicionadas no
mesmo padrão — ver migration `20260921220000_quiz_sessions_apresentacao_pdf.sql`).

**É relacionada com a outra?**
Mais que relacionada — é a **mesma linha**. Não existe chave estrangeira nem
tabela separada, porque os dois materiais pertencem 1:1 à mesma sessão de
quiz (ver seção "Banco de dados" acima).

**Em quanto tempo ele gera os materiais?**
- **Laudo**: em segundo plano, assim que o quiz termina (`POST
  /api/quiz/finish`) — a pessoa não espera nada. O teto de segurança da
  chamada ao serviço Python é 55s (`AbortSignal.timeout`, ver
  `lib/server/laudoService.ts`); na prática sai bem mais rápido, é um PDF só.
- **Apresentação**: só quando o admin clica em "baixar" no painel — aí sim
  essa pessoa espera a resposta, com o mesmo teto de 55s.

## API

Convenção: fronteira JSON em `snake_case`; internamente o código é
`camelCase`. Toda rota roda em `runtime = 'nodejs'` (não Edge — algumas
dependem de `node:crypto`). Rotas de escrita passam por rate limit em
memória (`lib/server/rateLimit.ts`), por IP.

### Público (quiz)

| Rota | Método | Descrição |
|---|---|---|
| `/api/quiz/start` | POST | Cria/retoma sessão |
| `/api/quiz/answer` | POST | Registra 1 resposta do teste graduado |
| `/api/quiz/perfil` | POST | Registra 1 campo de perfilamento |
| `/api/quiz/finish` | POST | Conclui a sessão, calcula resultado, dispara laudo em background |
| `/api/quiz/result` | GET | Busca resultado de uma sessão concluída |
| `/api/quiz/whatsapp` | POST | Registra clique no CTA de WhatsApp (fire-and-forget) |
| `/api/leads/desqualificado` | POST | Captura contato de lead fora do público-alvo |
| `/api/laudo/[laudoToken]` | GET | Redireciona pra URL assinada do laudo no S3 (link estável, usado no CRM) |

### Admin (protegidas por `middleware.ts`, cookie de sessão)

| Rota | Método | Descrição |
|---|---|---|
| `/api/admin/login` | POST | Autentica com `ADMIN_PASSWORD`, emite cookie assinado |
| `/api/admin/logout` | POST | Derruba o cookie |
| `/api/admin/export` | GET | Exporta leads em CSV (filtros de status/fluxo/busca) |
| `/api/admin/leads/[token]/pdf` | GET | Gera (ou regenera) o laudo sob demanda e devolve o PDF direto |
| `/api/admin/leads/[token]/apresentacao` | GET | Gera a apresentação comercial sob demanda e devolve o PDF direto |

### Painel `/admin` (páginas)

`app/admin/(painel)/` — `layout.tsx` (nav), `leads/page.tsx` (lista +
filtros + export), `leads/[token]/page.tsx` (detalhe de um lead, botões de
baixar laudo/apresentação), `analytics/page.tsx` (funil, gráficos —
`components/admin/*`). Login em `app/admin/login/page.tsx`.

## Serviço de PDF (`services/laudo-pdf`)

FastAPI fino em volta de `reference/raio-x-da-base/diagnosis` (pacote de
referência de conteúdo/estrutura, mantido intocado — overrides de marca em
`brand.py`). Autenticado por segredo compartilhado (header
`X-Laudo-Secret`, falha fechada sem ele configurado).

- `POST /laudo` — recebe perfil + respostas + editais, devolve o PDF do
  laudo (relatório de diagnóstico). Sobe pro S3 se `session_token` vier no
  payload; devolve a chave no header `X-Laudo-S3-Key`.
- `POST /apresentacao` — mesmo payload, template diferente (deck de 22
  telas pra call 1:1, `vendor/vde-tribunais-call/deck.html`); chave no
  header `X-Apresentacao-S3-Key`.
- Renderização com Chromium headless via Playwright (`render.py`).
- `s3.py` — sobe o objeto; ausência de `S3_BUCKET` configurado não é erro,
  é "recurso ainda não ligado" (o lado Next.js trata isso como "sem link
  ainda", não como falha).

Deploy: container Docker próprio (`Dockerfile`, Python 3.12 slim-bookworm —
não "slim" puro, ver comentário no arquivo), *Root Directory* =
`services/laudo-pdf` no projeto Vercel correspondente.

## Variáveis de ambiente

| Variável | Onde | Descrição |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Next.js | Conexão com o Postgres (só service role, sem policy pública) |
| `ADMIN_PASSWORD` | Next.js | Senha única do painel `/admin` |
| `ADMIN_SESSION_SECRET` | Next.js | Assina o cookie de sessão do admin (HMAC) |
| `LAUDO_SERVICE_URL`, `LAUDO_SERVICE_SECRET` | Next.js | Base URL + segredo pra chamar `services/laudo-pdf` |
| `BUCKET_NAME`, `REGION`, `ACCESS_KEY`, `SECRET_KEY` | Next.js | Credenciais do S3 pra gerar URL assinada do laudo (nomes próprios, não os padrão `AWS_*` do SDK — a Vercel já injeta `AWS_*` próprias por function, que não têm nada a ver com o bucket) |

Ver `.env.example` (raiz) pra template das variáveis do Next.js. O serviço
Python usa suas próprias env vars de S3/segredo (ver `services/laudo-pdf/s3.py`),
configuradas à parte no deploy dele.

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencher Supabase + admin
npm run dev                  # http://localhost:3000
```

Sem `LAUDO_SERVICE_URL`/`LAUDO_SERVICE_SECRET` configurados, o quiz
funciona normalmente — só a geração de laudo/apresentação falha (fica
registrada em `laudo_pdf_erro`, nunca quebra o fluxo do usuário). Pra
rodar o serviço de PDF localmente: `cd services/laudo-pdf && pip install
-r requirements.txt && playwright install --with-deps chromium && uvicorn
main:app --reload`.

## Testes

```bash
npm test   # vitest run — cobre lib/, lib/server/ e componentes
```
Convenção do projeto: teste automatizado é reservado pra lógica de negócio
(scoring, normalização, validação, serviços de servidor); mudanças
puramente visuais/UX são validadas manualmente no navegador.
