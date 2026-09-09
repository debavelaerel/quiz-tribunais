import { criarSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { criarSupabaseSessionRepo } from '@/lib/server/supabaseSessionRepo'
import { EVENTO } from '@/lib/questions'
import { distribuicao, taxaCliquePorValor, funilConversao, sessoesPorDia, mediaMinutosConclusao, resumoPorFluxo } from '@/lib/analytics'
import { ROTULOS_PERFIL } from '@/lib/adminLabels'
import { listarTudo } from '@/lib/server/listarTudo'
import type { RespostasPerfil } from '@/lib/perfil'
import PieChart from '@/components/admin/PieChart'
import RankedBars from '@/components/admin/RankedBars'
import Funnel from '@/components/admin/Funnel'
import Sparkline from '@/components/admin/Sparkline'
import FlowCompare from '@/components/admin/FlowCompare'

export const runtime = 'nodejs'
// Sem searchParams/cookies/headers pra sinalizar dinamismo, o Next tentava
// pré-renderizar esta página como estática no build — congelando os dados
// (ou pior, quebrando o build por não achar Supabase configurado). A consulta
// tem que rodar a cada request.
export const dynamic = 'force-dynamic'

// Mesmo teto de segurança da exportação (ver app/api/admin/export/route.ts)
// — aqui alimenta as agregações, não uma listagem paginada. listarTudo()
// pagina em blocos por baixo (ver lib/server/listarTudo.ts) pra não perder
// linha silenciosamente no max_rows do Supabase.
const LIMITE_ANALYTICS = 5000

// Também define "terminou o perfil" pro funil de conversão (abaixo): uma
// sessão só conta essa etapa quando respondeu as 6 perguntas desta lista.
const PERGUNTAS_PERFIL: { chave: keyof RespostasPerfil; titulo: string }[] = [
  { chave: 'alvo', titulo: 'Qual concurso é a sua prioridade hoje?' },
  { chave: 'cargo', titulo: 'Qual cargo você mira?' },
  { chave: 'formacao', titulo: 'Qual é a sua formação hoje?' },
  { chave: 'momento', titulo: 'Qual dessas frases você diria pra um amigo hoje?' },
  { chave: 'dor', titulo: 'Qual é o seu maior gargalo hoje?' },
  { chave: 'horas', titulo: 'Quantas horas por dia você consegue estudar?' },
]

const ROTULOS_CLASSE: Record<string, string> = { A: 'Classe A', B: 'Classe B' }
const ROTULOS_CURSO: Record<string, string> = { 'C1-TRT': 'Curso 1 · TRT (168 temas)', 'C2-TJTRF': 'Curso 2 · TJ e TRF (231 temas)' }
const FLUXOS: ('padrao' | 'final')[] = ['padrao', 'final']

export default async function AnalyticsPage() {
  const repo = criarSupabaseSessionRepo(criarSupabaseAdmin())
  const { sessoes, total } = await listarTudo(repo, EVENTO, {}, LIMITE_ANALYTICS)

  const concluidas = sessoes.filter((s) => s.status === 'concluido')
  const taxaConclusao = total > 0 ? Math.round((concluidas.length / total) * 100) : 0
  const comAcerto = sessoes.filter((s) => s.acertos !== null)
  const mediaAcertos = comAcerto.length > 0
    ? (comAcerto.reduce((soma, s) => soma + (s.acertos ?? 0), 0) / comAcerto.length).toFixed(1)
    : '—'
  const totalGraduado = comAcerto[0]?.total ?? 4
  const taxaCliqueGeral = total > 0 ? Math.round((sessoes.filter((s) => s.whatsappClicadoEm).length / total) * 100) : 0
  const tempoMedioMin = mediaMinutosConclusao(sessoes.map((s) => ({ startedAt: s.startedAt, completedAt: s.completedAt })))

  const classes = distribuicao(concluidas.map((s) => s.perfilCalculado?.classe))
  const cursos = distribuicao(concluidas.map((s) => s.perfilCalculado?.cursoCod))

  const funil = funilConversao(sessoes.map((s) => ({
    perfilCompleto: PERGUNTAS_PERFIL.every(({ chave }) => !!s.perfil[chave]),
    testeRespondido: s.acertos !== null,
    concluida: s.status === 'concluido',
    clicouWhatsapp: !!s.whatsappClicadoEm,
  })))
  const porDia = sessoesPorDia(sessoes.map((s) => s.startedAt))
  const porFluxo = resumoPorFluxo(
    sessoes.map((s) => ({ fluxo: s.fluxo, concluida: s.status === 'concluido', clicou: !!s.whatsappClicadoEm, acertos: s.acertos })),
    FLUXOS,
  )

  // Prioridade comercial: não é "quantos responderam X" — é "de quem
  // respondeu X, quantos converteram" (clicaram no WhatsApp). Todas as
  // sessões que responderam entram, concluídas ou não, porque o clique é
  // registrado independente de a sessão ter fechado (ver lib/server/quizService.ts).
  const cliqueEdital = taxaCliquePorValor(sessoes.map((s) => ({ valor: s.perfil.edital, clicou: !!s.whatsappClicadoEm })))
  const cliqueVde = taxaCliquePorValor(sessoes.map((s) => ({ valor: s.perfil.vde, clicou: !!s.whatsappClicadoEm })))

  return (
    <div>
      <h1 className="text-[22px] font-bold tracking-[-0.01em] text-brand-ink">Analytics</h1>
      <p className="mt-1 text-[13.5px] text-brand-ink-dim">Perfil agregado de respostas · {total} {total === 1 ? 'sessão' : 'sessões'}</p>

      <div className="my-6 grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { num: total, lbl: 'total de sessões' },
          { num: `${taxaConclusao}%`, lbl: 'taxa de conclusão' },
          { num: `${mediaAcertos} / ${totalGraduado}`, lbl: 'média de acertos' },
          { num: concluidas.length, lbl: 'concluídas' },
          { num: `${taxaCliqueGeral}%`, lbl: 'clicou no WhatsApp' },
          { num: tempoMedioMin !== null ? `${Math.round(tempoMedioMin)}min` : '—', lbl: 'tempo médio até concluir' },
        ].map((c) => (
          <div key={c.lbl} className="rounded-[14px] border-[1.5px] border-brand-line px-4.5 py-4">
            <div className="text-[22px] font-bold tracking-[-0.01em] text-brand-ink">{c.num}</div>
            <div className="mt-1 text-[12px] text-brand-ink-dim">{c.lbl}</div>
          </div>
        ))}
      </div>

      {total === 0 ? (
        <div className="rounded-[14px] border-[1.5px] border-brand-line p-8 text-center text-brand-ink-dim">
          Ninguém completou o quiz ainda — sem dados pra mostrar.
        </div>
      ) : (
        <>
          <div className="rounded-[14px] border-[1.5px] border-brand-line p-6">
            <h2 className="mb-1 text-[15px] font-bold text-brand-navy">Sessões por dia</h2>
            <p className="mb-1 text-[12.5px] text-brand-ink-dim">Tendência de sessões iniciadas.</p>
            <Sparkline dados={porDia} />
          </div>

          <div className="mt-5 rounded-[14px] border-[1.5px] border-brand-line p-6">
            <h2 className="mb-1 text-[15px] font-bold text-brand-navy">Funil de conversão</h2>
            <p className="mb-5 text-[12.5px] text-brand-ink-dim">Do início da sessão até o clique no WhatsApp — % sempre relativo às sessões iniciadas.</p>
            <Funnel etapas={funil} />
          </div>

          <div className="mt-5 rounded-[14px] border-[1.5px] border-brand-line p-6">
            <h2 className="mb-1 text-[15px] font-bold text-brand-navy">Perfis calculados</h2>
            <p className="mb-5 text-[12.5px] text-brand-ink-dim">Só sessões concluídas ({concluidas.length}) — a classificação só existe depois do teste graduado.</p>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
              <PieChart titulo="Classe de qualificação" dados={classes} rotulos={ROTULOS_CLASSE} />
              <RankedBars titulo="Curso indicado" dados={cursos} rotulos={ROTULOS_CURSO} />
            </div>
          </div>

          <div className="mt-5 rounded-[14px] border-[1.5px] border-brand-line p-6">
            <h2 className="mb-1 text-[15px] font-bold text-brand-navy">Perfil de respostas</h2>
            <p className="mb-5 text-[12.5px] text-brand-ink-dim">Todas as sessões que responderam cada pergunta, concluídas ou não.</p>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
              {PERGUNTAS_PERFIL.map(({ chave, titulo }) => (
                <RankedBars
                  key={chave}
                  titulo={titulo}
                  dados={distribuicao(sessoes.map((s) => s.perfil[chave] as string | undefined))}
                  rotulos={ROTULOS_PERFIL[chave]}
                />
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-[14px] border-[1.5px] border-brand-line p-6">
            <FlowCompare titulo="Comparativo por fluxo" dados={porFluxo} totalGraduado={totalGraduado} />
          </div>

          <div className="mt-5 rounded-[14px] border-[1.5px] border-brand-line p-6">
            <h2 className="mb-1 text-[15px] font-bold text-brand-navy">Prioridade comercial</h2>
            <p className="mb-5 text-[12.5px] text-brand-ink-dim">Taxa de clique no WhatsApp dentro de cada segmento — onde focar a atenção, não só quantos leads existem.</p>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
              <RankedBars titulo="Clique no WhatsApp × urgência do edital" dados={cliqueEdital} rotulos={ROTULOS_PERFIL.edital} />
              <RankedBars titulo="Clique no WhatsApp × relação com o VDE" dados={cliqueVde} rotulos={ROTULOS_PERFIL.vde} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
