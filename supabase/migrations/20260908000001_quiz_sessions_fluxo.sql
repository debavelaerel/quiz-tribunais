-- Registra qual variante do funil gerou a sessão: 'padrao' (nome+whatsapp+
-- email juntos na capa, antes do perfilamento) ou 'final' (só o nome no
-- início, contato só depois da leitura — ver componentes/Quiz.tsx). Isso
-- nunca foi persistido: o `?fluxo=final` era uma decisão 100% client-side.
-- Precisa existir pra o painel administrativo poder mostrar/filtrar de qual
-- variante cada lead veio.
alter table quiz_sessions
  add column fluxo text not null default 'padrao' check (fluxo in ('padrao', 'final'));
