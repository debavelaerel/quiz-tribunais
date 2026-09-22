import { describe, it, expect } from 'vitest'
import { calcularPerfil, type RespostasPerfil } from './perfil'

function perfilBase(overrides: Partial<RespostasPerfil> = {}): RespostasPerfil {
  return {
    alvo: 'tj', cargo: 'analista', formacao: 'direito', tempo: 't0', provas: 'p0',
    metodo: 'nenhum', vde: 'nunca', horas: 'h1', edital: 'sem', dor: 'improviso',
    momento: 'zero', dinheiro: '96', leitura: 'completa', editais: [],
    ...overrides,
  }
}

describe('calcularPerfil — ritmo', () => {
  // Mesmo texto de RITMOS em reference/raio-x-da-base/diagnosis/profile.py —
  // um único mapeamento por horas, sem diferenciar por curso (decisão
  // tomada em 2026-09-17: copy do pacote é tratada como aprovada, e deve
  // bater com o que o serviço de PDF em Python também mostra).
  it.each([
    ['h0', 'abaixo do cronograma mínimo; com 2h por dia, base em 12 meses'],
    ['h1', 'base em 12 meses, no ritmo de 2h por dia'],
    ['h2', 'base entre 8 e 12 meses'],
    ['h3', 'base entre 6 e 8 meses'],
    ['h4', 'base em 6 meses'],
  ])('horas=%s -> ritmo="%s"', (horas, esperado) => {
    expect(calcularPerfil(perfilBase({ horas }), 0).ritmo).toBe(esperado)
  })

  it('o texto do ritmo é o mesmo pra TRT (Curso 1) e TJ/TRF (Curso 2), mesmas horas', () => {
    const trt = calcularPerfil(perfilBase({ alvo: 'trt', horas: 'h2' }), 0)
    const tjtrf = calcularPerfil(perfilBase({ alvo: 'tj', horas: 'h2' }), 0)
    expect(trt.ritmo).toBe(tjtrf.ritmo)
  })
})

describe('calcularPerfil — curso', () => {
  it('alvo=trt indica o Curso 1 (168 temas)', () => {
    const p = calcularPerfil(perfilBase({ alvo: 'trt' }), 0)
    expect(p.cursoCod).toBe('C1-TRT')
    expect(p.curso).toBe('Curso 1 · Analista de TRT (168 temas)')
  })

  it('qualquer outro alvo indica o Curso 2 (231 temas)', () => {
    const p = calcularPerfil(perfilBase({ alvo: 'tj' }), 0)
    expect(p.cursoCod).toBe('C2-TJTRF')
    expect(p.curso).toBe('Curso 2 · Analista de TJ e TRF (231 temas)')
  })
})

describe('calcularPerfil — pontuação e classe', () => {
  it('perfil forte (analista, direito, horas altas, edital previsto, dor pontuável) bate classe A', () => {
    const p = calcularPerfil(perfilBase({
      cargo: 'analista', formacao: 'direito', horas: 'h2', edital: 'previsto', dor: 'base',
    }), 0)
    expect(p.pontos).toBe(9)
    expect(p.classe).toBe('A')
  })

  it('perfil fraco (técnico em TJ, formação não-direito, horas baixas, sem edital, dor não pontuável) bate classe B', () => {
    const p = calcularPerfil(perfilBase({
      alvo: 'tj', cargo: 'tecnico', formacao: 'outra', horas: 'h0', edital: 'nao', dor: 'tempo',
    }), 0)
    expect(p.pontos).toBe(2)
    expect(p.classe).toBe('B')
  })

  it('técnico pontua pelo cargo fora do TJ, mas não pontua mirando o TJ', () => {
    const trt = calcularPerfil(perfilBase({ alvo: 'trt', cargo: 'tecnico' }), 0)
    const tj = calcularPerfil(perfilBase({ alvo: 'tj', cargo: 'tecnico' }), 0)
    expect(trt.pontos).toBe(tj.pontos + 1)
  })
})
