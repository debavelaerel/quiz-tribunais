import { NextResponse } from 'next/server'
import { criarSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { criarSupabaseSessionRepo } from '@/lib/server/supabaseSessionRepo'
import type { SessionRepo } from '@/lib/server/sessionRepo'
import { registrarPerfil, SessaoInvalidaError, SessaoConcluidaError } from '@/lib/server/quizService'
import { permitirRequisicao } from '@/lib/server/rateLimit'
import { isUuid } from '@/lib/server/uuid'
import type { RespostasPerfil } from '@/lib/perfil'
import { ipDaRequisicao } from '@/lib/server/ip'

export const runtime = 'nodejs'

// Allowlist das chaves de perfil aceitas — trava o que pode entrar no jsonb
// `perfil`, em vez de aceitar qualquer chave que o cliente mandar.
const CHAVES_PERFIL: (keyof RespostasPerfil)[] = [
  'alvo', 'cargo', 'formacao', 'tempo', 'provas', 'metodo', 'vde', 'horas',
  'edital', 'editais', 'dor', 'momento', 'dinheiro', 'leitura', 'desqualificadoMotivo',
]
const CHAVES_MULTI: (keyof RespostasPerfil)[] = ['editais']

export function criarHandlerPerfil(repo: SessionRepo) {
  return async function handler(req: Request): Promise<Response> {
    if (!permitirRequisicao(`perfil:${ipDaRequisicao(req)}`, 60, 60_000)) {
      return NextResponse.json({ erro: 'muitas requisições' }, { status: 429 })
    }

    let corpo: unknown
    try {
      corpo = await req.json()
    } catch {
      return NextResponse.json({ erro: 'json inválido' }, { status: 400 })
    }

    const { session_token: sessionToken, chave, valor } = (corpo ?? {}) as Record<string, unknown>
    if (typeof sessionToken !== 'string') {
      return NextResponse.json({ erro: 'corpo inválido' }, { status: 422 })
    }
    if (!isUuid(sessionToken)) {
      return NextResponse.json({ erro: 'session_token inválido' }, { status: 422 })
    }
    if (typeof chave !== 'string' || !CHAVES_PERFIL.includes(chave as keyof RespostasPerfil)) {
      return NextResponse.json({ erro: 'chave de perfil inválida' }, { status: 422 })
    }
    const ehMulti = CHAVES_MULTI.includes(chave as keyof RespostasPerfil)
    const valorValido = ehMulti
      ? Array.isArray(valor) && valor.every((v) => typeof v === 'string')
      : typeof valor === 'string'
    if (!valorValido) {
      return NextResponse.json({ erro: 'valor inválido para essa chave' }, { status: 422 })
    }

    try {
      await registrarPerfil(repo, sessionToken, { [chave]: valor } as Partial<RespostasPerfil>)
    } catch (e) {
      if (e instanceof SessaoInvalidaError) return NextResponse.json({ erro: 'sessão não encontrada' }, { status: 404 })
      if (e instanceof SessaoConcluidaError) return NextResponse.json({ erro: 'sessão já concluída' }, { status: 409 })
      console.error('[quiz/perfil] erro inesperado', e)
      throw e
    }
    return NextResponse.json({ ok: true }, { status: 200 })
  }
}

export async function POST(req: Request): Promise<Response> {
  return criarHandlerPerfil(criarSupabaseSessionRepo(criarSupabaseAdmin()))(req)
}
