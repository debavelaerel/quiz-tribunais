-- Captura de contato de quem foi desqualificado no perfilamento (não é o
-- público do VDE Tribunais — ver components/Quiz.tsx, tela 'desqualificado').
-- Tabela própria, independente de quiz_sessions: é interesse em outro
-- produto (ex.: VDE Carreiras Jurídicas), não deve contaminar o funil e as
-- métricas de analytics do Tribunais. Sem session_token, sem dedupe por
-- email/whatsapp e sem update — é uma captura de uma vez só, não uma sessão
-- retomável.
create table leads_desqualificados (
  id                   bigint generated always as identity primary key,
  evento               text not null default 'diagnostico-tribunais-comercial',
  fluxo                text not null check (fluxo in ('padrao', 'final')),
  motivo               text not null check (motivo in ('outro', 'juridica', 'cargo_baixo')),
  -- Só motivo='juridica' pergunta a carreira específica (juiz, promotor...);
  -- o check abaixo trava essa correlação no banco, não só no código.
  carreira_juridica    text check (carreira_juridica in ('juiz', 'promotor', 'defensor', 'procurador', 'outra')),
  nome                 text not null,
  whatsapp             text not null,
  whatsapp_normalizado text not null,
  email                text not null,
  email_normalizado    text not null,
  criado_em            timestamptz not null default now(),

  constraint chk_carreira_juridica_so_com_motivo_juridica check (
    (motivo = 'juridica') = (carreira_juridica is not null)
  )
);

create index idx_leads_desqualificados_evento_criado on leads_desqualificados (evento, criado_em desc);

alter table leads_desqualificados enable row level security;
-- Nenhuma policy pública: só a service_role (usada nas Route Handlers) acessa a tabela.
