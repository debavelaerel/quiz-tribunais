// Geometria de gráfico de pizza — puro (sem DOM, sem lib de gráfico nova),
// devolve o atributo `d` de um <path> SVG por fatia. 0° aponta pro topo,
// sentido horário (convenção de relógio, mais legível que a matemática pura
// com 0° apontando pra direita).

export type FatiaPizza = {
  valor: string
  pct: number
  path: string
  // Ponto médio angular da fatia, em graus — útil pra posicionar um rótulo
  // fora da fatia sem recalcular trigonometria na hora de renderizar.
  anguloMedio: number
}

function grausParaPonto(cx: number, cy: number, raio: number, grausDoTopo: number): { x: number; y: number } {
  const rad = ((grausDoTopo - 90) * Math.PI) / 180
  return { x: cx + raio * Math.cos(rad), y: cy + raio * Math.sin(rad) }
}

function fatiaPath(cx: number, cy: number, raio: number, anguloInicio: number, anguloFim: number): string {
  const vaoTotal = anguloFim - anguloInicio
  if (vaoTotal >= 359.99) {
    // Uma única categoria = 100% do total: arco não fecha sozinho num único
    // comando, precisa de dois semicírculos.
    const p1 = grausParaPonto(cx, cy, raio, anguloInicio)
    const p2 = grausParaPonto(cx, cy, raio, anguloInicio + 180)
    return `M ${p1.x} ${p1.y} A ${raio} ${raio} 0 1 1 ${p2.x} ${p2.y} A ${raio} ${raio} 0 1 1 ${p1.x} ${p1.y} Z`
  }
  const inicio = grausParaPonto(cx, cy, raio, anguloInicio)
  const fim = grausParaPonto(cx, cy, raio, anguloFim)
  const arcoGrande = vaoTotal > 180 ? 1 : 0
  return `M ${cx} ${cy} L ${inicio.x} ${inicio.y} A ${raio} ${raio} 0 ${arcoGrande} 1 ${fim.x} ${fim.y} Z`
}

// `dist` já vem ordenada (maior fatia primeiro) — a ordem de entrada é a
// ordem de desenho, sentido horário a partir do topo.
export function paraFatias(dist: { valor: string; pct: number }[], raio: number, cx = raio, cy = raio): FatiaPizza[] {
  let anguloAcumulado = 0
  return dist.map((d) => {
    const anguloInicio = anguloAcumulado
    const anguloFim = anguloAcumulado + (d.pct / 100) * 360
    anguloAcumulado = anguloFim
    return {
      valor: d.valor,
      pct: d.pct,
      path: fatiaPath(cx, cy, raio, anguloInicio, anguloFim),
      anguloMedio: (anguloInicio + anguloFim) / 2,
    }
  })
}
