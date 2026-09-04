# Verificação de RLS — quiz_sessions

Depois de aplicar a migration no projeto Supabase real (`supabase db push` ou pelo dashboard), confirme que a chave `anon` não consegue ler nem escrever na tabela:

## 1. Tentar ler com a chave anon (deve falhar)

```bash
curl -s "$SUPABASE_URL/rest/v1/quiz_sessions?select=*" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY"
```

Esperado: array vazio `[]` (RLS bloqueia sem retornar erro, por padrão do PostgREST) — nunca dados reais, mesmo que existam linhas na tabela.

## 2. Tentar escrever com a chave anon (deve falhar)

```bash
curl -s -X POST "$SUPABASE_URL/rest/v1/quiz_sessions" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"session_token":"00000000-0000-0000-0000-000000000000","nome":"teste","whatsapp":"x","whatsapp_normalizado":"x","email":"x@x.com","email_normalizado":"x@x.com"}'
```

Esperado: erro (RLS impede o insert; resposta HTTP não-2xx, corpo indicando violação de policy/permissão).

## 3. Confirmar que a service_role consegue ler/escrever

```bash
curl -s "$SUPABASE_URL/rest/v1/quiz_sessions?select=*" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Esperado: `200` com os dados reais (a service_role ignora RLS).
