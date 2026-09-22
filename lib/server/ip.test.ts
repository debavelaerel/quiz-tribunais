import { describe, it, expect } from 'vitest'
import { ipDaRequisicao } from './ip'

function reqComForwardedFor(valor: string | null): Request {
  const headers = new Headers()
  if (valor !== null) headers.set('x-forwarded-for', valor)
  return new Request('https://x.com', { headers })
}

describe('ipDaRequisicao', () => {
  it('devolve o único IP quando o header tem só um valor', () => {
    expect(ipDaRequisicao(reqComForwardedFor('203.0.113.9'))).toBe('203.0.113.9')
  })

  // Regressão: na Vercel (e em qualquer proxy que segue a convenção padrão),
  // a borda ANEXA o IP real de quem conectou ao final do header — não
  // substitui um valor que o próprio cliente já tenha mandado. Ler o
  // primeiro item pegava o valor que o requisitante escolhe mandar, deixando
  // todo rate-limit por IP (inclusive tentativa de senha do /admin)
  // contornável com um X-Forwarded-For diferente a cada requisição.
  it('devolve o ÚLTIMO IP da cadeia, não o primeiro (só a borda pode anexar o real)', () => {
    expect(ipDaRequisicao(reqComForwardedFor('1.2.3.4, 203.0.113.9'))).toBe('203.0.113.9')
  })

  it('ignora espaços em volta das vírgulas', () => {
    expect(ipDaRequisicao(reqComForwardedFor('1.2.3.4 ,  203.0.113.9  '))).toBe('203.0.113.9')
  })

  it('devolve "desconhecido" quando o header não existe', () => {
    expect(ipDaRequisicao(reqComForwardedFor(null))).toBe('desconhecido')
  })

  it('devolve "desconhecido" quando o header é uma string vazia', () => {
    expect(ipDaRequisicao(reqComForwardedFor(''))).toBe('desconhecido')
  })
})
