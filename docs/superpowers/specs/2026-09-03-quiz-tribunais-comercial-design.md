# Quiz de Diagnóstico — Funil Comercial Tribunais

**Data**: 2026-09-03
**Status**: Aprovado para planejamento de implementação

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
- Acesso ao banco via `supabase-js` (REST/PostgREST) foi mantido — sem necessidade de funções Postgres customizadas (ETL, anonimização) nesta v1, `pg` direto seria complexidade extra sem ganho.
- Endpoint de exclusão/anonimização LGPD (visto no `quiz-apego`) foi **avaliado e adiado para o backlog** — não faz parte desta v1; revisitar quando houver prioridade/exigência para isso.

## Objetivo

Construir um quiz de diagnóstico web que:
1. Identifica o lead (nome, whatsapp, email) antes de iniciar.
2. Aplica perguntas de múltipla escolha com gabarito fixo (mesmo banco de perguntas jurídicas do repo base, adaptável).
3. Grava o progresso incrementalmente no banco, para permitir detecção de abandono e saber exatamente em qual pergunta cada pessoa parou.
4. Ao concluir, calcula e exibe um diagnóstico determinístico (score geral, por área, área prioritária).
5. Impede acesso ao resultado fora do fluxo completo (sem link direto).
6. **Garante uma única linha por pessoa** — mesmo que ela faça o quiz duas vezes, comece em um dispositivo e termine em outro, ou comece uma tentativa e conclua outra depois.

## Arquitetura

- **Frontend**: Next.js 16 (App Router) + React 19 + TypeScript — reaproveita a estrutura do repo base (`Quiz.tsx` como componente único com estados `cover` → `quiz` → `result`).
- **Estilo**: Tailwind CSS, com tema baseado no guia de identidade visual oficial da marca (ver seção Identidade Visual).
- **Backend**: Route Handlers do Next (`/app/api/quiz/*`), responsáveis por toda escrita no Supabase via `supabase-js` com a chave `service_role` (só no servidor).
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
- Lilás claro `#B7ADFD`
- Navy `#203C7C`
- Dourado (gradiente)
- Roxo profundo

**Cores secundárias:**
- Azul acinzentado
- Bege
- Cinza claro
- Off-white

**Tipografia**: Poppins (títulos/destaque) + Degular (texto), via `next/font` ou Google Fonts.

**Regras de uso** (do guia oficial): não alterar cores institucionais, não aplicar em baixo contraste, não alterar a tipografia original, não alterar a estrutura das assinaturas do logo, não estirar/achatar.

O tema Tailwind (`tailwind.config`) deve derivar os tokens de cor diretamente dessa paleta oficial.

## Schema do banco

```sql
create table quiz_sessions (
  id                  bigint generated always as identity primary key,
  session_token       uuid not null unique,              -- gerado no CLIENTE (crypto.randomUUID()), enviado em toda requisição
  evento              text not null default 'diagnostico-tribunais-comercial',
  nome                text not null,
  whatsapp            text not null,
  whatsapp_normalizado text not null,                     -- só dígitos, com DDI/DDD padronizados
  email               text not null,
  email_normalizado   text not null unique,               -- lowercase, trim — chave forte de dedupe por pessoa
  status              text not null default 'em_andamento'
                        check (status in ('em_andamento', 'concluido')),
  respostas           jsonb not null default '[]'::jsonb, -- [{num, area, escolhida, gabarito, acertou}, ...]
  areas               jsonb not null default '{}'::jsonb, -- {"area": {acertos, total, pct}, ...}
  score_geral_pct     numeric(5,2),
  acertos             int,
  total               int,
  area_prioritaria    text,
  started_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  completed_at        timestamptz
);

create index idx_quiz_sessions_status_updated on quiz_sessions (status, updated_at);
create index idx_quiz_sessions_whatsapp on quiz_sessions (whatsapp_normalizado);

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
- `session_token uuid` gerado no **cliente**, não pelo servidor — é o identificador que o front usa em toda requisição da sessão ativa (início → respostas → fim). Único, mas não é a chave de dedupe por pessoa.
- `email_normalizado` com `unique` de verdade no banco — é a chave forte de dedupe por pessoa (ver seção "Dedupe por pessoa" abaixo).
- `whatsapp_normalizado` indexado, mas sem `unique` — usado como sinal secundário de match, não travado no banco (ver abaixo).
- `jsonb` para `respostas`/`areas` — mapeia os tipos já usados no repo base (`RespostaResumo`, `AreaResumo`), uma linha por pessoa.
- `timestamptz` em todos os campos de data — evita bugs de fuso horário.
- `status` com `check` — trava valores inválidos no próprio banco.

## Dedupe por pessoa (garantia de uma única linha)

Requisito: a mesma pessoa nunca deve gerar duas linhas — nem fazendo o quiz duas vezes, nem começando em um dispositivo e concluindo em outro.

### Regra de match, em cascata (não "OR" com peso igual)

No `POST /api/quiz/start`, recebendo `{ nome, whatsapp, email, session_token }`, o servidor busca uma linha existente nesta ordem, parando na primeira que bater:

1. **`email_normalizado`** bate com uma linha existente? → reaproveita essa linha. (sinal mais forte)
2. Não achou por email → **`whatsapp_normalizado`** bate? → reaproveita essa linha.
3. Não achou por nenhum dos dois → **`session_token`** (mesmo navegador/dispositivo já tem linha) bate? → reaproveita essa linha.
4. Não bateu em nada → cria linha nova.

**Por que essa ordem**: email é o sinal mais confiável (raramente compartilhado); whatsapp pode ser compartilhado (casal, família); `session_token` é o sinal mais fraco (mesmo navegador pode ser usado por pessoas diferentes). Checar na ordem email → whatsapp → uid minimiza o risco de unir por engano duas pessoas diferentes.

### O que acontece ao reaproveitar a linha

- **Sessão anterior incompleta** (`status = 'em_andamento'`): devolve o progresso já salvo (`respostas`, `areas`) para o front restaurar exatamente onde a pessoa parou, em vez de reiniciar do zero.
- **Sessão anterior concluída** (ela fez o quiz de novo): **sobrescreve** — reseta `respostas`/`areas`/campos de resultado e `status` volta para `em_andamento`, mesma linha, mesmo `email_normalizado`. Decisão confirmada: só existe o diagnóstico mais recente de cada pessoa; não se acumula histórico de tentativas antigas.
- Em qualquer reaproveitamento, `session_token` da linha é atualizado para o novo valor enviado (a tentativa ativa agora é essa).

## Fluxo de dados

1. **Início** — `POST /app/api/quiz/start` recebe `{ nome, whatsapp, email, session_token }`, aplica a regra de dedupe acima, grava com `service_role`, devolve `{ session_token, retomando: boolean, respostas_salvas? }`.
2. **Cada resposta** — `POST /app/api/quiz/answer` recebe `{ session_token, resposta }`, faz `upsert` no array `respostas` da linha e recalcula `areas`; `updated_at` é atualizado automaticamente pelo trigger. Isso é o que permite saber exatamente em qual pergunta cada pessoa parou.
3. **Conclusão** — `POST /app/api/quiz/finish` recebe `{ session_token }`:
   - Valida no servidor que `respostas.length` bate com o total de perguntas esperado para o `evento` e que `status` ainda é `em_andamento`. Se não bater, recusa (nenhum dado de diagnóstico é retornado).
   - Calcula score geral, por área e área prioritária (lógica determinística, ver abaixo) usando os dados já gravados no servidor — não confia em valores calculados no cliente.
   - Marca `status = 'concluido'`, grava `completed_at` e os campos de resultado.
   - Uma segunda tentativa de `finish` numa sessão já concluída é rejeitada (imutabilidade dentro da mesma tentativa — uma nova tentativa só nasce via `/start` de novo, que aplica a regra de sobrescrita acima).
4. **Consulta pelo time de infra (fora de escopo deste projeto)** — consulta `quiz_sessions` diretamente: `status='em_andamento' AND updated_at < now() - interval` para recuperação de abandono, sabendo exatamente em qual pergunta cada pessoa ficou (via `respostas`); `status='concluido'` para o fluxo comercial normal e sincronização com Clint/outras ferramentas.

## Lógica do diagnóstico (determinística)

Mesmo modelo do repo base — sem IA:
- Cada pergunta tem gabarito (`correct`) e comentário por alternativa, definidos estaticamente em `questions.ts`.
- Score geral = respostas corretas / total.
- Score por área = respostas corretas / total, agrupado por área da pergunta.
- Área prioritária = área com menor % de acerto.
- Faixas de mensagem fixas por score (ex.: ≥75% "Base sólida", ≥45% "Em consolidação", <45% "Prioridade de estudo"), com textos adaptados ao contexto comercial deste funil.

## Segurança

- RLS habilitado na tabela, sem nenhuma policy pública — só `service_role` acessa, e essa chave só existe no ambiente server-side das Route Handlers (nunca enviada ao cliente).
- `session_token` nunca aparece na URL — evita que vire um "link" copiável/compartilhável.
- Resultado é renderizado como **estado do componente**, não como rota — não existe endereço que leve direto ao diagnóstico sem passar pelo fluxo.
- Validação de conclusão é feita inteiramente no servidor (contagem de respostas gravadas), nunca confiando em uma flag "terminei" vinda do cliente.
- Sessão concluída é imutável dentro da mesma tentativa — não pode ser recalculada/sobrescrita por uma segunda chamada a `finish`.

## Escalabilidade

Escrita incremental a cada resposta não é um risco de volume: mesmo com muitos acessos simultâneos, o throughput de escrita esperado é muito baixo. O acesso ao Supabase via `supabase-js` usa a API REST (PostgREST) sobre HTTPS, não uma conexão Postgres persistente por requisição — elimina o risco clássico de esgotamento de conexões em ambiente serverless.

## Fora de escopo (YAGNI / backlog)

- CMS/painel de edição de perguntas — conteúdo fica hardcoded em `questions.ts`.
- Autenticação/login — o quiz é público.
- Processamento de pagamento — a venda é fechada manualmente pelo time comercial.
- Implementação da automação Clint — fica com o time de infraestrutura, a partir do Supabase.
- Log de eventos idempotente / schemas `raw`/`core`/ETL — avaliado e descartado (fonte única de dados, ver "Pesquisa de reaproveitamento").
- Endpoint de exclusão/anonimização LGPD — avaliado, adiado para o backlog (decisão pendente de priorização, não uma lacuna esquecida).

## Testes

- Lógica de cálculo de score/área/área prioritária: testes unitários puros (sem I/O), dado um array de respostas fixo.
- Regra de dedupe por pessoa: testes de integração cobrindo os 4 cenários (match por email, match por whatsapp, match por session_token, nenhum match).
- Route Handlers: testes de integração cobrindo os casos de recusa (sessão incompleta, sessão já concluída, `session_token` inválido).
- RLS: teste manual/script confirmando que a chave `anon` não consegue ler nem escrever na tabela.

## Deploy

Vercel, variáveis de ambiente (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) geridas via `vercel env`, nunca expostas com prefixo `NEXT_PUBLIC_`.
