-- UTMs de onde o lead entrou no quiz (ver components/Quiz.tsx, lido de
-- window.location.search na tela inicial e mandado no POST /api/quiz/start).
-- Só gravado na CRIAÇÃO da sessão (lib/server/quizService.ts::iniciarSessao)
-- — numa retomada (mesmo email/whatsapp já existente), nunca é sobrescrito,
-- então isso é sempre "first touch": a campanha que trouxe o lead a
-- primeira vez, não a última.
alter table quiz_sessions
  add column utm_source text,
  add column utm_medium text,
  add column utm_campaign text,
  add column utm_content text,
  add column utm_term text;
