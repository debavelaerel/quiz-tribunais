# Quiz de Diagnóstico — Funil Comercial Tribunais

**Data**: 2026-09-03 (revisado 2026-09-04)
**Status**: Aprovado para planejamento de implementação, com 2 dependências factuais pendentes (ver "Pendências antes da estilização")

## Contexto

A VDE já opera um quiz de diagnóstico (`vde-diagnostico-tribunais`, referência: https://github.com/davifacanhaa/vde-diagnostico-tribunais) que captura leads via n8n → Google Sheets. Este projeto é um **novo quiz**, mesma mecânica de diagnóstico, para o mesmo produto (carreiras de Tribunais), mas com propósito diferente: alimentar o **funil comercial** — o time de vendas fecha a venda manualmente a partir do lead qualificado pelo diagnóstico, em vez de autosserviço.

O lead e o progresso do quiz são persistidos em **Supabase**, de onde o time de infraestrutura roda uma automação própria que sincroniza com o CRM **Clint** e possivelmente outras ferramentas. Essa automação está fora do escopo deste projeto — o projeto só precisa deixar os dados bem estruturados, deduplicados por pessoa, e consultáveis.

### Pesquisa de reaproveitamento (2026-09-03)

Antes de fechar o desenho, foram avaliados dois projetos irmãos da mesma agência:
- **`~/code/data-mateus`** — data warehouse (schemas `raw`/`core`/`activation`, dimensões, fatos, resolução de identidade) para um cliente com múltiplas fontes assíncronas (Hotmart, Brevo, PostHog, pré-checkout).
- **`~/code/quiz-apego`** — quiz de diagnóstico sobre esse mesmo DW, com log de eventos idempotente, conexão direta ao Postgres via `pg`, e um endpoint de exclusão LGPD.

**Decisão**: não adotar o padrão de log de eventos + ETL + schemas `raw`/`core`. Esse padrão resolve reconciliação entre **múltiplas fontes de dados assíncronas e não confiáveis** — problema que este projeto não tem, já que a única fonte é o próprio quiz. Uma tabela única com upsert é suficiente e muito mais simples.

**O que foi reaproveitado** (independente de ter 1 ou várias fontes):
- `session_token` gerado no **cliente** (`crypto.randomUUID()`), não emitido pelo servidor — evita round-trip antes de começar, resume simples após F5.
- Servidor sempre recalcula o resultado a partir das respostas gravadas; nunca aceita um resultado vindo do cliente.
- Resultado só é retornado se a sessão está `concluido` — confirma o requisito de "sem link para o resultado".
- Acesso ao banco via `supabase-js` (REST/PostgREST) foi mantido — sem necessidade de funções Postgres customizadas nesta v1, `pg` direto seria complexidade extra sem ganho.
- Endpoint de exclusão/anonimização LGPD (visto no `quiz-apego`) foi **avaliado e adiado para o backlog** — não faz parte desta v1; revisitar quando houver prioridade/exigência para isso.

### Revisão adversarial (2026-09-04)

A spec foi revisada por um agente independente contra o resumo do combinado. Veredito: fiel ao combinado, sem contradição, mas com lacunas que bloqueariam o plano de implementação. As lacunas foram resolvidas e estão incorporadas no restante deste documento; as decisões tomadas nessa rodada:

| Lacuna | Resolução |
|---|---|
| Ciclo de vida do `session_token` | Gerado uma vez no cliente, persistido em `localStorage`. Resume (F5 no meio do quiz) reenvia `{nome, whatsapp, email, session_token}` cacheados pro mesmo `/start` — a cascata de dedupe já resolve a retomada, sem endpoint novo. |
| Reexibir resultado após F5 | Endpoint de leitura novo: `GET /api/quiz/result` (ver Fluxo de dados). |
| `/answer` aceitando `gabarito`/`acertou` do cliente | Cliente manda só `{num, escolhida}`; servidor deriva o resto de `questions.ts`. |
| `/answer` não recusava sessão já concluída | Adicionada a checagem — mesma regra de imutabilidade, agora explícita nesse endpoint. |
| Overwrite de nome/email/whatsapp ao reaproveitar linha por whatsapp | Sobrescreve com os dados novos — mesma filosofia já usada na retomada pós-conclusão ("tentativa mais recente reflete o estado atual da pessoa"). |
| Match só por `session_token` (email e whatsapp diferentes) | **Não reaproveita** — cria linha nova. Sinal fraco demais (navegador pode ser compartilhado); só email e whatsapp fundem sozinhos. |
| Escopo do `unique` em `email_normalizado` | Por evento (`unique (evento, email_normalizado)`), não global — o campo `evento` existe para múltiplos quizzes futuros; unicidade global inviabilizaria isso. |
| Normalização de whatsapp indefinida | Regra fixada (ver Schema). |
| Validação de entrada em `/start` | Regras fixadas (ver Fluxo de dados). |
| Cores "dourado"/"roxo profundo"/secundárias sem hex; licença da Degular | **Pendente** — ver "Pendências antes da estilização". Não bloqueia o plano, bloqueia só a etapa de tema Tailwind. |
| Perguntas do quiz: mesmas do repo base ou novas? | Novas — conteúdo é uma tarefa separada (copywriting), fora do escopo técnico deste documento. |
| CTA comercial na tela de resultado | Não tem — só o diagnóstico; o comercial entra em contato depois usando os dados capturados. |
| Proteção anti-bot/rate-limit nos endpoints de escrita | Sim, mínima — ver Segurança. |
| Feedback de certo/errado por pergunta durante o quiz | Não revela durante — só na revisão final, igual ao repo base. |

## Objetivo

Construir um quiz de diagnóstico web que:
1. Identifica o lead (nome, whatsapp, email) antes de iniciar.
2. Aplica perguntas de múltipla escolha com gabarito fixo (conteúdo novo, a ser escrito separadamente — ver "Fora de escopo").
3. Grava o progresso incrementalmente no banco, para permitir detecção de abandono e saber exatamente em qual pergunta cada pessoa parou.
4. Ao concluir, calcula e exibe um diagnóstico determinístico (score geral, por área, área prioritária).
5. Impede acesso ao resultado fora do fluxo completo (sem link direto), mas permite reexibir o resultado da própria sessão após F5.
6. **Garante uma única linha por pessoa dentro do mesmo evento/quiz** — mesmo que ela faça o quiz duas vezes, comece em um dispositivo e termine em outro, ou comece uma tentativa e conclua outra depois.

## Arquitetura

- **Frontend**: Next.js 16 (App Router) + React 19 + TypeScript — reaproveita a estrutura do repo base (`Quiz.tsx` como componente único com estados `cover` → `quiz` → `result`).
- **Estilo**: Tailwind CSS, com tema baseado no guia de identidade visual oficial da marca (ver seção Identidade Visual e Pendências).
- **Backend**: Route Handlers do Next (`/api/quiz/*`), responsáveis por toda escrita no Supabase via `supabase-js` com a chave `service_role` (só no servidor).
- **Banco**: Supabase (Postgres), tabela única `quiz_sessions`.
- **Deploy**: Vercel.

### Por que este desenho (alternativas descartadas)
- **Cliente gravando direto no Supabase** (chave `anon` + RLS insert-only): expõe schema no bundle do cliente, sem validação server-side antes de gravar.
- **Vite/SPA sem Next.js**: perderia o reuso direto da estrutura do repo base.
- **Resultado como rota/URL dedicada**: requisito explícito é que o resultado não pode ser acessível por link, só ao concluir o fluxo.
- **Log de eventos + schemas `raw`/`core`/ETL (padrão `quiz-apego`)**: over-engineering para uma única fonte de dados; ver seção "Pesquisa de reaproveitamento" acima.
- **Conexão direta ao Postgres via `pg`**: sem funções Postgres customizadas nesta v1, `supabase-js` é mais simples de operar.

## Identidade Visual

Guia de marca oficial recebido (PDF "Guia Visual — VDE Tribunais"). Ativos SVG já copiados para `public/brand/` (7 arquivos: versões 01–03, variantes `color` e `branco`, ícone "olho" da marca VDE).

**Cores principais:**
- Lilás claro `#B7ADFD` (confirmado, extraído dos SVGs)
- Navy `#203C7C` (confirmado, extraído dos SVGs)
- Dourado (gradiente) — **hex pendente**
- Roxo profundo — **hex pendente**

**Cores secundárias** (azul acinzentado, bege, cinza claro, off-white) — **hex pendente para as 4**.

**Tipografia**: Poppins (títulos/destaque, disponível no Google Fonts) + Degular (texto) — **licença de uso pendente de confirmação**; Degular é fonte comercial, não está no Google Fonts.

**Regras de uso** (do guia oficial): não alterar cores institucionais, não aplicar em baixo contraste, não alterar a tipografia original, não alterar a estrutura das assinaturas do logo, não estirar/achatar.

### Pendências antes da estilização

Não bloqueiam a escrita do plano de implementação nem o trabalho de backend/schema, mas bloqueiam a etapa de tema Tailwind:

1. Hex exatos de "dourado", "roxo profundo" e das 4 cores secundárias (arquivo de origem Figma/Illustrator, ou os códigos direto).
2. Confirmação de licença para self-host da fonte Degular — se não houver, definir fallback aceitável.

## Schema do banco

```sql
create table quiz_sessions (
  id                   bigint generated always as identity primary key,
  session_token        uuid not null unique,              -- gerado no CLIENTE (crypto.randomUUID()), enviado em toda requisição
  evento               text not null default 'diagnostico-tribunais-comercial',
  nome                 text not null,
  whatsapp             text not null,
  whatsapp_normalizado text not null,                     -- só dígitos; entrada com 10-11 dígitos (sem DDI) ganha prefixo 55; entrada já com 12-13 dígitos (com DDI 55) mantém como está
  email                text not null,
  email_normalizado    text not null,                     -- lowercase, trim
  status               text not null default 'em_andamento'
                         check (status in ('em_andamento', 'concluido')),
  respostas            jsonb not null default '[]'::jsonb, -- [{num, area, escolhida, gabarito, acertou}, ...]
  areas                jsonb not null default '{}'::jsonb, -- {"area": {acertos, total, pct}, ...}
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
-- Nenhuma policy pública é criada: apenas a service_role (usada só nas Route Handlers) acessa a tabela.
```

Decisões de schema:
- `id bigint identity` como PK interna (não UUID aleatório) — evita fragmentação de índice.
- `session_token uuid` gerado no **cliente**, não pelo servidor — é o identificador que o front usa em toda requisição da sessão ativa (início → respostas → fim → leitura de resultado). Único, mas não é a chave de dedupe por pessoa.
- `unique (evento, email_normalizado)` — chave forte de dedupe por pessoa, **escopada por quiz**: a mesma pessoa pode ter uma linha em cada `evento` diferente, mas nunca duas linhas no mesmo `evento`.
- `whatsapp_normalizado` indexado (composto com `evento`), mas sem `unique` — usado como sinal secundário de match, checado na aplicação, não travado no banco.
- `jsonb` para `respostas`/`areas` — mapeia os tipos já usados no repo base (`RespostaResumo`, `AreaResumo`).
- `timestamptz` em todos os campos de data — evita bugs de fuso horário.
- `status` com `check` — trava valores inválidos no próprio banco.

## Dedupe por pessoa (garantia de uma única linha por evento)

Requisito: dentro do mesmo quiz (`evento`), a mesma pessoa nunca deve gerar duas linhas — nem fazendo o quiz duas vezes, nem começando em um dispositivo e concluindo em outro.

### Regra de match, em cascata (não "OR" com peso igual)

No `POST /api/quiz/start`, recebendo `{ nome, whatsapp, email, session_token, evento }`, o servidor busca uma linha existente **dentro do mesmo `evento`**, nesta ordem, parando na primeira que bater:

1. **`email_normalizado`** bate com uma linha existente? → reaproveita essa linha. (sinal mais forte)
2. Não achou por email → **`whatsapp_normalizado`** bate? → reaproveita essa linha, **sobrescrevendo** `nome`/`email`/`email_normalizado`/`whatsapp` com os valores novos (a tentativa mais recente reflete o estado atual da pessoa).
3. Não achou por nenhum dos dois → **NÃO** verifica `session_token` para fins de match — cria linha nova diretamente. `session_token` sozinho é sinal fraco demais para fundir (mesmo navegador pode ser compartilhado por pessoas diferentes); só email e whatsapp fundem sozinhos.

Em qualquer reaproveitamento (casos 1 e 2), `session_token` da linha é atualizado para o novo valor enviado (a tentativa ativa agora é essa).

### O que acontece ao reaproveitar a linha

- **Sessão anterior incompleta** (`status = 'em_andamento'`): devolve o progresso já salvo (`respostas`, `areas`) para o front restaurar exatamente onde a pessoa parou, em vez de reiniciar do zero.
- **Sessão anterior concluída** (ela fez o quiz de novo): **sobrescreve** — reseta `respostas`/`areas`/campos de resultado (`score_geral_pct`, `acertos`, `total`, `area_prioritaria`, `completed_at` volta a `null`) e `status` volta para `em_andamento`; `started_at` é reiniciado para o momento dessa nova tentativa. Só existe o diagnóstico mais recente de cada pessoa; não se acumula histórico de tentativas antigas.

## Fluxo de dados

1. **Início** — `POST /api/quiz/start` recebe `{ nome, whatsapp, email, session_token, evento }`.
   - Validação: email em formato válido; whatsapp com 10-13 dígitos na entrada bruta (antes de normalizar — cobre com ou sem DDI); nome não vazio (trim).
   - Aplica a regra de dedupe acima, grava com `service_role`.
   - Devolve `{ session_token, retomando: boolean, respostas_salvas?, etapa_atual? }`.
   - O front guarda `{ nome, whatsapp, email, session_token }` em `localStorage`; se a página recarregar no meio do quiz, reenvia esses mesmos dados para `/start` de novo (idempotente, mesma linha é encontrada por email).
2. **Cada resposta** — `POST /api/quiz/answer` recebe `{ session_token, num, escolhida }` (o cliente **não** envia `gabarito`/`acertou`/`area` — o servidor deriva tudo de `questions.ts` a partir de `num`).
   - Recusa se a sessão não existe, ou se `status = 'concluido'` (imutabilidade).
   - Faz `upsert` da resposta (por `num`) no array `respostas` da linha e recalcula `areas`; `updated_at` é atualizado automaticamente pelo trigger.
   - Isso é o que permite saber exatamente em qual pergunta cada pessoa parou.
3. **Conclusão** — `POST /api/quiz/finish` recebe `{ session_token }`:
   - Valida no servidor que o conjunto de `num`s respondidos cobre todas as perguntas esperadas para o `evento`, e que `status` ainda é `em_andamento`. Se não bater, recusa (nenhum dado de diagnóstico é retornado).
   - Calcula score geral, por área e área prioritária (lógica determinística, ver abaixo) usando os dados já gravados no servidor — não confia em valores calculados no cliente.
   - Marca `status = 'concluido'`, grava `completed_at` e os campos de resultado.
   - Uma segunda tentativa de `finish` numa sessão já concluída é rejeitada (imutabilidade dentro da mesma tentativa — uma nova tentativa só nasce via `/start` de novo, que aplica a regra de sobrescrita acima).
4. **Reexibição do resultado** — `GET /api/quiz/result?session_token=...`:
   - Devolve os campos de resultado **somente se** `status = 'concluido'` para aquele `session_token`; caso contrário, `404`/resposta vazia (sem vazar progresso parcial).
   - Cobre o caso de F5 na tela de resultado — o front chama esse endpoint ao montar a tela de resultado em vez de depender só do estado em memória.
5. **Consulta pelo time de infra (fora de escopo deste projeto)** — consulta `quiz_sessions` diretamente: `status='em_andamento' AND updated_at < now() - interval` para recuperação de abandono, sabendo exatamente em qual pergunta cada pessoa ficou (via `respostas`); `status='concluido'` para o fluxo comercial normal e sincronização com Clint/outras ferramentas.

## Lógica do diagnóstico (determinística)

Mesmo modelo do repo base — sem IA:
- Cada pergunta tem gabarito (`correct`) e comentário por alternativa, definidos estaticamente em `questions.ts` (conteúdo novo, escrito separadamente — ver Fora de escopo).
- Score geral = respostas corretas / total.
- Score por área = respostas corretas / total, agrupado por área da pergunta.
- Área prioritária = área com menor % de acerto.
- Faixas de mensagem fixas por score (mesmo formato do repo base: ex. ≥75%/≥45%/abaixo — valores e textos finais definidos junto com o conteúdo novo das perguntas, não são uma decisão de arquitetura).
- Feedback de certo/errado **não** é revelado durante o quiz — só na revisão questão a questão, depois de concluído (mesmo comportamento do repo base).

## Segurança

- RLS habilitado na tabela, sem nenhuma policy pública — só `service_role` acessa, e essa chave só existe no ambiente server-side das Route Handlers (nunca enviada ao cliente).
- `session_token` nunca aparece na URL — evita que vire um "link" copiável/compartilhável. (`GET /api/quiz/result` recebe o token via query string apenas nesta chamada específica de leitura pós-conclusão, feita programaticamente pelo front a partir do valor em `localStorage` — não é um link que a pessoa navega ou compartilha, e mesmo que fosse, só devolve dado se a sessão já está `concluido`.)
- Resultado é renderizado como **estado do componente**; a leitura via `/api/quiz/result` existe só para restaurar esse estado após F5, não cria uma rota de página navegável.
- Validação de conclusão é feita inteiramente no servidor (cobertura de `num`s respondidos), nunca confiando em uma flag "terminei" vinda do cliente.
- Sessão concluída é imutável dentro da mesma tentativa — `/answer` e `/finish` recusam se `status = 'concluido'`.
- **Rate-limit mínimo** nos três endpoints de escrita (`/start`, `/answer`, `/finish`): limite simples por IP (ex.: N requisições por minuto) para conter spam/flood básico. Não é proteção anti-bot sofisticada — decisão consciente de escopo mínimo pra v1.

## Escalabilidade

Escrita incremental a cada resposta não é um risco de volume: mesmo com muitos acessos simultâneos, o throughput de escrita esperado é muito baixo. O acesso ao Supabase via `supabase-js` usa a API REST (PostgREST) sobre HTTPS, não uma conexão Postgres persistente por requisição — elimina o risco clássico de esgotamento de conexões em ambiente serverless.

## Fora de escopo (YAGNI / backlog)

- **Conteúdo das perguntas do quiz** — banco de perguntas novo (não reaproveita o do repo base), a ser escrito como tarefa de copywriting separada; a arquitetura (`questions.ts` estático, mesmo formato de tipos) já suporta isso sem mudança de código quando o conteúdo estiver pronto.
- CMS/painel de edição de perguntas — conteúdo fica hardcoded em `questions.ts`.
- Autenticação/login — o quiz é público.
- Processamento de pagamento — a venda é fechada manualmente pelo time comercial.
- CTA comercial na tela de resultado — só o diagnóstico é mostrado.
- Implementação da automação Clint — fica com o time de infraestrutura, a partir do Supabase.
- Log de eventos idempotente / schemas `raw`/`core`/ETL — avaliado e descartado (fonte única de dados, ver "Pesquisa de reaproveitamento").
- Endpoint de exclusão/anonimização LGPD — avaliado, adiado para o backlog (decisão pendente de priorização, não uma lacuna esquecida).
- Proteção anti-bot sofisticada (captcha, device fingerprinting) — só rate-limit simples por IP nesta v1.

## Testes

- Lógica de cálculo de score/área/área prioritária: testes unitários puros (sem I/O), dado um array de respostas fixo.
- Regra de dedupe por pessoa: testes de integração cobrindo os 6 cenários — (1) match por email, sessão anterior incompleta → retoma progresso; (2) match por email, sessão anterior concluída → sobrescreve; (3) match por whatsapp, sessão anterior incompleta → retoma progresso e atualiza nome/email; (4) match por whatsapp, sessão anterior concluída → sobrescreve; (5) nenhum match (inclusive quando só o `session_token` bate) → cria linha nova; (6) mesmo email em `evento`s diferentes → duas linhas distintas, sem conflito.
- Route Handlers: testes de integração cobrindo os casos de recusa (sessão incompleta em `/finish`, sessão já concluída em `/answer` e `/finish`, `session_token` inválido/inexistente, `/result` sem sessão concluída).
- RLS: teste manual/script confirmando que a chave `anon` não consegue ler nem escrever na tabela.
- Rate-limit: teste confirmando que a Nª requisição no mesmo IP é recusada dentro da janela configurada.

## Deploy

Vercel, variáveis de ambiente (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) geridas via `vercel env`, nunca expostas com prefixo `NEXT_PUBLIC_`.
