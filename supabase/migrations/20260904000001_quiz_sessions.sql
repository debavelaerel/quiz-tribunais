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

-- search_path fixado (vazio) para não depender do search_path de quem dispara o
-- trigger — é o que o linter do Supabase cobra (function_search_path_mutable).
-- Não há referência a tabela aqui; now() é builtin em pg_catalog, sempre visível.
create function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = '';

create trigger trg_quiz_sessions_updated_at
  before update on quiz_sessions
  for each row execute function set_updated_at();

alter table quiz_sessions enable row level security;
-- Nenhuma policy pública: só a service_role (usada nas Route Handlers) acessa a tabela.
