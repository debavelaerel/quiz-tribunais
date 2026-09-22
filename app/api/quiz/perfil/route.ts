import { NextResponse } from 'next/server'
import { criarSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { criarSupabaseSessionRepo } from '@/lib/server/supabaseSessionRepo'
import type { SessionRepo } from '@/lib/server/sessionRepo'
import { registrarPerfil, SessaoInvalidaError, SessaoConcluidaError } from '@/lib/server/quizService'
import { permitirRequisicao } from '@/lib/server/rateLimit'
import { isUuid } from '@/lib/server/uuid'
import type { RespostasPerfil } from '@/lib/perfil'
import { PERFIL_SCREENS } from '@/lib/quizContent'
import { ipDaRequisicao } from '@/lib/server/ip'

export const runtime = 'nodejs'

// Allowlist das chaves de perfil aceitas — trava o que pode entrar no jsonb
// `perfil`, em vez de aceitar qualquer chave que o cliente mandar.
const CHAVES_PERFIL: (keyof RespostasPerfil)[] = [
  'alvo', 'cargo', 'formacao', 'tempo', 'provas', 'metodo', 'vde', 'horas',
  'edital', 'editais', 'dor', 'momento', 'dinheiro', 'leitura', 'desqualificadoMotivo',
]
const CHAVES_MULTI: (keyof RespostasPerfil)[] = ['editais']

// `alvo` e `momento` acabam usados como chave de lookup em objeto literal
// (EDITAIS_BASE[alvo] em lib/blocos.ts; DIAG[momento]/L.momento[momento] em
// lib/server/pdf.ts) — um valor fora da lista de opções reais da tela (ex.:
// "constructor", "hasOwnProperty", "__proto__") bate numa propriedade
// herdada de Object.prototype em vez de undefined, e quebra esses lookups
// com TypeError. Como o valor fica salvo permanentemente na sessão, isso
// trava QUALQUER /finish futuro pra esse token. Valida contra as opções reais
// da tela (fonte única de verdade) em vez de aceitar qualquer string.
function valoresValidos(chave: keyof RespostasPerfil): Set<string> | null {
  const tela = PERFIL_SCREENS.find((t) => t.key === chave)
  if (!tela || !Array.isArray(tela.opts)) return null
  return new Set(tela.opts.map(([valor]) => valor))
}
const VALORES_RESTRITOS: Partial<Record<keyof RespostasPerfil, Set<string>>> = {
  alvo: valoresValidos('alvo') ?? undefined,
  momento: valoresValidos('momento') ?? undefined,
}

function valorPermitido(chave: keyof RespostasPerfil, valor: string): boolean {
  return VALORES_RESTRITOS[chave]?.has(valor) ?? true
}

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

    const { session_token: sessionToken, chave, valor, respostas } = (corpo ?? {}) as Record<string, unknown>
    if (typeof sessionToken !== 'string') {
      return NextResponse.json({ erro: 'corpo inválido' }, { status: 422 })
    }
    if (!isUuid(sessionToken)) {
      return NextResponse.json({ erro: 'session_token inválido' }, { status: 422 })
    }

    let entrada: Partial<RespostasPerfil>
    // Lote (`respostas`, um objeto {chave: valor}) — usado só pelo fluxo
    // final (?fluxo=final) pra fechar a sessão com 1 chamada em vez de até
    // 14 sequenciais (ver criarOuAtualizarSessaoFinal em components/Quiz.tsx).
    // Formato de 1 chave só (`chave`/`valor`) continua igual, pro
    // persistirPerfil do fluxo padrão (uma chamada por tela, ao vivo).
    if (respostas !== undefined) {
      if (typeof respostas !== 'object' || respostas === null || Array.isArray(respostas)) {
        return NextResponse.json({ erro: 'respostas inválido' }, { status: 422 })
      }
      const pares = Object.entries(respostas as Record<string, unknown>)
      for (const [k, v] of pares) {
        if (!CHAVES_PERFIL.includes(k as keyof RespostasPerfil)) {
          return NextResponse.json({ erro: `chave de perfil inválida: ${k}` }, { status: 422 })
        }
        const ehMultiK = CHAVES_MULTI.includes(k as keyof RespostasPerfil)
        const validoK = ehMultiK
          ? Array.isArray(v) && v.every((x) => typeof x === 'string')
          : typeof v === 'string' && valorPermitido(k as keyof RespostasPerfil, v)
        if (!validoK) {
          return NextResponse.json({ erro: `valor inválido pra chave ${k}` }, { status: 422 })
        }
      }
      entrada = respostas as Partial<RespostasPerfil>
    } else {
      if (typeof chave !== 'string' || !CHAVES_PERFIL.includes(chave as keyof RespostasPerfil)) {
        return NextResponse.json({ erro: 'chave de perfil inválida' }, { status: 422 })
      }
      const ehMulti = CHAVES_MULTI.includes(chave as keyof RespostasPerfil)
      const valorValido = ehMulti
        ? Array.isArray(valor) && valor.every((v) => typeof v === 'string')
        : typeof valor === 'string' && valorPermitido(chave as keyof RespostasPerfil, valor)
      if (!valorValido) {
        return NextResponse.json({ erro: 'valor inválido para essa chave' }, { status: 422 })
      }
      entrada = { [chave]: valor } as Partial<RespostasPerfil>
    }

    try {
      await registrarPerfil(repo, sessionToken, entrada)
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
