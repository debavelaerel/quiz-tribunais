import { describe, it, expect } from 'vitest'
import { distribuicao, taxaCliquePorValor, funilConversao, sessoesPorDia, mediaMinutosConclusao, resumoPorFluxo } from './analytics'

describe('distribuicao', () => {
  it('conta ocorrências e calcula percentual sobre o total de valores válidos', () => {
    const d = distribuicao(['tj', 'tj', 'trf', 'tj', 'trt'])
    expect(d).toEqual([
      { valor: 'tj', contagem: 3, pct: 60 },
      { valor: 'trf', contagem: 1, pct: 20 },
      { valor: 'trt', contagem: 1, pct: 20 },
    ])
  })

  it('ordena por contagem desc, desempate alfabético', () => {
    const d = distribuicao(['b', 'a', 'a', 'b'])
    expect(d.map((x) => x.valor)).toEqual(['a', 'b'])
  })

  it('ignora undefined, null e string vazia (perguntas não respondidas)', () => {
    const d = distribuicao(['tj', undefined, null, '', 'tj'])
    expect(d).toEqual([{ valor: 'tj', contagem: 2, pct: 100 }])
  })

  it('array vazio devolve array vazio, sem dividir por zero', () => {
    expect(distribuicao([])).toEqual([])
    expect(distribuicao([undefined, null])).toEqual([])
  })

  it('arredonda pct pra 1 casa decimal', () => {
    const d = distribuicao(['a', 'b', 'c'])
    expect(d.every((x) => x.pct === Math.round(x.pct * 10) / 10)).toBe(true)
    expect(d.reduce((soma, x) => soma + x.pct, 0)).toBeCloseTo(100, 0)
  })
})

describe('taxaCliquePorValor', () => {
  it('calcula a % de clique dentro de cada valor de segmento, não a distribuição geral', () => {
    const t = taxaCliquePorValor([
      { valor: 'reta', clicou: true },
      { valor: 'reta', clicou: true },
      { valor: 'reta', clicou: false },
      { valor: 'sem', clicou: false },
      { valor: 'sem', clicou: false },
    ])
    expect(t).toEqual([
      { valor: 'reta', total: 3, cliques: 2, pct: 66.7 },
      { valor: 'sem', total: 2, cliques: 0, pct: 0 },
    ])
  })

  it('ordena por taxa de clique desc, desempate por total desc, depois alfabético', () => {
    const t = taxaCliquePorValor([
      { valor: 'a', clicou: true },
      { valor: 'b', clicou: true },
      { valor: 'b', clicou: false },
      { valor: 'c', clicou: true },
    ])
    expect(t.map((x) => x.valor)).toEqual(['a', 'c', 'b'])
  })

  it('ignora valor undefined, null ou vazio (pergunta não respondida)', () => {
    const t = taxaCliquePorValor([
      { valor: 'aluno', clicou: true },
      { valor: undefined, clicou: true },
      { valor: null, clicou: false },
      { valor: '', clicou: true },
    ])
    expect(t).toEqual([{ valor: 'aluno', total: 1, cliques: 1, pct: 100 }])
  })

  it('array vazio devolve array vazio, sem dividir por zero', () => {
    expect(taxaCliquePorValor([])).toEqual([])
  })
})

describe('funilConversao', () => {
  it('conta cada etapa e calcula pct sempre relativo à primeira etapa (sessões iniciadas)', () => {
    const f = funilConversao([
      { perfilCompleto: true, testeRespondido: true, concluida: true, clicouWhatsapp: true },
      { perfilCompleto: true, testeRespondido: true, concluida: true, clicouWhatsapp: false },
      { perfilCompleto: true, testeRespondido: false, concluida: false, clicouWhatsapp: false },
      { perfilCompleto: false, testeRespondido: false, concluida: false, clicouWhatsapp: false },
    ])
    expect(f).toEqual([
      { etapa: 'Sessões iniciadas', total: 4, pct: 100 },
      { etapa: 'Terminou o perfil', total: 3, pct: 75 },
      { etapa: 'Respondeu o teste', total: 2, pct: 50 },
      { etapa: 'Concluiu e viu o resultado', total: 2, pct: 50 },
      { etapa: 'Clicou no WhatsApp', total: 1, pct: 25 },
    ])
  })

  it('array vazio devolve todas as etapas zeradas, sem dividir por zero', () => {
    const f = funilConversao([])
    expect(f.every((e) => e.total === 0 && e.pct === 0)).toBe(true)
    expect(f).toHaveLength(5)
  })
})

describe('sessoesPorDia', () => {
  it('agrupa por dia (ignora hora) e ordena cronologicamente', () => {
    const s = sessoesPorDia(['2026-09-05T10:00:00Z', '2026-09-03T08:00:00Z', '2026-09-05T22:00:00Z'])
    expect(s).toEqual([
      { data: '2026-09-03', contagem: 1 },
      { data: '2026-09-05', contagem: 2 },
    ])
  })

  it('array vazio devolve array vazio', () => {
    expect(sessoesPorDia([])).toEqual([])
  })
})

describe('mediaMinutosConclusao', () => {
  it('calcula a média de minutos entre início e conclusão, só das sessões concluídas', () => {
    const m = mediaMinutosConclusao([
      { startedAt: '2026-09-05T10:00:00Z', completedAt: '2026-09-05T10:06:00Z' },
      { startedAt: '2026-09-05T10:00:00Z', completedAt: '2026-09-05T10:04:00Z' },
      { startedAt: '2026-09-05T10:00:00Z', completedAt: null },
    ])
    expect(m).toBe(5)
  })

  it('sem nenhuma sessão concluída devolve null, sem dividir por zero', () => {
    expect(mediaMinutosConclusao([{ startedAt: '2026-09-05T10:00:00Z', completedAt: null }])).toBeNull()
    expect(mediaMinutosConclusao([])).toBeNull()
  })
})

describe('resumoPorFluxo', () => {
  it('resume sessões, taxa de conclusão, taxa de clique e média de acertos por fluxo, na ordem pedida', () => {
    const r = resumoPorFluxo(
      [
        { fluxo: 'padrao', concluida: true, clicou: true, acertos: 4 },
        { fluxo: 'padrao', concluida: true, clicou: false, acertos: 2 },
        { fluxo: 'padrao', concluida: false, clicou: false, acertos: null },
        { fluxo: 'final', concluida: true, clicou: true, acertos: 3 },
      ],
      ['padrao', 'final'],
    )
    expect(r).toEqual([
      { fluxo: 'padrao', sessoes: 3, taxaConclusaoPct: 66.7, taxaCliquePct: 33.3, mediaAcertos: 3 },
      { fluxo: 'final', sessoes: 1, taxaConclusaoPct: 100, taxaCliquePct: 100, mediaAcertos: 3 },
    ])
  })

  it('fluxo sem nenhuma sessão devolve zeros e média nula, sem dividir por zero', () => {
    const r = resumoPorFluxo([{ fluxo: 'padrao', concluida: true, clicou: true, acertos: 4 }], ['padrao', 'final'])
    expect(r[1]).toEqual({ fluxo: 'final', sessoes: 0, taxaConclusaoPct: 0, taxaCliquePct: 0, mediaAcertos: null })
  })
})
