# Arquitetura — Quiz Tribunais (Diagnóstico da Base)

Funil comercial da VDE para carreiras de Tribunais. A pessoa faz um quiz de diagnóstico, recebe um resultado na tela e, em background, o sistema gera dois PDFs (diagnóstico e apresentação comercial). O time de vendas fecha a venda manualmente a partir do lead.

O projeto tem duas peças:

- **App Next.js**: quiz público, APIs, painel admin e todo o motor de cálculo.
- **Serviço Python** (`services/diagnostico-pdf`): gera os PDFs com Chromium headless.

Fora do repositório: **Supabase** (banco), **S3** (PDFs) e a automação **WF G**, que lê o Supabase e envia os leads para a **Clint** (CRM).

## Visão geral

```
 Lead (navegador)                    Next.js 16 / React 19                         Supabase (Postgres)
┌───────────────────┐   /api/quiz/*  ┌───────────────────────────────┐  supabase-js  ┌──────────────┐
│ components/Quiz   │───────────────▶│ Route Handlers                │──────────────▶│ quiz_sessions │
│ (máquina de telas)│◀───────────────│  start·perfil·answer·finish   │ service_role  │ leads_desqual.│
└───────────────────┘                │  result·whatsapp              │               └──────┬───────┘
                                     │ lib/ (motor: scoring, perfil, │                      │ lido pelo WF G
                                     │  blocos) + lib/server/        │                      ▼
                                     └──────┬───────────────┬────────┘               Clint (CRM)
                                  after() em │               │ /api/laudo/[token]
                                  background │               │ /api/apresentacao/[token]  (302 → URL assinada)
                                             ▼               ▼
                           ┌──────────────────────────────────────┐        ┌────────┐
                           │ services/diagnostico-pdf (FastAPI)   │ upload │   S3   │
                           │ POST /laudo · POST /apresentacao     │───────▶│ PDFs   │
                           │ Playwright + Chromium headless       │        └────────┘
                           └──────────────────────────────────────┘
```

## Estrutura do repositório

| Caminho | Conteúdo |
|---|---|
| `app/` | Páginas e Route Handlers do Next (quiz, admin, `api/quiz/*`, `api/laudo`, `api/apresentacao`, `api/admin/*`) |
| `components/` | `Quiz.tsx` (quiz inteiro, ~1.860 linhas) e componentes de UI e admin |
| `lib/` | Motor do quiz: conteúdo, nota, perfil, blocos |
| `lib/server/` | Serviços de servidor: sessão, Supabase, S3, cliente do serviço de PDF, rate limit, auth do admin |
| `lib/data/blocos.json` | Os 46 blocos condicionais do diagnóstico |
| `reference/raio-x-da-base/` | Pacote Python de referência entregue pelo cliente (regras, textos, 8 casos de teste) |
| `services/diagnostico-pdf/` | Serviço Python que gera os PDFs |
| `supabase/migrations/` | Schema do banco |
| `docs/superpowers/` | Specs e planos de implementação |

## 1. O motor do quiz

O motor roda no **servidor**, em TypeScript, dentro de `lib/`. O cliente só envia respostas cruas. O servidor sempre recalcula o resultado e nunca aceita um resultado vindo do cliente.

| Peça | Arquivo | O que faz |
|---|---|---|
| Conteúdo | `lib/quizContent.ts`, `lib/questions.ts` | Telas de perfilamento (`PERFIL_SCREENS`), 4 questões graduadas com gabarito, textos e configuração do WhatsApp |
| Nota | `lib/scoring.ts` | Valida `{num, escolhida}`, deriva gabarito e acerto, calcula % por área e a área prioritária |
| Perfil comercial | `lib/perfil.ts` | `calcularPerfil` dá classe A/B, curso indicado (`C1-TRT` ou `C2-TJTRF`) e ritmo de estudo. `nivelTeste` dá o nível pelos acertos |
| Blocos | `lib/blocos.ts` + `lib/data/blocos.json` | `selecionarBlocos` avalia regras (`eq`, `ne`, `wrong`, `right`, `score_min`, `score_max`, `editais_min`, `any`, `not`) sobre perfil e respostas. É um port fiel de `rules.py` do pacote de referência |
| Orquestração | `lib/server/quizService.ts` | `iniciarSessao`, `registrarPerfil`, `registrarResposta`, `concluirSessao` |

A nota do teste graduado (`scoring.ts`) é diferente do perfil comercial (`perfil.ts`): a primeira mede o conhecimento, a segunda qualifica o lead para o time de vendas.

## 2. Como o quiz é gerado e executado

### Frontend

`components/Quiz.tsx` é um componente único com uma máquina de estados de telas: `intro` → captura de nome, WhatsApp e e-mail → telas de perfil → 4 questões graduadas → resultado. Há também telas de desqualificação (carreira jurídica, cargo baixo, outro motivo).

### Fluxo de API

| Etapa | Rota | O que acontece |
|---|---|---|
| Início | `POST /api/quiz/start` | O `session_token` é gerado no cliente (`crypto.randomUUID()`) e guardado em `localStorage`. A sessão é criada ou retomada. Dedupe por e-mail e WhatsApp normalizados: uma linha por pessoa por evento. Grava as UTMs de entrada |
| Perfil | `POST /api/quiz/perfil` | Mescla respostas de perfilamento na sessão |
| Resposta | `POST /api/quiz/answer` | Cliente envia só `{num, escolhida}`. O servidor deriva o resto de `questions.ts` |
| Conclusão | `POST /api/quiz/finish` | Calcula nota, áreas, perfil e blocos. Marca `concluido` (sessão imutável). Dispara a geração dos PDFs em background e responde sem esperar |
| Resultado | `GET /api/quiz/result` | Reexibe o resultado após F5, só se a sessão estiver concluída |
| WhatsApp | `POST /api/quiz/whatsapp` | Registra o clique no CTA |
| Desqualificado | `POST /api/leads/desqualificado` | Grava em `leads_desqualificados` (motivo carreira jurídica) |

O progresso é gravado aos poucos, o que permite saber em qual pergunta cada pessoa abandonou. Todas as rotas têm rate limit em memória (`lib/server/rateLimit.ts`) e validação de UUID.

### Admin

Em `/admin`, com login por senha e cookie assinado (`lib/server/adminAuth.ts`): lista de leads, detalhe com campos copiáveis, analytics (funil, gráficos), exportação CSV e geração dos PDFs sob demanda.

## 3. O serviço que gera o PDF

`services/diagnostico-pdf` é um FastAPI em Python 3.12, empacotado em Docker (`python:3.12-slim-bookworm` + `playwright install --with-deps chromium`). Roda como container na AWS. O deploy não sai deste repositório: o código é publicado aqui no GitHub e a equipe copia para outro repositório, que é conectado à AWS.

Requisitos de deploy:
- Build a partir de `services/diagnostico-pdf` (o `Dockerfile` está lá).
- Variáveis: `LAUDO_SERVICE_SECRET` (e `LAUDO_SERVICE_URL` no lado do Next) e as credenciais do S3.

Endpoints, todos exceto `/health` protegidos por `X-Laudo-Secret` (comparação em tempo constante; sem segredo configurado, recusa tudo):

| Endpoint | Gera |
|---|---|
| `POST /laudo` | Diagnóstico personalizado, A4 |
| `POST /apresentacao` | Deck comercial de 22 telas |
| `GET /health` | Status |

Arquivos principais: `main.py` (rotas), `render.py` (Playwright), `brand.py` (overrides de marca), `apresentacao.py` (variáveis do deck), `s3.py` (upload).

O serviço é auto-contido. `vendor/raio-x-da-base` e `vendor/brand` são cópias de `reference/raio-x-da-base` e `public/brand`, porque o contexto do build do container não alcança fora do diretório. O teste `lib/server/diagnosticoVendorParity.test.ts` garante que as cópias não divergem.

## 4. Como o PDF é impresso

### Disparo

No `finish`, o Next usa `after()` para rodar em background, com `Promise.all` das duas gerações (`lib/server/diagnosticoPdfBackground.ts`):

1. Valida a sessão (`validarSessaoParaDiagnostico`).
2. Monta o payload (`lib/server/diagnosticoService.ts`) e faz `POST` no serviço Python.
3. O serviço devolve o PDF e a chave do S3. A chave é gravada em `laudo_pdf_s3_key` ou `apresentacao_pdf_s3_key`.
4. Em caso de falha, o erro vai para `laudo_pdf_erro` ou `apresentacao_pdf_erro`. Nunca é lançada exceção, porque não há ninguém do outro lado para tratá-la.

### Diagnóstico (`/laudo`) — texto vetorial

1. `Lead(dados)` valida o perfil (422 se inválido).
2. `report.build_html()` do pacote monta o HTML autocontido, com fontes e logo embutidos.
3. `brand.py` aplica os overrides de marca sem editar o pacote: paleta do app, logo, nome "Diagnóstico da Base", voz "nosso time" e CTA de WhatsApp com mensagem pré-preenchida.
4. `render.html_para_pdf` abre a página com `page.set_content` no Chromium e imprime com `page.pdf()` em A4, com rodapé. O PDF tem **texto selecionável**.

### Apresentação (`/apresentacao`) — imagens

1. `apresentacao.py::variaveis()` calcula os textos do lead e a condição comercial da tela 19.
2. `render.deck_para_pdf` carrega `vendor/vde-tribunais-call/deck.html` via `file://` em 1920×1080 e injeta as variáveis nos elementos `[data-var]`.
3. Para cada slide (`capa` + 1 a 21), ativa o slide, tira um screenshot PNG e junta tudo com `img2pdf`.

Esse PDF é feito de **imagens**: não tem texto pesquisável e fica com cerca de 14 MB.

### Condição comercial vigente (tela 19)

- Preço cheio R$ 1.997,00, riscado.
- À vista **R$ 1.697,00** (≈15% de desconto; o desconto real é 15,02%).
- **12x de R$ 165,34**, valor fixo no código (`parcela`).

Se o preço ou a condição do gateway mudar, é preciso atualizar `condicao_new` e `parcela` em `apresentacao.py`. Os valores de exemplo e as notas do roteiro estão em `vendor/vde-tribunais-call/deck.html`.

## 5. Armazenamento e entrega

- **S3** (`services/diagnostico-pdf/s3.py`, `lib/server/s3.ts`): `laudos/<session_token>.pdf` e `apresentacoes/<session_token>.pdf`.
- **Links estáveis para o CRM:** `/api/laudo/[token]` e `/api/apresentacao/[token]` usam o `laudo_token`, um UUID que nunca muda. O `session_token` é reescrito quando a pessoa retoma o quiz, então não serve de chave. As rotas respondem 302 para uma URL assinada nova a cada acesso (a assinatura do S3 expira em no máximo 7 dias), com `Cache-Control: no-store`.
  - 425: PDF ainda sendo gerado.
  - 502: a geração falhou.
  - 503: S3 não configurado.
  - 404: token inválido ou sessão não concluída.
  - A rota da apresentação gera na hora como rede de segurança.
- **Sincronização com a Clint:** o WF G (automação externa) lê `quiz_sessions` no Supabase e envia ao CRM. Este projeto só deixa os dados estruturados e deduplicados.

## 6. Banco de dados

Migrations em `supabase/migrations/`. O núcleo é a tabela `quiz_sessions`: dados do lead, perfil, respostas, nota, áreas, blocos, UTMs, `laudo_token`, chaves e erros dos PDFs, e clique no WhatsApp. `leads_desqualificados` guarda o motivo "carreira jurídica".

Todo acesso é pelo servidor via `supabase-js` com a chave `service_role` (`lib/server/supabaseAdmin.ts`, `supabaseSessionRepo.ts`). O cliente nunca fala com o banco.

## 7. Variáveis de ambiente

| Variável | Uso |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Acesso ao banco |
| `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` | Login do admin |
| `LAUDO_SERVICE_URL`, `LAUDO_SERVICE_SECRET` | Chamada ao serviço de PDF |
| `ACCESS_KEY`, `SECRET_KEY`, `BUCKET_NAME`, `REGION` | S3 |

Em servidor, a autenticação AWS deve preferir a cadeia padrão do SDK (IAM role). Chave e segredo ficam só como alternativa para desenvolvimento local.

## 8. Desenvolvimento e testes

- App: `npm run dev`, `npm run build`, `npm test` (Vitest). Os testes cobrem as rotas, o motor e os serviços de servidor.
- Serviço Python: `services/diagnostico-pdf/test_manual_8_casos.py` é um script manual (não pytest) que gera os 8 PDFs de aceite em `pdfs-teste-python/`.
- Mudanças só visuais são validadas no navegador, sem teste automatizado. Testes ficam para lógica de negócio.

## 9. Decisões de projeto

- **Uma tabela, um upsert:** sem log de eventos nem ETL, porque a única fonte de dados é o próprio quiz.
- **Servidor como fonte da verdade:** o resultado é sempre recalculado a partir das respostas gravadas e só é devolvido com a sessão concluída. Não existe link público do resultado.
- **Pacote de referência intocado:** os ajustes de marca ficam em `brand.py`, sem editar `reference/raio-x-da-base`.
- **PDF em background:** o lead recebe o resultado na hora, e os PDFs aparecem depois. Falhas são registradas na sessão, nunca perdidas em silêncio.
- **Fora de escopo na v1:** endpoint de exclusão/anonimização LGPD (no backlog).

## Pontos de atenção

- **Deploy:** este repositório ainda tem integrações da Vercel conectadas. Os checks "Vercel" que aparecem nos commits (inclusive falhas) não fazem parte do deploy de produção e podem ser desconectados nas configurações da Vercel.
- O WF G não está neste repositório. Se ele falhar, nenhum lead chega à Clint, mesmo com o quiz funcionando.
- A parcela de 12x é um valor fixo. Não é calculada a partir de uma taxa.
- `vendor/` precisa ser mantido em sincronia com `reference/` e `public/brand`.
