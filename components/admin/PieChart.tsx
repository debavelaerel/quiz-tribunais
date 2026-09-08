import { paraFatias } from '@/lib/pieChart'
import type { ItemDistribuicao } from '@/lib/analytics'

// Paleta cíclica pras fatias — variações do azul e do dourado da marca (ver
// DESIGN.md), nunca uma cor nova. Cinza neutro pro resto quando há mais
// categorias do que cores.
const CORES = ['#203C7C', '#C89B18', '#7C86A6', '#4A64A0', '#F9E08A', '#16305F', '#B7ADFD', '#9CA3B8']

type PieChartProps = {
  titulo: string
  dados: ItemDistribuicao[]
  // Mapa opcional de código -> rótulo legível (ex.: {tj: 'Tribunal de Justiça (TJ)'}).
  rotulos?: Record<string, string>
}

export default function PieChart({ titulo, dados, rotulos }: PieChartProps) {
  const raio = 68
  const tamanho = raio * 2
  const fatias = paraFatias(dados, raio)

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
      <div className="mt-3 flex items-center gap-5">
        <svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`} className="flex-none" role="img" aria-label={titulo}>
          {fatias.map((fatia, i) => (
            <path key={fatia.valor} d={fatia.path} fill={CORES[i % CORES.length]} stroke="#fff" strokeWidth={1.5} />
          ))}
        </svg>
        <ul className="flex flex-col gap-1.5">
          {dados.map((item, i) => (
            <li key={item.valor} className="flex items-center gap-2 text-[12.5px]">
              <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: CORES[i % CORES.length] }} />
              <span className="text-brand-ink-soft">{rotulos?.[item.valor] ?? item.valor}</span>
              <span className="font-semibold text-brand-ink">{item.pct}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
