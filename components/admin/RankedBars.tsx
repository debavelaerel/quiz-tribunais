// Aceita qualquer agregação com valor+pct (tanto ItemDistribuicao quanto
// TaxaPorValor de lib/analytics.ts servem) — o componente não sabe nem
// precisa saber se o pct é "% do total de respostas" ou "% de clique
// dentro do segmento", só desenha o ranking.
type ItemRanqueavel = { valor: string; pct: number }

type RankedBarsProps = {
  titulo: string
  dados: ItemRanqueavel[]
  // Mapa opcional de código -> rótulo legível (mesmo formato do PieChart).
  rotulos?: Record<string, string>
}

// Lista ranqueada de uma cor só — a identidade da categoria vem do rótulo
// escrito, não da cor (ver components/admin/PieChart.tsx pro caso binário,
// onde a cor carrega identidade de verdade). Só a barra do topo do ranking
// vem em dourado, pra marcar o segmento mais importante sem precisar de
// mais de uma cor por gráfico — as duas únicas cores da marca (ver
// DESIGN.md) bastam mesmo com N categorias.
export default function RankedBars({ titulo, dados, rotulos }: RankedBarsProps) {
  if (dados.length === 0) {
    return (
      <div className="q-agg">
        <p className="text-[13.5px] font-bold text-brand-ink">{titulo}</p>
        <p className="mt-2 text-[13px] text-brand-ink-dim">Sem respostas ainda pra essa pergunta.</p>
      </div>
    )
  }

  return (
    <div>
      <p className="text-[13.5px] font-bold text-brand-ink">{titulo}</p>
      <div className="mt-3 flex flex-col gap-2">
        {dados.map((item, i) => (
          <div key={item.valor} className="grid grid-cols-[1fr_auto] items-center gap-2 text-[12.5px]">
            <span className="text-brand-ink-soft">{rotulos?.[item.valor] ?? item.valor}</span>
            <span className="font-semibold tabular-nums text-brand-ink">{item.pct}%</span>
            <div className="col-span-2 h-2.5 overflow-hidden rounded-full bg-brand-tint">
              <div
                className={`h-full rounded-full ${i === 0 ? 'bg-gradient-to-r from-brand-gold-deep to-brand-gold' : 'bg-brand-ink'}`}
                style={{ width: `${item.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
