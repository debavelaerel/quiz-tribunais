import { paraFatias } from '@/lib/pieChart'
import type { ItemDistribuicao } from '@/lib/analytics'

// Paleta categórica pro painel administrativo — deliberadamente FORA da
// regra de 3 cores do DESIGN.md (essa regra é da identidade do quiz que o
// lead responde, não da ferramenta interna que o time usa). Com só azul e
// dourado, gráficos de pizza com várias fatias pareciam monocromáticos e
// difíceis de distinguir; oito fatias da mesma cor em tons diferentes é
// pior pra achar "qual fatia é qual" do que oito cores realmente diferentes.
//
// Ordem e hexadecimais vêm da paleta categórica validada da skill de
// dataviz (references/palette.md) — não escolhidos no olho: passa nos 4
// checks de segurança (daltonismo, contraste, banda de luminosidade) nessa
// ordem exata; trocar a ordem sem revalidar quebra essa garantia.
const CORES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948']

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
