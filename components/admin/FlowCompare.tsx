import type { ResumoFluxo } from '@/lib/analytics'

type FlowCompareProps = {
  titulo: string
  dados: ResumoFluxo[]
  // Denominador da nota média (quantas questões tem o teste graduado) —
  // mesmo valor usado no card "média de acertos" do topo da página.
  totalGraduado: number
}

const NOME_FLUXO: Record<string, string> = { padrao: 'Fluxo padrão', final: 'Fluxo final' }

// Duas colunas fixas (padrão × final), sempre as duas — mesmo quando um
// fluxo ainda não tem sessão nenhuma (ver resumoPorFluxo em
// lib/analytics.ts). Só as 2 cores da marca: navy marca o primeiro fluxo,
// dourado o segundo — aqui são só 2 "séries" possíveis, cor carrega
// identidade de verdade, como no PieChart binário.
export default function FlowCompare({ titulo, dados, totalGraduado }: FlowCompareProps) {
  return (
    <div>
      <p className="mb-3 text-[13.5px] font-bold text-brand-ink">{titulo}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {dados.map((d, i) => (
          <div key={d.fluxo} className="rounded-[12px] border-[1.5px] border-brand-line p-4">
            <p className="mb-2.5 flex items-center gap-2 text-[13px] font-bold text-brand-ink">
              <span className={`h-2.5 w-2.5 flex-none rounded-sm ${i === 0 ? 'bg-brand-ink' : 'bg-brand-gold-deep'}`} />
              {NOME_FLUXO[d.fluxo] ?? d.fluxo}
            </p>
            {d.sessoes === 0 ? (
              <p className="text-[12.5px] text-brand-ink-dim">Sem sessões ainda nesse fluxo.</p>
            ) : (
              <dl className="flex flex-col gap-1.5 text-[12.5px]">
                <div className="flex justify-between border-b border-brand-line pb-1.5 text-brand-ink-soft">
                  <dt>Sessões</dt>
                  <dd className="font-semibold tabular-nums text-brand-ink">{d.sessoes}</dd>
                </div>
                <div className="flex justify-between border-b border-brand-line pb-1.5 text-brand-ink-soft">
                  <dt>Taxa de conclusão</dt>
                  <dd className="font-semibold tabular-nums text-brand-ink">{d.taxaConclusaoPct}%</dd>
                </div>
                <div className="flex justify-between border-b border-brand-line pb-1.5 text-brand-ink-soft">
                  <dt>Clicou no WhatsApp</dt>
                  <dd className="font-semibold tabular-nums text-brand-ink">{d.taxaCliquePct}%</dd>
                </div>
                <div className="flex justify-between text-brand-ink-soft">
                  <dt>Nota média</dt>
                  <dd className="font-semibold tabular-nums text-brand-ink">{d.mediaAcertos ?? '—'} / {totalGraduado}</dd>
                </div>
              </dl>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
