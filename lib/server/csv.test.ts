import { describe, it, expect } from 'vitest'
import { paraCsv } from './csv'

describe('paraCsv', () => {
  it('gera cabeçalho + linhas separados por vírgula, terminados em \\r\\n', () => {
    const csv = paraCsv(['nome', 'idade'], [['Maria', 30], ['João', 25]])
    expect(csv).toBe('nome,idade\r\nMaria,30\r\nJoão,25\r\n')
  })

  it('escapa célula com vírgula entre aspas duplas', () => {
    const csv = paraCsv(['a'], [['Tribunal de Justiça (TJ), o estadual']])
    expect(csv).toBe('a\r\n"Tribunal de Justiça (TJ), o estadual"\r\n')
  })

  it('escapa aspas duplicando-as', () => {
    const csv = paraCsv(['a'], [['ela disse "oi"']])
    expect(csv).toBe('a\r\n"ela disse ""oi"""\r\n')
  })

  it('escapa quebra de linha interna', () => {
    const csv = paraCsv(['a'], [['linha1\nlinha2']])
    expect(csv).toBe('a\r\n"linha1\nlinha2"\r\n')
  })

  it('null/undefined viram célula vazia', () => {
    const csv = paraCsv(['a', 'b'], [[null, undefined]])
    expect(csv).toBe('a,b\r\n,\r\n')
  })

  it('sem linhas: só o cabeçalho', () => {
    expect(paraCsv(['a', 'b'], [])).toBe('a,b\r\n')
  })

  it('prefixa com aspas simples célula que começa com = + - @ (formula injection)', () => {
    const csv = paraCsv(['nome'], [
      ['=HYPERLINK("http://evil.com","clique")'],
      ["+1+1"],
      ['-1+1'],
      ['@SUM(A1:A2)'],
    ])
    const linhas = csv.split('\r\n')
    expect(linhas[1]).toBe(`"'=HYPERLINK(""http://evil.com"",""clique"")"`)
    expect(linhas[2]).toBe("'+1+1")
    expect(linhas[3]).toBe("'-1+1")
    expect(linhas[4]).toBe("'@SUM(A1:A2)")
  })

  it('não mexe em célula que só contém = no meio, não no começo', () => {
    expect(paraCsv(['a'], [['R$ 5 mil = bom negócio']])).toBe('a\r\nR$ 5 mil = bom negócio\r\n')
  })

  it('não mexe em célula vazia mesmo com a checagem de gatilho de fórmula', () => {
    expect(paraCsv(['a'], [['']])).toBe('a\r\n\r\n')
  })
})
