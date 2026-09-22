import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Check, X } from 'lucide-react'
import { criarSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { criarSupabaseSessionRepo } from '@/lib/server/supabaseSessionRepo'
import { rotuloPerfil } from '@/lib/adminLabels'
import { nivelTeste } from '@/lib/perfil'
import { labelCargo, waLink } from '@/lib/quizContent'
import { isUuid } from '@/lib/server/uuid'
import AreaColumns from '@/components/admin/AreaColumns'

export const runtime = 'nodejs'

const CHAVES_FICHA = [
  'alvo', 'cargo', 'formacao', 'tempo', 'provas', 'metodo', 'vde', 'horas',
  'edital', 'dor', 'momento', 'dinheiro', 'leitura',
] as const

function fmtData(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default async function LeadDetalhePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!isUuid(token)) notFound()

  const repo = criarSupabaseSessionRepo(criarSupabaseAdmin())
  const sessao = await repo.buscarPorToken(token)
  if (!sessao) notFound()

  const editais = sessao.perfil.editais ?? []
  const nivel = sessao.acertos !== null ? nivelTeste(sessao.acertos) : ''
  const link = sessao.status === 'concluido' && sessao.perfilCalculado
    ? waLink(sessao.nome, sessao.perfil, sessao.perfilCalculado.classe, sessao.perfilCalculado.cursoCod, nivel, sessao.acertos ?? 0, sessao.total ?? 0)
    : null

  return (
    <div>
      <Link href="/admin/leads" className="mb-4 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-brand-ink-dim hover:text-brand-ink">
        <ArrowLeft size={15} strokeWidth={2.25} />
        voltar pra lista de leads
      </Link>

      {sessao.status === 'concluido' && (
        <div className="mb-4 flex flex-wrap gap-2.5">
          <a
            href={`/api/admin/leads/${token}/pdf`}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-ink px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-navy-2"
          >
            Baixar PDF do laudo
          </a>
          <a
            href={`/api/admin/leads/${token}/apresentacao`}
            className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-brand-line-strong px-4 py-2 text-[13px] font-semibold text-brand-ink hover:bg-brand-tint"
          >
            Baixar apresentação comercial
          </a>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[23px] font-bold tracking-[-0.01em] text-brand-ink">{sessao.nome}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${sessao.status === 'concluido' ? 'bg-[#E7F7EE] text-[#1C7C47]' : 'bg-brand-tint text-brand-ink-soft'}`}>
              {sessao.status === 'concluido' ? 'concluído' : 'em andamento'}
            </span>
            <span className="rounded-full border-[1.5px] border-brand-line-strong px-2.5 py-1 text-[12px] font-medium text-brand-ink-soft">fluxo {sessao.fluxo}</span>
            {sessao.perfilCalculado && <span className="rounded-full border-[1.5px] border-brand-line-strong px-2.5 py-1 text-[12px] font-medium text-brand-ink-soft">classe {sessao.perfilCalculado.classe}</span>}
          </div>
        </div>
        {link && (
          <a href={link} target="_blank" rel="noopener" className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-gradient-to-br from-brand-gold to-brand-gold-deep px-5 py-2.5 text-[14px] font-semibold text-brand-navy shadow-[0_10px_24px_rgba(200,155,24,0.28)]">
            Abrir no WhatsApp
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.3fr_1fr] lg:items-start">
        <div className="flex flex-col gap-4">
          <div className="rounded-[14px] border-[1.5px] border-brand-line p-5">
            <h3 className="mb-3 text-[14.5px] font-bold text-brand-navy">Contato</h3>
            <dl className="flex flex-col gap-2 text-[13.5px]">
              <div className="flex justify-between border-b border-brand-line pb-2"><dt className="text-brand-ink-dim">WhatsApp</dt><dd className="font-semibold text-brand-ink">{sessao.whatsapp}</dd></div>
              <div className="flex justify-between border-b border-brand-line pb-2"><dt className="text-brand-ink-dim">E-mail</dt><dd className="font-semibold text-brand-ink">{sessao.email}</dd></div>
              <div className="flex justify-between border-b border-brand-line pb-2"><dt className="text-brand-ink-dim">Iniciado em</dt><dd className="font-semibold text-brand-ink">{fmtData(sessao.startedAt)}</dd></div>
              <div className="flex justify-between border-b border-brand-line pb-2"><dt className="text-brand-ink-dim">Concluído em</dt><dd className="font-semibold text-brand-ink">{fmtData(sessao.completedAt)}</dd></div>
              <div className="flex justify-between"><dt className="text-brand-ink-dim">Clicou no WhatsApp</dt><dd className="font-semibold text-brand-ink">{sessao.whatsappClicadoEm ? fmtData(sessao.whatsappClicadoEm) : 'Ainda não'}</dd></div>
            </dl>
          </div>

          <div className="rounded-[14px] border-[1.5px] border-brand-line p-5">
            <h3 className="mb-3 text-[14.5px] font-bold text-brand-navy">Ficha de perfil</h3>
            <div className="grid grid-cols-2 gap-x-5 gap-y-3 text-[13.5px]">
              {CHAVES_FICHA.map((chave) => (
                <div key={chave}>
                  <div className="text-[11px] uppercase tracking-wide text-brand-ink-dim">{chave}</div>
                  <div className="mt-0.5 font-semibold text-brand-ink">{rotuloPerfil(chave, sessao.perfil[chave] as string | undefined)}</div>
                </div>
              ))}
              {editais.length > 0 && (
                <div className="col-span-2">
                  <div className="text-[11px] uppercase tracking-wide text-brand-ink-dim">editais escolhidos</div>
                  <div className="mt-0.5 font-semibold text-brand-ink">{editais.map((e) => rotuloPerfil('editais', e)).join(', ')}</div>
                </div>
              )}
              {sessao.perfil.desqualificadoMotivo && (
                <div className="col-span-2">
                  <div className="text-[11px] uppercase tracking-wide text-brand-ink-dim">desqualificado</div>
                  <div className="mt-0.5 font-semibold text-brand-red">{rotuloPerfil('desqualificadoMotivo', sessao.perfil.desqualificadoMotivo)}</div>
                </div>
              )}
              {sessao.perfilCalculado && (
                <>
                  <div className="col-span-2">
                    <div className="text-[11px] uppercase tracking-wide text-brand-ink-dim">curso indicado</div>
                    <div className="mt-0.5 font-semibold text-brand-ink">{sessao.perfilCalculado.curso}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-[11px] uppercase tracking-wide text-brand-ink-dim">ritmo</div>
                    <div className="mt-0.5 font-semibold text-brand-ink">{sessao.perfilCalculado.ritmo}</div>
                  </div>
                </>
              )}
            </div>
          </div>

          {sessao.respostas.length > 0 && (
            <div className="rounded-[14px] border-[1.5px] border-brand-line p-5">
              <h3 className="mb-3 text-[14.5px] font-bold text-brand-navy">
                Teste graduado — {sessao.acertos ?? 0} de {sessao.total ?? sessao.respostas.length} acertos
              </h3>
              {/* Mesmo dado do radar que o lead vê no resultado (ver
                  components/AreaRadar.tsx), aqui em número exato — pra decidir
                  a abordagem na ligação, não só ter uma primeira impressão. */}
              {Object.keys(sessao.areas).length > 0 && (
                <div className="mb-4">
                  <AreaColumns areas={sessao.areas} />
                </div>
              )}
              {sessao.respostas.map((r) => (
                <div key={r.num} className="flex items-start gap-3 border-b border-brand-line py-2.5 text-[13.5px] last:border-none">
                  <span className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-white ${r.acertou ? 'bg-brand-green' : 'bg-brand-red'}`}>
                    {r.acertou ? <Check size={13} strokeWidth={3} /> : <X size={13} strokeWidth={3} />}
                  </span>
                  <div>
                    <div className="font-semibold text-brand-ink">{r.area}</div>
                    <div className="text-brand-ink-dim">respondeu {r.escolhida ?? '—'} · gabarito {r.gabarito}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[14px] border-[1.5px] border-brand-line p-5">
          <h3 className="mb-1 text-[14.5px] font-bold text-brand-navy">Resumo</h3>
          <p className="text-[13px] text-brand-ink-dim">Alvo · {labelCargo(sessao.perfil)} em {rotuloPerfil('alvo', sessao.perfil.alvo)}</p>
        </div>
      </div>

      {sessao.blocos && sessao.blocos.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[15px] font-bold text-brand-ink">Ponto a ponto ({sessao.blocos.length} blocos)</h2>
          <div className="mt-3 flex flex-col gap-2.5">
            {sessao.blocos.map((b) => (
              <div key={b.id} className="rounded-[14px] border-[1.5px] border-brand-line px-4 py-3.5">
                <h3 className="pl-3 text-[13.5px] font-semibold text-brand-ink" style={{ borderLeft: '3px solid #203C7C' }}>
                  {b.title}
                </h3>
                {b.paragraphs.map((p, i) => (
                  <p key={i} className="mt-1.5 text-[12.5px] leading-relaxed text-brand-ink-soft">{p}</p>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
