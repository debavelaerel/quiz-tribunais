import type { EtapaFunil } from '@/lib/analytics'

type FunnelProps = {
  // Opcional: a página já usa um <h2> próprio pra este gráfico (título +
  // subtítulo explicativo lado a lado não cabem bem no mesmo <p>).
  titulo?: string
  etapas: EtapaFunil[]
}

// Largura mínima do topo de cada trapézio (%) — sem isso, uma etapa com
// pct baixo (ex.: 11% de clique no WhatsApp) vira uma fatia fina demais
// pra enxergar onde ela começa e termina.
const LARGURA_MIN = 10

// Afunilamento dentro da PRÓPRIA faixa (base = topo × este fator), não
// entre uma faixa e a próxima. Essas sessões não vêm de um tracking de
// visita anônima que só decresce (ver funilConversao em lib/analytics.ts)
// — uma etapa às vezes tem MAIS sessões que a anterior (dado real: nem
// toda sessão passa pelas etapas na mesma ordem). Afunilar faixa-a-faixa
// pela etapa seguinte faria a forma se cruzar (viraria um X) toda vez que
// isso acontecesse; afunilar cada faixa por si só sempre dá um trapézio
// limpo, e ainda lê como funil.
const FATOR_CONE = 0.82

// Só a última faixa (clique no WhatsApp, o que interessa pra vendas) vem
// em dourado.
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
      <div className="mt-3 flex flex-col gap-[3px]">
        {etapas.map((e, i) => {
          const ultima = i === etapas.length - 1
          const topo = Math.max(e.pct, LARGURA_MIN)
          const base = topo * FATOR_CONE
          return (
            <div key={e.etapa} className="grid grid-cols-[minmax(120px,160px)_1fr_56px] items-center gap-2.5 text-[12.5px]">
              <span className="text-right text-brand-ink-soft">{e.etapa}</span>
              <div
                className={`h-9 ${ultima ? 'bg-gradient-to-r from-brand-gold-deep to-brand-gold' : 'bg-brand-ink'}`}
                style={{
                  clipPath: `polygon(${50 - topo / 2}% 0%, ${50 + topo / 2}% 0%, ${50 + base / 2}% 100%, ${50 - base / 2}% 100%)`,
                }}
              />
              <span className="text-right leading-tight">
                <span className="block font-semibold tabular-nums text-brand-ink">{e.total}</span>
                <span className="block text-[11px] text-brand-ink-dim">{e.pct}%</span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
