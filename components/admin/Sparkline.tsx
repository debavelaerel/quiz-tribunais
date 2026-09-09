import type { ContagemPorDia } from '@/lib/analytics'

type SparklineProps = {
  // Opcional: a página já usa um <h2> próprio pra este gráfico.
  titulo?: string
  dados: ContagemPorDia[]
}

const LARGURA = 320
const ALTURA = 56
const MARGEM = 6

// Sparkline de tendência — mostra direção, não valor exato por dia (por
// isso sem eixo, sem grid, sem rótulo em cada ponto). Só o ponto mais
// recente ganha destaque em dourado; a linha em si é a tinta primária
// (navy) — não é uma "série categórica" que precisaria de mais cor.
export default function Sparkline({ titulo, dados }: SparklineProps) {
  if (dados.length < 2) {
    return (
      <div>
        {titulo && <p className="text-[13.5px] font-bold text-brand-ink">{titulo}</p>}
        <p className="mt-2 text-[13px] text-brand-ink-dim">Dados insuficientes pra mostrar tendência (mín. 2 dias com sessão).</p>
      </div>
    )
  }

  const max = Math.max(...dados.map((d) => d.contagem), 1)
  const pontos = dados.map((d, i) => ({
    x: (i / (dados.length - 1)) * (LARGURA - MARGEM * 2) + MARGEM,
    y: ALTURA - MARGEM - (d.contagem / max) * (ALTURA - MARGEM * 2),
  }))
  const ultimo = pontos[pontos.length - 1]

  return (
    <div>
      {titulo && <p className="text-[13.5px] font-bold text-brand-ink">{titulo}</p>}
      <svg
        viewBox={`0 0 ${LARGURA} ${ALTURA}`}
        width="100%"
        height={ALTURA}
        className="mt-3"
        preserveAspectRatio="none"
        role="img"
        aria-label={titulo || 'Tendência de sessões por dia'}
      >
        <polyline points={pontos.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#203c7c" strokeWidth={2.5} />
        <circle cx={ultimo.x} cy={ultimo.y} r={4.5} fill="#c89b18" />
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-brand-ink-dim">
        <span>{formatarDataCurta(dados[0].data)}</span>
        <span>{formatarDataCurta(dados[dados.length - 1].data)}</span>
      </div>
    </div>
  )
}

function formatarDataCurta(iso: string): string {
  const [, mes, dia] = iso.split('-')
  return `${dia}/${mes}`
}
