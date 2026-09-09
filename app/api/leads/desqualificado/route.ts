import { NextResponse } from 'next/server'
import { criarSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { criarSupabaseLeadsDesqualificadosRepo } from '@/lib/server/supabaseLeadsDesqualificadosRepo'
import type { LeadsDesqualificadosRepo, MotivoDesqualificacao, CarreiraJuridica } from '@/lib/server/leadsDesqualificadosRepo'
import { registrarLeadDesqualificado } from '@/lib/server/leadsDesqualificados'
import { permitirRequisicao } from '@/lib/server/rateLimit'
import { ipDaRequisicao } from '@/lib/server/ip'
import { nomeValido, emailValido, whatsappValido } from '@/lib/validacao'
import { EVENTO } from '@/lib/questions'

export const runtime = 'nodejs'

const FLUXOS: readonly string[] = ['padrao', 'final']
const MOTIVOS: readonly string[] = ['outro', 'juridica', 'cargo_baixo']
const CARREIRAS: readonly string[] = ['juiz', 'promotor', 'defensor', 'procurador', 'outra']

export function criarHandlerLeadDesqualificado(repo: LeadsDesqualificadosRepo) {
  return async function handler(req: Request): Promise<Response> {
    if (!permitirRequisicao(`lead-desqualificado:${ipDaRequisicao(req)}`, 20, 60_000)) {
      return NextResponse.json({ erro: 'muitas requisições' }, { status: 429 })
    }

    let corpo: unknown
    try {
      corpo = await req.json()
    } catch {
      return NextResponse.json({ erro: 'json inválido' }, { status: 400 })
    }

    // `evento` nunca vem do cliente (mesmo padrão de /api/quiz/start) — evita
    // que alguém grave um lead num evento arbitrário só mudando o corpo.
    const { fluxo, motivo, carreira_juridica: carreiraJuridica, nome, whatsapp, email } = (corpo ?? {}) as Record<string, unknown>

    if (typeof fluxo !== 'string' || !FLUXOS.includes(fluxo)) {
      return NextResponse.json({ erro: 'fluxo inválido' }, { status: 422 })
    }
    if (typeof motivo !== 'string' || !MOTIVOS.includes(motivo)) {
      return NextResponse.json({ erro: 'motivo inválido' }, { status: 422 })
    }
    const ehJuridica = motivo === 'juridica'
    if (ehJuridica && (typeof carreiraJuridica !== 'string' || !CARREIRAS.includes(carreiraJuridica))) {
      return NextResponse.json({ erro: 'carreira_juridica inválida ou ausente pro motivo juridica' }, { status: 422 })
    }
    if (!ehJuridica && carreiraJuridica !== undefined && carreiraJuridica !== null) {
      return NextResponse.json({ erro: 'carreira_juridica só é válida com motivo juridica' }, { status: 422 })
    }
    if (typeof nome !== 'string' || !nomeValido(nome)) {
      return NextResponse.json({ erro: 'nome e sobrenome obrigatórios' }, { status: 422 })
    }
    if (typeof email !== 'string' || !emailValido(email)) {
      return NextResponse.json({ erro: 'email inválido' }, { status: 422 })
    }
    if (typeof whatsapp !== 'string' || !whatsappValido(whatsapp)) {
      return NextResponse.json({ erro: 'whatsapp inválido' }, { status: 422 })
    }

    try {
      await registrarLeadDesqualificado(repo, {
        evento: EVENTO,
        fluxo: fluxo as 'padrao' | 'final',
        motivo: motivo as MotivoDesqualificacao,
        carreiraJuridica: ehJuridica ? (carreiraJuridica as CarreiraJuridica) : null,
        nome,
        whatsapp,
        email,
      })
    } catch (e) {
      console.error('[leads/desqualificado] erro inesperado', e)
      throw e
    }
    return NextResponse.json({ ok: true }, { status: 200 })
  }
}

export async function POST(req: Request): Promise<Response> {
  return criarHandlerLeadDesqualificado(criarSupabaseLeadsDesqualificadosRepo(criarSupabaseAdmin()))(req)
}
