-- Link do laudo em PDF hospedado no S3, gerado em background quando a
-- sessão conclui (ver app/api/quiz/finish/route.ts) — fica null até a
-- geração terminar. laudo_pdf_erro guarda a última falha (S3 fora do ar,
-- serviço de PDF indisponível) só pra diagnóstico; sucesso limpa o erro.
alter table quiz_sessions
  add column laudo_pdf_s3_key text,
  add column laudo_pdf_erro text;

-- session_token NÃO serve de identificador estável pro link que vai pro CRM:
-- iniciarSessao() troca session_token pro valor que o cliente mandar sempre
-- que a mesma pessoa retoma (mesmo e-mail/whatsapp, "Refazer o diagnóstico",
-- outro aparelho — ver o comentário em iniciarSessao sobre esse
-- comportamento já ser intencional). Um link com session_token quebraria
-- (404) assim que a pessoa reabrisse o quiz depois do laudo já ter sido
-- gerado. laudo_token nunca é reescrito depois de criado (só aparece em
-- criar(), nunca em atualizar() — ver lib/server/supabaseSessionRepo.ts) —
-- é o que /api/laudo/[token] usa pra buscar a sessão.
alter table quiz_sessions
  add column laudo_token uuid not null default gen_random_uuid();

create unique index uq_quiz_sessions_laudo_token on quiz_sessions (laudo_token);
