import { describe, it, expect } from 'vitest'
import { criarFakeLeadsDesqualificadosRepo } from './testHelpers/fakeLeadsDesqualificadosRepo'
import { registrarLeadDesqualificado } from './leadsDesqualificados'

const EVENTO = 'diagnostico-tribunais-comercial'

describe('registrarLeadDesqualificado', () => {
  it('grava nome, contato normalizado, fluxo e motivo', async () => {
    const repo = criarFakeLeadsDesqualificadosRepo()
    await registrarLeadDesqualificado(repo, {
      evento: EVENTO, fluxo: 'final', motivo: 'outro', carreiraJuridica: null,
      nome: 'Maria Silva', whatsapp: '(11) 98765-4321', email: 'MARIA@X.COM',
    })
    expect(repo.linhas).toHaveLength(1)
    expect(repo.linhas[0]).toMatchObject({
      evento: EVENTO, fluxo: 'final', motivo: 'outro', carreiraJuridica: null,
      nome: 'Maria Silva', whatsapp: '(11) 98765-4321', whatsappNormalizado: '5511987654321',
      email: 'MARIA@X.COM', emailNormalizado: 'maria@x.com',
    })
  })

  it('grava carreiraJuridica quando o motivo é juridica', async () => {
    const repo = criarFakeLeadsDesqualificadosRepo()
    await registrarLeadDesqualificado(repo, {
      evento: EVENTO, fluxo: 'padrao', motivo: 'juridica', carreiraJuridica: 'promotor',
      nome: 'Maria Silva', whatsapp: '11987654321', email: 'maria@x.com',
    })
    expect(repo.linhas[0].carreiraJuridica).toBe('promotor')
  })

  // Espelha o check da migration (carreira_juridica só com motivo='juridica')
  // no código também: mesmo que o cliente mande carreiraJuridica por engano
  // pra outro motivo, essa camada limpa antes de gravar.
  it('ignora carreiraJuridica quando o motivo NÃO é juridica', async () => {
    const repo = criarFakeLeadsDesqualificadosRepo()
    await registrarLeadDesqualificado(repo, {
      evento: EVENTO, fluxo: 'padrao', motivo: 'cargo_baixo', carreiraJuridica: 'promotor',
      nome: 'Maria Silva', whatsapp: '11987654321', email: 'maria@x.com',
    })
    expect(repo.linhas[0].carreiraJuridica).toBeNull()
  })

  it('não deduplica — cada chamada grava uma linha nova', async () => {
    const repo = criarFakeLeadsDesqualificadosRepo()
    const input = {
      evento: EVENTO, fluxo: 'final' as const, motivo: 'outro' as const, carreiraJuridica: null,
      nome: 'Maria Silva', whatsapp: '11987654321', email: 'maria@x.com',
    }
    await registrarLeadDesqualificado(repo, input)
    await registrarLeadDesqualificado(repo, input)
    expect(repo.linhas).toHaveLength(2)
  })
})
