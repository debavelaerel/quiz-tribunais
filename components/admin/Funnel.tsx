import type { EtapaFunil } from '@/lib/analytics'

type FunnelProps = {
  // Opcional: a página já usa um <h2> próprio pra este gráfico (título +
  // subtítulo explicativo lado a lado não cabem bem no mesmo <p>).
  titulo?: string
  etapas: EtapaFunil[]
}

// Funil honesto: cada barra é uma etapa que a sessão realmente gravou (sem
// tracking de visita anônima — ver comentário de funilConversao em
// lib/analytics.ts). pct é sempre relativo à primeira etapa, não à
// anterior. Só a última barra (o clique no WhatsApp, o que interessa pra
// vendas) vem em dourado.
export default function Funnel({ titulo, etapas }: FunnelProps) {
  if (etapas.length === 0 || etapas[0].total === 0) {
    return (
      <div>
        {titulo && <p className="text-[13.5px] font-bold text-brand-ink">{titulo}</p>}
        <p className="mt-2 text-[13px] text-brand-ink-dim">Sem sessões ainda pra montar o funil.</p>
      </div>
    )
  }

  return (
    <div>
      {titulo && <p className="text-[13.5px] font-bold text-brand-ink">{titulo}</p>}
      <div className="mt-3 flex flex-col gap-2">
        {etapas.map((e, i) => {
          const ultima = i === etapas.length - 1
          return (
            <div key={e.etapa} className="grid grid-cols-[minmax(120px,160px)_1fr_44px] items-center gap-2.5 text-[12.5px]">
              <span className="text-right text-brand-ink-soft">{e.etapa}</span>
              <div className="h-[26px] overflow-hidden rounded-lg bg-brand-tint">
                <div
                  className={`flex h-full items-center rounded-lg pl-2.5 text-[11.5px] font-semibold ${ultima ? 'bg-gradient-to-r from-brand-gold-deep to-brand-gold text-brand-ink' : 'bg-brand-ink text-white'}`}
                  style={{ width: `${Math.max(e.pct, 8)}%` }}
                >
                  {e.total}
                </div>
              </div>
              <span className="text-right font-semibold tabular-nums text-brand-ink">{e.pct}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
