import { describe, it, expect } from 'vitest'
import { montarHtmlLaudo } from './pdf'
import type { QuizSession } from './types'

function sessaoDeExemplo(): QuizSession {
  return {
    id: 1, sessionToken: 'tok', evento: 'diagnostico-tribunais-comercial',
    nome: 'Camila Nogueira', whatsapp: '11999998888', whatsappNormalizado: '5511999998888',
    email: 'camila@x.com', emailNormalizado: 'camila@x.com', fluxo: 'padrao', status: 'concluido',
    respostas: [
      { num: 1, area: 'Língua Portuguesa', escolhida: 'C', gabarito: 'C', acertou: true },
      { num: 2, area: 'Direito Constitucional', escolhida: 'A', gabarito: 'C', acertou: false },
      { num: 3, area: 'Direito Processual Civil', escolhida: 'B', gabarito: 'B', acertou: true },
      { num: 4, area: 'Raciocínio Lógico', escolhida: 'D', gabarito: 'A', acertou: false },
    ],
    areas: {}, scoreGeralPct: 50, acertos: 2, total: 4, areaPrioritaria: 'Direito Constitucional',
    perfil: {
      alvo: 'tj', cargo: 'analista', formacao: 'cursando_direito', tempo: 't0', provas: 'p0',
      metodo: 'nenhum', vde: 'nunca', horas: 'h1', edital: 'sem', dor: 'improviso',
      momento: 'zero', dinheiro: '96', leitura: 'completa', editais: [],
    },
    perfilCalculado: { classe: 'A', pontos: 7, curso: 'Curso 2 · Analista de TJ e TRF (231 temas)', cursoCod: 'C2-TJTRF', ritmo: 'base em ~12 meses' },
    blocos: [
      { id: 'iniciante', group: 'Onde você está', title: 'Começando do zero', paragraphs: ['Texto de exemplo do bloco.'] },
    ],
    whatsappClicadoEm: null, startedAt: '2026-09-16T10:00:00Z', updatedAt: '2026-09-16T10:20:00Z', completedAt: '2026-09-16T10:20:00Z',
  }
}

describe('montarHtmlLaudo', () => {
  it('inclui o nome, o diagnóstico e os blocos, sem usar cores do pacote (lilás/roxo)', () => {
    const html = montarHtmlLaudo(sessaoDeExemplo(), 'inicial')
    expect(html).toContain('Camila')
    expect(html).toContain('Começando do zero')
    expect(html).toContain('Texto de exemplo do bloco.')
    expect(html.toLowerCase()).not.toContain('#5421a1') // --purple do pacote
    expect(html.toLowerCase()).not.toContain('#c3bef9') // --lav do pacote
  })

  it('só inclui o plano de ação (ordem numerada) quando leitura é completa', () => {
    const comPlano = montarHtmlLaudo(sessaoDeExemplo(), 'inicial')
    const semPlano = montarHtmlLaudo({ ...sessaoDeExemplo(), perfil: { ...sessaoDeExemplo().perfil, leitura: 'basica' } }, 'inicial')
    expect(comPlano).toContain('A ordem que eu seguiria')
    expect(semPlano).not.toContain('A ordem que eu seguiria')
  })
})
