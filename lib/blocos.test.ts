import { describe, it, expect } from 'vitest'
import { bate, selecionarBlocos } from './blocos'
import { QUESTIONS } from './questions'
import casosDeTesteRaw from './data/casos-de-teste.json'
import type { RespostasPerfil } from './perfil'
import type { RespostaResumo } from './scoring'

type CasoDeAceite = {
  id: string
  resumo: string
  entrada: { codigo: string }
  esperado: { blocos: string[] }
}
const casosDeTeste = casosDeTesteRaw as { casos: CasoDeAceite[] }

const CAMPOS_PERFIL = [
  'alvo', 'cargo', 'formacao', 'tempo', 'provas', 'metodo', 'vde',
  'horas', 'edital', 'dor', 'momento', 'dinheiro', 'leitura',
] as const

// Decodifica o código RX1 dos casos de teste do pacote — só usado aqui, pra
// alimentar o motor com os mesmos leads de exemplo que geraram os 8 PDFs.
function decodeRX1(codigo: string): { perfil: RespostasPerfil; respostas: RespostaResumo[] } {
  const partes = codigo.trim().split('.')
  if (partes[0] !== 'RX1') throw new Error(`código inválido: ${codigo}`)
  const perfilPartes = partes.slice(1, 1 + CAMPOS_PERFIL.length)
  const perfil = {} as RespostasPerfil
  CAMPOS_PERFIL.forEach((campo, i) => {
    ;(perfil as Record<string, string>)[campo] = perfilPartes[i]
  })

  const testeStr = partes[1 + CAMPOS_PERFIL.length]
  const respostas: RespostaResumo[] = Array.from(testeStr).map((letra, i) => {
    const q = QUESTIONS[i]
    return { num: q.num, area: q.area, escolhida: letra === '-' ? '' : letra, gabarito: q.correct, acertou: letra === q.correct }
  })

  const editaisStr = partes[2 + CAMPOS_PERFIL.length]
  perfil.editais = editaisStr ? editaisStr.split('-').filter(Boolean) : []

  return { perfil, respostas }
}

const ctxBase = {
  perfil: { alvo: 'trt', cargo: 'analista' },
  correct: (n: number) => [true, false, true, false][n],
  score: 2,
  qtdEditaisReais: 1,
}

describe('bate', () => {
  it('regra vazia ou ausente bate sempre', () => {
    expect(bate(undefined, ctxBase)).toBe(true)
    expect(bate({}, ctxBase)).toBe(true)
  })

  it('eq: bate quando o valor do campo está na lista', () => {
    expect(bate({ eq: { alvo: ['trt', 'tj'] } }, ctxBase)).toBe(true)
    expect(bate({ eq: { alvo: ['tj'] } }, ctxBase)).toBe(false)
  })

  it('eq com múltiplos campos: precisa bater em todos (E)', () => {
    expect(bate({ eq: { alvo: ['trt'], cargo: ['analista'] } }, ctxBase)).toBe(true)
    expect(bate({ eq: { alvo: ['trt'], cargo: ['tecnico'] } }, ctxBase)).toBe(false)
  })

  it('ne: bate quando o valor do campo NÃO está na lista', () => {
    expect(bate({ ne: { alvo: ['tj'] } }, ctxBase)).toBe(true)
    expect(bate({ ne: { alvo: ['trt'] } }, ctxBase)).toBe(false)
  })

  it('wrong: bate quando errou a questão n', () => {
    expect(bate({ wrong: [1] }, ctxBase)).toBe(true)
    expect(bate({ wrong: [0] }, ctxBase)).toBe(false)
  })

  it('right: bate quando acertou a questão n', () => {
    expect(bate({ right: [0, 2] }, ctxBase)).toBe(true)
    expect(bate({ right: [0, 1] }, ctxBase)).toBe(false)
  })

  it('score_min / score_max', () => {
    expect(bate({ score_min: 2 }, ctxBase)).toBe(true)
    expect(bate({ score_min: 3 }, ctxBase)).toBe(false)
    expect(bate({ score_max: 2 }, ctxBase)).toBe(true)
    expect(bate({ score_max: 1 }, ctxBase)).toBe(false)
  })

  it('editais_min', () => {
    expect(bate({ editais_min: 1 }, ctxBase)).toBe(true)
    expect(bate({ editais_min: 2 }, ctxBase)).toBe(false)
  })

  it('any: basta uma regra bater', () => {
    expect(bate({ any: [{ eq: { alvo: ['tj'] } }, { eq: { alvo: ['trt'] } }] }, ctxBase)).toBe(true)
    expect(bate({ any: [{ eq: { alvo: ['tj'] } }, { eq: { alvo: ['trf'] } }] }, ctxBase)).toBe(false)
  })

  it('not: a regra de dentro não pode bater', () => {
    expect(bate({ not: { eq: { alvo: ['tj'] } } }, ctxBase)).toBe(true)
    expect(bate({ not: { eq: { alvo: ['trt'] } } }, ctxBase)).toBe(false)
  })

  it('chaves diferentes no mesmo objeto são somadas (E)', () => {
    expect(bate({ eq: { alvo: ['trt'] }, score_min: 2 }, ctxBase)).toBe(true)
    expect(bate({ eq: { alvo: ['trt'] }, score_min: 3 }, ctxBase)).toBe(false)
  })

  it('regra com chave desconhecida lança erro, igual ao rules.py de referência', () => {
    expect(() => bate({ chave_que_nao_existe: true } as never, ctxBase)).toThrow()
  })
})

describe('selecionarBlocos — os 8 casos de aceite do pacote raio-x-da-base', () => {
  for (const caso of casosDeTeste.casos) {
    it(`caso ${caso.id}: ${caso.resumo}`, () => {
      const { perfil, respostas } = decodeRX1(caso.entrada.codigo)
      const blocos = selecionarBlocos(perfil, respostas)
      expect(blocos.map((b) => b.id)).toEqual(caso.esperado.blocos)
    })
  }

  // Caso 9, achado por fuzz diferencial contra a implementação Python de
  // referência (4000 leads aleatórios válidos, 396 divergiam antes do fix).
  // `alvo === 'any'` não tem lista própria em `EDITAIS` (só tj/trf/trt/fe
  // existem no pacote Python); o bug indexava `lib/quizContent.ts`'s
  // `EDITAIS.any` — uma lista sintética só de UI, inexistente na
  // referência — em vez de cair no fallback `trt`
  // (`EDITAIS.get(alvo) or EDITAIS.get("trt", [])`). Isso fazia os editais
  // "tjto"/"tjam" (que não existem na lista `trt`) resolverem como editais
  // de verdade, acionando "editais_min": 1 e o bloco "mira" ("Sobre o TJ
  // TO..."), que a referência nunca escolhe pra esse lead. Nenhum dos 8
  // casos originais cobria isso: o único caso com alvo 'any' (05) só marca
  // 'qualquer', que o código com bug e o corrigido descartam do mesmo jeito.
  it('caso 09-any-com-edital-nao-trt: alvo "any" com editais fora da lista trt não deve acionar o bloco "mira"', () => {
    const { perfil, respostas } = decodeRX1(
      'RX1.any.oficial.outra.t2.p2.retafinal.insta.h0.nao.base.improviso.120.completa.-B-D.tjto-tjam',
    )
    const blocos = selecionarBlocos(perfil, respostas)
    expect(blocos.map((b) => b.id)).toEqual([
      'longe', 'h0', 'retafinal', 'd_base', 'n01', 'naojur2', 'proc', 'pub', 'alvo_any', 'oficial', 'v_insta',
    ])
    expect(blocos.map((b) => b.id)).not.toContain('mira')
  })
})
