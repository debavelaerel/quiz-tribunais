import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PERFIL_SCREENS, EDITAIS, editaisDisponiveis } from './quizContent'
import type { RespostasPerfil } from './perfil'

function desqualifica(r: RespostasPerfil): boolean {
  const tela = PERFIL_SCREENS.find((t) => t.key === 'formacao')
  if (!tela || tela.type !== 'single') throw new Error('tela de formação não encontrada')
  return tela.after?.(r) === 'desqualificado'
}

function cargosOferecidos(r: RespostasPerfil): string[] {
  const tela = PERFIL_SCREENS.find((t) => t.key === 'cargo')
  if (!tela || tela.type !== 'single') throw new Error('tela de cargo não encontrada')
  const opts = typeof tela.opts === 'function' ? tela.opts(r) : tela.opts
  return opts.map((o) => o[0])
}

describe('opções de cargo conforme o concurso escolhido', () => {
  it('escrevente só aparece pra Tribunal de Justiça e pra "qualquer tribunal"', () => {
    expect(cargosOferecidos({ alvo: 'tj' })).toContain('escrevente')
    expect(cargosOferecidos({ alvo: 'any' })).toContain('escrevente')
  })

  it('escrevente não aparece pra TRF, TRT nem funções essenciais', () => {
    for (const alvo of ['trf', 'trt', 'fe']) {
      expect(cargosOferecidos({ alvo })).not.toContain('escrevente')
    }
  })
})

describe('desqualificação por formação', () => {
  it('escrevente entra no funil, mesmo com ensino médio', () => {
    expect(desqualifica({ alvo: 'tj', cargo: 'escrevente', formacao: 'medio' })).toBe(false)
    expect(desqualifica({ alvo: 'tj', cargo: 'escrevente', formacao: 'direito' })).toBe(false)
  })

  it('ensino médio continua desqualificando quem mira outro cargo', () => {
    expect(desqualifica({ alvo: 'tj', cargo: 'tecnico', formacao: 'medio' })).toBe(true)
    expect(desqualifica({ alvo: 'trt', cargo: 'analista', formacao: 'medio' })).toBe(true)
  })

  it('quem tem formação superior segue, em qualquer cargo', () => {
    expect(desqualifica({ alvo: 'trt', cargo: 'tecnico', formacao: 'outra' })).toBe(false)
  })
})

// O serviço de PDF (Python) valida os ids de edital contra a própria cópia da lista — um id que
// existe só no TS faz o diagnóstico daquele lead ser recusado (422).
describe('lista de editais', () => {
  const ref = JSON.parse(readFileSync(join(process.cwd(), 'reference/raio-x-da-base/diagnosis.json'), 'utf-8'))

  it('tem os mesmos ids, rótulos e textos do pacote usado pelo serviço de PDF', () => {
    for (const grupo of ['tj', 'trf', 'trt', 'fe']) {
      const ts = EDITAIS[grupo].map(({ id, label, sub }) => ({ id, label, sub }))
      expect(ts).toEqual(ref.editais[grupo])
    }
  })
})

describe('editais oferecidos conforme o cargo', () => {
  it('escrevente só vê concursos de Tribunal de Justiça, mesmo com "qualquer tribunal"', () => {
    for (const alvo of ['tj', 'any']) {
      const ids = editaisDisponiveis({ alvo, cargo: 'escrevente' }).map((e) => e.id)
      expect(ids).toEqual(EDITAIS.tj.map((e) => e.id))
    }
  })

  it('quem mira outro cargo continua vendo a lista do concurso escolhido', () => {
    expect(editaisDisponiveis({ alvo: 'trt', cargo: 'analista' })).toBe(EDITAIS.trt)
    expect(editaisDisponiveis({ alvo: 'any', cargo: 'analista' })).toBe(EDITAIS.any)
  })
})
