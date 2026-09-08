import { describe, it, expect } from 'vitest'
import { listarTudo } from './listarTudo'
import { criarFakeSessionRepo } from './testHelpers/fakeSessionRepo'
import type { QuizSession } from './types'

const EVENTO = 'teste-evento'

function sessaoBase(i: number): Omit<QuizSession, 'id'> {
  return {
    sessionToken: `tok-${i}`,
    evento: EVENTO,
    nome: `Pessoa ${i}`,
    whatsapp: '11900000000',
    whatsappNormalizado: '5511900000000',
    email: `pessoa${i}@x.com`,
    emailNormalizado: `pessoa${i}@x.com`,
    fluxo: 'padrao',
    status: 'concluido',
    respostas: [],
    areas: {},
    scoreGeralPct: 0,
    acertos: 0,
    total: 0,
    areaPrioritaria: null,
    perfil: {},
    perfilCalculado: null,
    startedAt: new Date(2026, 0, 1, 0, i).toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
  }
}

describe('listarTudo', () => {
  it('junta todas as sessões mesmo além de um único bloco de paginação', async () => {
    const repo = criarFakeSessionRepo()
    for (let i = 0; i < 30; i++) await repo.criar(sessaoBase(i))

    // listar() do fake não tem teto de max_rows como o Supabase real, mas
    // listarTudo() só sabe pedir em blocos — então isso testa que a
    // paginação em loop de fato varre tudo, não só o primeiro bloco.
    const resultado = await listarTudo(repo, EVENTO, {}, 999)
    expect(resultado.total).toBe(30)
    expect(resultado.sessoes).toHaveLength(30)
  })

  it('respeita o limiteTotal mesmo com mais linhas disponíveis', async () => {
    const repo = criarFakeSessionRepo()
    for (let i = 0; i < 10; i++) await repo.criar(sessaoBase(i))

    const resultado = await listarTudo(repo, EVENTO, {}, 3)
    expect(resultado.sessoes).toHaveLength(3)
    expect(resultado.total).toBe(10) // total real, mesmo truncando as linhas devolvidas
  })

  it('sem nenhuma sessão: devolve vazio sem loop infinito', async () => {
    const repo = criarFakeSessionRepo()
    const resultado = await listarTudo(repo, EVENTO, {}, 500)
    expect(resultado.sessoes).toEqual([])
    expect(resultado.total).toBe(0)
  })

  it('aplica o filtro (status) em todos os blocos', async () => {
    const repo = criarFakeSessionRepo()
    for (let i = 0; i < 5; i++) await repo.criar({ ...sessaoBase(i), status: i % 2 === 0 ? 'concluido' : 'em_andamento' })

    const resultado = await listarTudo(repo, EVENTO, { status: 'concluido' }, 500)
    expect(resultado.sessoes.every((s) => s.status === 'concluido')).toBe(true)
    expect(resultado.total).toBe(3)
  })
})
