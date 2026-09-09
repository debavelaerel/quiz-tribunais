-- Registra o horário do primeiro clique no CTA "Falar com o time no
-- WhatsApp" na tela de resultado — sinal de intenção de compra (lead
-- scoring comercial), separado da classe A/B de encaixe de curso já
-- existente em perfil_calculado. Ver lib/server/quizService.ts,
-- registrarCliqueWhatsapp.
alter table quiz_sessions
  add column whatsapp_clicado_em timestamptz;
