import { ORDEM_AREAS, LABEL_CURTO_AREA } from '@/lib/areasLabels'

type AreaColumnsProps = {
  areas: Record<string, { pct: number }>
}

// Mesmo dado do AreaRadar (components/AreaRadar.tsx), só que em colunas com
// número exato — pro time comercial, que quer o valor preciso pra decidir
// a abordagem, não só o formato geral. Por isso não mostra as duas juntas
// pro lead: seria repetir a mesma informação de dois jeitos na mesma tela.
export default function AreaColumns({ areas }: AreaColumnsProps) {
  const dados = ORDEM_AREAS.filter((area) => areas[area] !== undefined).map((area) => ({ area, pct: areas[area].pct }))
  if (dados.length === 0) return null

  const menor = Math.min(...dados.map((d) => d.pct))
  const larguraColuna = 50
  const alturaMax = 110

  return (
    <svg viewBox={`0 0 ${dados.length * larguraColuna} 150`} width="100%" height={140} role="img" aria-label="Desempenho por área">
      <line x1={4} y1={130} x2={dados.length * larguraColuna - 4} y2={130} stroke="#C9C9CE" strokeWidth={1.5} />
      {dados.map((d, i) => {
        const x = i * larguraColuna + 12
        const altura = Math.max((d.pct / 100) * alturaMax, 6)
        const y = 20 + (alturaMax - altura)
        const fraco = d.pct === menor
        const cor = fraco ? '#C89B18' : '#203C7C'
        return (
          <g key={d.area}>
            <rect x={x} y={y} width={26} height={altura} rx={5} fill={cor} />
            <text x={x + 13} y={y - 6} textAnchor="middle" fontSize={9} fontWeight={700} fill={fraco ? '#8A6A0C' : '#203C7C'}>{d.pct}%</text>
            <text x={x + 13} y={143} textAnchor="middle" fontSize={7.5} fill="#5B6478">{LABEL_CURTO_AREA[d.area]}</text>
          </g>
        )
      })}
    </svg>
  )
}
