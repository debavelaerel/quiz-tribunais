import { ORDEM_AREAS, LABEL_CURTO_AREA } from '@/lib/areasLabels'

type AreaRadarProps = {
  areas: Record<string, { pct: number }>
  // Área mais fraca (já calculada no servidor, ver calcularAreaPrioritaria
  // em lib/scoring.ts) — ganha o único ponto/rótulo em dourado do gráfico,
  // em vez de recalcular "qual é a pior" aqui de novo.
  areaPrioritaria: string | null
}

const RAIO = 70
const CENTRO = 100
// Eixo por área, na ordem fixa de ORDEM_AREAS: topo, direita, baixo,
// esquerda (sentido horário) — dx/dy é a direção unitária do eixo.
const EIXOS = [
  { dx: 0, dy: -1, labelX: 100, labelY: 20, anchor: 'middle' as const },
  { dx: 1, dy: 0, labelX: 184, labelY: 103, anchor: 'start' as const },
  { dx: 0, dy: 1, labelX: 100, labelY: 186, anchor: 'middle' as const },
  { dx: -1, dy: 0, labelX: 16, labelY: 103, anchor: 'end' as const },
]

export default function AreaRadar({ areas, areaPrioritaria }: AreaRadarProps) {
  const pontos = ORDEM_AREAS.map((area, i) => {
    const eixo = EIXOS[i]
    const pct = areas[area]?.pct ?? 0
    const r = (Math.max(0, Math.min(100, pct)) / 100) * RAIO
    return { area, x: CENTRO + eixo.dx * r, y: CENTRO + eixo.dy * r, fraco: area === areaPrioritaria }
  })
  const poligono = pontos.map((p) => `${p.x},${p.y}`).join(' ')

  return (
    // viewBox mais largo que os 0-200 dos eixos: SVG raiz recorta por padrão
    // (overflow:hidden implícito), e os rótulos laterais ("Constitucional",
    // "Raciocínio") são longos o bastante pra estourar x=200/x=0 e sumir
    // cortados. -55/+130 de folga de cada lado dá espaço pro texto sem
    // mudar a escala nem a posição do diamante (mesmo fator 0.8 px/unidade
    // do viewBox original, só com mais canvas ao redor).
    <svg viewBox="-55 0 330 200" width={264} height={160} role="img" aria-label="Desempenho por área">
      {/* Grade de referência — 3 anéis + 2 eixos, sempre neutra (nunca a cor de dado). */}
      <polygon points="100,30 170,100 100,170 30,100" fill="none" stroke="#E7E7EA" strokeWidth={1.5} />
      <polygon points="100,50 150,100 100,150 50,100" fill="none" stroke="#E7E7EA" strokeWidth={1.5} />
      <polygon points="100,70 130,100 100,130 70,100" fill="none" stroke="#E7E7EA" strokeWidth={1.5} />
      <line x1={100} y1={30} x2={100} y2={170} stroke="#E7E7EA" strokeWidth={1.5} />
      <line x1={30} y1={100} x2={170} y2={100} stroke="#E7E7EA" strokeWidth={1.5} />

      <polygon points={poligono} fill="#203C7C" fillOpacity={0.22} stroke="#203C7C" strokeWidth={2.5} />
      {pontos.map((p) => (
        <circle key={p.area} cx={p.x} cy={p.y} r={4} fill={p.fraco ? '#C89B18' : '#203C7C'} />
      ))}
      {ORDEM_AREAS.map((area, i) => (
        <text
          key={area}
          x={EIXOS[i].labelX}
          y={EIXOS[i].labelY}
          textAnchor={EIXOS[i].anchor}
          fontSize={9}
          fontWeight={area === areaPrioritaria ? 700 : 400}
          fill={area === areaPrioritaria ? '#8A6A0C' : '#5B6478'}
        >
          {LABEL_CURTO_AREA[area]}
        </text>
      ))}
    </svg>
  )
}
