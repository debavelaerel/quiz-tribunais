import Link from 'next/link'
import { Download } from 'lucide-react'
import { criarSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { criarSupabaseSessionRepo } from '@/lib/server/supabaseSessionRepo'
import { EVENTO } from '@/lib/questions'
import type { FiltroListagem } from '@/lib/server/sessionRepo'

export const runtime = 'nodejs'

const POR_PAGINA = 30

function fmtData(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function Pill({ tom, children }: { tom: 'green' | 'gray' | 'red'; children: React.ReactNode }) {
  const cores = {
    green: 'bg-[#E7F7EE] text-[#1C7C47]',
    gray: 'bg-brand-tint text-brand-ink-soft',
    red: 'bg-brand-red/10 text-brand-red',
  }[tom]
  const dot = { green: 'bg-brand-green', gray: 'bg-brand-ink-dim', red: 'bg-brand-red' }[tom]
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold ${cores}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {children}
    </span>
  )
}

function pillStatus(status: string) {
  if (status === 'concluido') return <Pill tom="green">concluído</Pill>
  return <Pill tom="gray">em andamento</Pill>
}

type SearchParams = { status?: string; fluxo?: string; busca?: string; pagina?: string }

export default async function LeadsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const pagina = Math.max(1, Number(sp.pagina) || 1)
  const filtro: FiltroListagem = {
    status: sp.status === 'em_andamento' || sp.status === 'concluido' ? sp.status : undefined,
    fluxo: sp.fluxo === 'padrao' || sp.fluxo === 'final' ? sp.fluxo : undefined,
    busca: sp.busca?.trim() || undefined,
    pagina,
    porPagina: POR_PAGINA,
  }

  const repo = criarSupabaseSessionRepo(criarSupabaseAdmin())
  const { sessoes, total } = await repo.listar(EVENTO, filtro)
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA))

  const paramsExport = new URLSearchParams()
  if (filtro.status) paramsExport.set('status', filtro.status)
  if (filtro.fluxo) paramsExport.set('fluxo', filtro.fluxo)
  if (filtro.busca) paramsExport.set('busca', filtro.busca)

  function paginaHref(p: number) {
    const params = new URLSearchParams()
    if (sp.status) params.set('status', sp.status)
    if (sp.fluxo) params.set('fluxo', sp.fluxo)
    if (sp.busca) params.set('busca', sp.busca)
    params.set('pagina', String(p))
    return `/admin/leads?${params.toString()}`
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.01em] text-brand-ink">Leads</h1>
          <p className="mt-1 text-[13.5px] text-brand-ink-dim">{total} {total === 1 ? 'sessão' : 'sessões'} no total</p>
        </div>
      </div>

      <form method="get" className="mb-4 flex flex-wrap items-center gap-2.5">
        <select name="status" defaultValue={sp.status ?? ''} className="rounded-[10px] border-[1.5px] border-brand-line-strong bg-brand-card px-3 py-2 text-[13.5px] text-brand-ink">
          <option value="">Todos os status</option>
          <option value="concluido">Concluído</option>
          <option value="em_andamento">Em andamento</option>
        </select>
        <select name="fluxo" defaultValue={sp.fluxo ?? ''} className="rounded-[10px] border-[1.5px] border-brand-line-strong bg-brand-card px-3 py-2 text-[13.5px] text-brand-ink">
          <option value="">Ambos os fluxos</option>
          <option value="padrao">Fluxo padrão</option>
          <option value="final">Fluxo final</option>
        </select>
        <input
          type="search"
          name="busca"
          defaultValue={sp.busca ?? ''}
          placeholder="Buscar por nome, e-mail ou WhatsApp…"
          className="min-w-[220px] rounded-[10px] border-[1.5px] border-brand-line-strong bg-brand-card px-3 py-2 text-[13.5px] text-brand-ink"
        />
        <button type="submit" className="rounded-[10px] border-[1.5px] border-brand-line-strong bg-brand-card px-3.5 py-2 text-[13.5px] font-semibold text-brand-ink hover:border-brand-ink hover:bg-brand-tint">
          Filtrar
        </button>
        <span className="flex-1" />
        <a
          href={`/api/admin/export?${paramsExport.toString()}`}
          className="inline-flex items-center gap-1.5 rounded-[10px] border-[1.5px] border-brand-line-strong bg-brand-card px-3.5 py-2 text-[13.5px] font-semibold text-brand-ink hover:border-brand-ink hover:bg-brand-tint"
        >
          <Download size={14} strokeWidth={2.25} />
          Exportar CSV
        </a>
      </form>

      <div className="overflow-auto rounded-[14px] border-[1.5px] border-brand-line">
        <table className="w-full min-w-[720px] border-collapse text-[13.5px]">
          <thead>
            <tr className="bg-[#fafafe]">
              {['Nome', 'Fluxo', 'Status', 'Teste', 'Classe', 'Iniciado em'].map((h) => (
                <th key={h} className="border-b-[1.5px] border-brand-line px-4 py-3 text-left text-[12px] font-semibold text-brand-ink-dim">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sessoes.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-brand-ink-dim">Nenhum lead encontrado com esses filtros.</td></tr>
            )}
            {sessoes.map((s) => (
              <tr key={s.sessionToken} className="border-b border-brand-line last:border-none hover:bg-brand-tint">
                <td className="px-4 py-3">
                  <Link href={`/admin/leads/${s.sessionToken}`} className="font-semibold text-brand-ink hover:underline">{s.nome}</Link>
                  <div className="mt-0.5 text-[12px] text-brand-ink-dim">{s.email}</div>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full border-[1.5px] border-brand-line-strong px-2.5 py-1 text-[12px] font-medium text-brand-ink-soft">{s.fluxo}</span>
                </td>
                <td className="px-4 py-3">{pillStatus(s.status)}</td>
                <td className="px-4 py-3 text-brand-ink">{s.acertos !== null ? `${s.acertos} / ${s.total}` : '—'}</td>
                <td className="px-4 py-3 text-brand-ink">{s.perfilCalculado?.classe ?? '—'}</td>
                <td className="px-4 py-3 text-brand-ink-dim">{fmtData(s.startedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPaginas > 1 && (
        <div className="mt-4 flex items-center justify-between text-[13px] text-brand-ink-dim">
          <span>Página {pagina} de {totalPaginas}</span>
          <div className="flex gap-1.5">
            {pagina > 1 && <a href={paginaHref(pagina - 1)} className="rounded-lg border border-brand-line px-3 py-1.5 hover:bg-brand-tint">Anterior</a>}
            {pagina < totalPaginas && <a href={paginaHref(pagina + 1)} className="rounded-lg border border-brand-line px-3 py-1.5 hover:bg-brand-tint">Próxima</a>}
          </div>
        </div>
      )}
    </div>
  )
}
