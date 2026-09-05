-- Adiciona o perfil de qualificação do funil "Raio-X da Base" à sessão do quiz.
-- `perfil` guarda as respostas de perfilamento (não graduadas: alvo, cargo,
-- formação, tempo, editais escolhidos etc.) e o toggle "leitura". Ficam soltas
-- de `respostas`/`areas`, que continuam exclusivas das 4 perguntas REAIS
-- graduadas (FGV/FCC) cujo score o servidor sempre recalcula.
-- `perfil_calculado` guarda a classificação derivada (classe, curso indicado,
-- ritmo) computada pelo servidor a partir de `perfil` + do score graduado.
alter table quiz_sessions
  add column perfil jsonb not null default '{}'::jsonb,
  add column perfil_calculado jsonb;
