import type { SupabaseClient } from '@supabase/supabase-js'
import type { SessionRepo, FiltroListagem } from './sessionRepo'
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
  fluxo: QuizSession['fluxo']
  status: 'em_andamento' | 'concluido'
  respostas: QuizSession['respostas']
  areas: QuizSession['areas']
  score_geral_pct: number | null
  acertos: number | null
  total: number | null
  area_prioritaria: string | null
  perfil: QuizSession['perfil']
  perfil_calculado: QuizSession['perfilCalculado']
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
    fluxo: linha.fluxo,
    status: linha.status,
    respostas: linha.respostas,
    areas: linha.areas,
    scoreGeralPct: linha.score_geral_pct,
    acertos: linha.acertos,
    total: linha.total,
    areaPrioritaria: linha.area_prioritaria,
    perfil: linha.perfil,
    perfilCalculado: linha.perfil_calculado,
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
  if (patch.fluxo !== undefined) linha.fluxo = patch.fluxo
  if (patch.whatsapp !== undefined) linha.whatsapp = patch.whatsapp
  if (patch.whatsappNormalizado !== undefined) linha.whatsapp_normalizado = patch.whatsappNormalizado
  if (patch.status !== undefined) linha.status = patch.status
  if (patch.respostas !== undefined) linha.respostas = patch.respostas
  if (patch.areas !== undefined) linha.areas = patch.areas
  if (patch.scoreGeralPct !== undefined) linha.score_geral_pct = patch.scoreGeralPct
  if (patch.acertos !== undefined) linha.acertos = patch.acertos
  if (patch.total !== undefined) linha.total = patch.total
  if (patch.areaPrioritaria !== undefined) linha.area_prioritaria = patch.areaPrioritaria
  if (patch.perfil !== undefined) linha.perfil = patch.perfil
  if (patch.perfilCalculado !== undefined) linha.perfil_calculado = patch.perfilCalculado
  if (patch.startedAt !== undefined) linha.started_at = patch.startedAt
  if (patch.completedAt !== undefined) linha.completed_at = patch.completedAt
  return linha
}

// Base compartilhada entre a query de listagem e o fallback de contagem
// (ver comentário em `listar`) — mesmo filtro status/fluxo/busca nas duas,
// só muda o que cada uma pede de volta (linhas+count vs. só count).
function aplicarFiltro(client: SupabaseClient, evento: string, filtro: Omit<FiltroListagem, 'pagina' | 'porPagina'>, opts: { count: 'exact'; head?: boolean }) {
  let query = client.from('quiz_sessions').select('*', opts).eq('evento', evento)
  if (filtro.status) query = query.eq('status', filtro.status)
  if (filtro.fluxo) query = query.eq('fluxo', filtro.fluxo)
  if (filtro.busca) {
    // Substring case-insensitive em nome OU email OU whatsapp — os três
    // sempre em texto puro (não normalizado), igual ao que o time vê.
    const termo = filtro.busca.replace(/[%,]/g, '')
    query = query.or(`nome.ilike.%${termo}%,email.ilike.%${termo}%,whatsapp.ilike.%${termo}%`)
  }
  return query
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
    async listar(evento, filtro) {
      const inicio = (filtro.pagina - 1) * filtro.porPagina
      const fim = inicio + filtro.porPagina - 1
      const query = aplicarFiltro(client, evento, filtro, { count: 'exact' })
      const { data, error, count } = await query.order('started_at', { ascending: false }).range(inicio, fim)
      if (error) {
        // PGRST103: offset além do total de linhas — ex.: alguém digitou
        // ?pagina=999 na URL, ou clicou num link "Próxima" que ficou velho
        // depois que o total mudou (filtro mudou, leads somem). Não é uma
        // falha de verdade, é só "não tem nada nessa página" — busca a
        // contagem real (sem range, então não pode dar PGRST103 de novo) e
        // devolve lista vazia, em vez de deixar a página quebrar com 500.
        if ((error as { code?: string }).code === 'PGRST103') {
          const { count: totalReal, error: erroContagem } = await aplicarFiltro(client, evento, filtro, { count: 'exact', head: true })
          if (erroContagem) throw erroContagem
          return { sessoes: [], total: totalReal ?? 0 }
        }
        throw error
      }
      return { sessoes: (data as LinhaBanco[]).map(paraSessao), total: count ?? 0 }
    },
  }
}
