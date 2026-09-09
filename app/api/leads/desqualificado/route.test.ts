// app/api/leads/desqualificado/route.test.ts
import { describe, it, expect } from 'vitest'
import { criarHandlerLeadDesqualificado } from './route'
import { criarFakeLeadsDesqualificadosRepo } from '@/lib/server/testHelpers/fakeLeadsDesqualificadosRepo'

function fazerRequisicao(corpo: unknown) {
  return new Request('http://localhost/api/leads/desqualificado', {
    method: 'POST',
    body: JSON.stringify(corpo),
    headers: { 'x-forwarded-for': `10.0.1.${Math.floor(Math.random() * 250)}` },
  })
}

const CORPO_VALIDO_OUTRO = {
  fluxo: 'final', motivo: 'outro', nome: 'Maria Silva', whatsapp: '11987654321', email: 'maria@x.com',
}

describe('POST /api/leads/desqualificado', () => {
  it('grava lead válido (motivo sem carreira jurídica) com 200', async () => {
    const repo = criarFakeLeadsDesqualificadosRepo()
    const handler = criarHandlerLeadDesqualificado(repo)
    const res = await handler(fazerRequisicao(CORPO_VALIDO_OUTRO))
    expect(res.status).toBe(200)
    expect(repo.linhas).toHaveLength(1)
    expect(repo.linhas[0]).toMatchObject({ motivo: 'outro', fluxo: 'final', carreiraJuridica: null })
  })

  it('grava carreira_juridica quando motivo é juridica', async () => {
    const repo = criarFakeLeadsDesqualificadosRepo()
    const handler = criarHandlerLeadDesqualificado(repo)
    const res = await handler(fazerRequisicao({
      fluxo: 'padrao', motivo: 'juridica', carreira_juridica: 'promotor',
      nome: 'Maria Silva', whatsapp: '11987654321', email: 'maria@x.com',
    }))
    expect(res.status).toBe(200)
    expect(repo.linhas[0].carreiraJuridica).toBe('promotor')
  })

  it('recusa motivo juridica sem carreira_juridica com 422', async () => {
    const handler = criarHandlerLeadDesqualificado(criarFakeLeadsDesqualificadosRepo())
    const res = await handler(fazerRequisicao({
      fluxo: 'padrao', motivo: 'juridica', nome: 'Maria Silva', whatsapp: '11987654321', email: 'maria@x.com',
    }))
    expect(res.status).toBe(422)
  })

  it('recusa carreira_juridica fora da lista com 422', async () => {
    const handler = criarHandlerLeadDesqualificado(criarFakeLeadsDesqualificadosRepo())
    const res = await handler(fazerRequisicao({
      fluxo: 'padrao', motivo: 'juridica', carreira_juridica: 'delegado',
      nome: 'Maria Silva', whatsapp: '11987654321', email: 'maria@x.com',
    }))
    expect(res.status).toBe(422)
  })

  it('recusa carreira_juridica quando o motivo NÃO é juridica com 422', async () => {
    const handler = criarHandlerLeadDesqualificado(criarFakeLeadsDesqualificadosRepo())
    const res = await handler(fazerRequisicao({
      fluxo: 'padrao', motivo: 'outro', carreira_juridica: 'promotor',
      nome: 'Maria Silva', whatsapp: '11987654321', email: 'maria@x.com',
    }))
    expect(res.status).toBe(422)
  })

  it('recusa motivo fora da allowlist com 422', async () => {
    const handler = criarHandlerLeadDesqualificado(criarFakeLeadsDesqualificadosRepo())
    const res = await handler(fazerRequisicao({ ...CORPO_VALIDO_OUTRO, motivo: 'qualquer' }))
    expect(res.status).toBe(422)
  })

  it('recusa fluxo fora da allowlist com 422', async () => {
    const handler = criarHandlerLeadDesqualificado(criarFakeLeadsDesqualificadosRepo())
    const res = await handler(fazerRequisicao({ ...CORPO_VALIDO_OUTRO, fluxo: 'outro-fluxo' }))
    expect(res.status).toBe(422)
  })

  it('recusa nome com uma palavra só com 422', async () => {
    const handler = criarHandlerLeadDesqualificado(criarFakeLeadsDesqualificadosRepo())
    const res = await handler(fazerRequisicao({ ...CORPO_VALIDO_OUTRO, nome: 'Maria' }))
    expect(res.status).toBe(422)
  })

  it('recusa email inválido com 422', async () => {
    const handler = criarHandlerLeadDesqualificado(criarFakeLeadsDesqualificadosRepo())
    const res = await handler(fazerRequisicao({ ...CORPO_VALIDO_OUTRO, email: 'invalido' }))
    expect(res.status).toBe(422)
  })

  it('recusa whatsapp inválido com 422', async () => {
    const handler = criarHandlerLeadDesqualificado(criarFakeLeadsDesqualificadosRepo())
    const res = await handler(fazerRequisicao({ ...CORPO_VALIDO_OUTRO, whatsapp: '123' }))
    expect(res.status).toBe(422)
  })

  it('ignora evento mandado pelo cliente — sempre usa o evento do servidor', async () => {
    const repo = criarFakeLeadsDesqualificadosRepo()
    const handler = criarHandlerLeadDesqualificado(repo)
    await handler(fazerRequisicao({ ...CORPO_VALIDO_OUTRO, evento: 'evento-forjado' }))
    expect(repo.linhas[0].evento).not.toBe('evento-forjado')
  })
})
