import type { LeadsDesqualificadosRepo, LeadDesqualificado } from '../leadsDesqualificadosRepo'

let proximoId = 1

export function criarFakeLeadsDesqualificadosRepo(): LeadsDesqualificadosRepo & { linhas: LeadDesqualificado[] } {
  const linhas: LeadDesqualificado[] = []

  return {
    linhas,
    async criar(lead) {
      const nova: LeadDesqualificado = { ...lead, id: proximoId++, criadoEm: new Date().toISOString() }
      linhas.push(nova)
      return nova
    },
  }
}
