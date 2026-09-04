import type { SupabaseClient } from '@supabase/supabase-js'
import type { SessionRepo } from './sessionRepo'
import type { QuizSession } from './types'

type LinhaBanco = {
  id: number
  session_token: string
  evento: string
  nome: string
  whatsapp: string
  whatsapp_normalizado: string
  email: string
  email_normalizado: string
  status: 'em_andamento' | 'concluido'
  respostas: QuizSession['respostas']
  areas: QuizSession['areas']
  score_geral_pct: number | null
  acertos: number | null
  total: number | null
  area_prioritaria: string | null
  started_at: string
  updated_at: string
  completed_at: string | null
}

function paraSessao(linha: LinhaBanco): QuizSession {
  return {
    id: linha.id,
    sessionToken: linha.session_token,
    evento: linha.evento,
    nome: linha.nome,
    whatsapp: linha.whatsapp,
    whatsappNormalizado: linha.whatsapp_normalizado,
    email: linha.email,
    emailNormalizado: linha.email_normalizado,
    status: linha.status,
    respostas: linha.respostas,
    areas: linha.areas,
    scoreGeralPct: linha.score_geral_pct,
    acertos: linha.acertos,
    total: linha.total,
    areaPrioritaria: linha.area_prioritaria,
    startedAt: linha.started_at,
    updatedAt: linha.updated_at,
    completedAt: linha.completed_at,
  }
}

function paraLinhaPatch(patch: Partial<QuizSession>): Record<string, unknown> {
  const linha: Record<string, unknown> = {}
  if (patch.sessionToken !== undefined) linha.session_token = patch.sessionToken
  if (patch.evento !== undefined) linha.evento = patch.evento
  if (patch.nome !== undefined) linha.nome = patch.nome
  if (patch.email !== undefined) linha.email = patch.email
  if (patch.emailNormalizado !== undefined) linha.email_normalizado = patch.emailNormalizado
  if (patch.whatsapp !== undefined) linha.whatsapp = patch.whatsapp
  if (patch.whatsappNormalizado !== undefined) linha.whatsapp_normalizado = patch.whatsappNormalizado
  if (patch.status !== undefined) linha.status = patch.status
  if (patch.respostas !== undefined) linha.respostas = patch.respostas
  if (patch.areas !== undefined) linha.areas = patch.areas
  if (patch.scoreGeralPct !== undefined) linha.score_geral_pct = patch.scoreGeralPct
  if (patch.acertos !== undefined) linha.acertos = patch.acertos
  if (patch.total !== undefined) linha.total = patch.total
  if (patch.areaPrioritaria !== undefined) linha.area_prioritaria = patch.areaPrioritaria
  if (patch.startedAt !== undefined) linha.started_at = patch.startedAt
  if (patch.completedAt !== undefined) linha.completed_at = patch.completedAt
  return linha
}

export function criarSupabaseSessionRepo(client: SupabaseClient): SessionRepo {
  return {
    async buscarPorEmail(evento, emailNormalizado) {
      const { data, error } = await client.from('quiz_sessions').select('*')
        .eq('evento', evento).eq('email_normalizado', emailNormalizado).maybeSingle()
      if (error) throw error
      return data ? paraSessao(data as LinhaBanco) : null
    },
    async buscarPorWhatsapp(evento, whatsappNormalizado) {
      // whatsapp_normalizado é só indexado, NÃO tem unique constraint (ver migration):
      // duas linhas do mesmo evento podem legitimamente compartilhar o valor (ex.: uma
      // linha casada por email teve o whatsapp sobrescrito). `.maybeSingle()` lançaria
      // PGRST116 nesse caso — aqui pegamos a mais recente.
      const { data, error } = await client.from('quiz_sessions').select('*')
        .eq('evento', evento).eq('whatsapp_normalizado', whatsappNormalizado)
        .order('updated_at', { ascending: false }).limit(1)
      if (error) throw error
      const linha = data?.[0]
      return linha ? paraSessao(linha as LinhaBanco) : null
    },
    async buscarPorToken(sessionToken) {
      const { data, error } = await client.from('quiz_sessions').select('*')
        .eq('session_token', sessionToken).maybeSingle()
      if (error) throw error
      return data ? paraSessao(data as LinhaBanco) : null
    },
    async criar(sessao) {
      const { data, error } = await client.from('quiz_sessions').insert(paraLinhaPatch(sessao)).select('*').single()
      if (error) throw error
      return paraSessao(data as LinhaBanco)
    },
    async atualizar(id, patch) {
      const { data, error } = await client.from('quiz_sessions').update(paraLinhaPatch(patch)).eq('id', id).select('*').single()
      if (error) throw error
      return paraSessao(data as LinhaBanco)
    },
  }
}
