-- Blocos de texto condicionais ("ponto a ponto") escolhidos pra essa sessão,
-- calculados em concluirSessao() a partir de perfil + respostas graduadas —
-- ver lib/blocos.ts, selecionarBlocos(). Fica null enquanto em_andamento.
alter table quiz_sessions
  add column blocos jsonb;
