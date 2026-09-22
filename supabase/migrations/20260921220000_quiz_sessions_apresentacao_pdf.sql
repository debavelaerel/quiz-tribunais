-- Link da apresentação comercial (deck de call 1:1) em PDF, hospedada no S3
-- — gerada sob demanda pelo admin (botão "Baixar apresentação comercial" em
-- app/api/admin/leads/[token]/apresentacao/route.ts), nunca em background.
-- Ao contrário do laudo (ver 20260917215337_quiz_sessions_laudo_pdf.sql),
-- não precisa de um token estável próprio: não tem link público nenhum pro
-- CRM, só o admin autenticado busca por session_token mesmo.
alter table quiz_sessions
  add column apresentacao_pdf_s3_key text,
  add column apresentacao_pdf_erro text;
