import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Quiz from './Quiz'
import { salvarEstado } from '@/lib/storage'

const RESULTADO = {
  score_geral_pct: 100,
  acertos: 3,
  total: 3,
  area_prioritaria: 'Direito Constitucional',
  areas: { 'Direito Constitucional': { acertos: 1, total: 1, pct: 100 } },
}

// Respostas por endpoint, sobrescritas caso a caso. O corpo de /start usa o mesmo
// snake_case da rota real (`session_token`, `retomando`, `respostas_salvas`).
let respostas: Record<string, () => Response>

function respostaPadrao(): Record<string, () => Response> {
  return {
    result: () => new Response(JSON.stringify({ erro: 'não encontrado' }), { status: 404 }),
    start: () => new Response(
      JSON.stringify({ session_token: 'tok-1', retomando: false, respostas_salvas: [] }),
      { status: 200 },
    ),
    answer: () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    finish: () => new Response(JSON.stringify(RESULTADO), { status: 200 }),
  }
}

beforeEach(() => {
  localStorage.clear()
  respostas = respostaPadrao()
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/api/quiz/result')) return respostas.result()
    if (url.includes('/api/quiz/start')) return respostas.start()
    if (url.includes('/api/quiz/answer')) return respostas.answer()
    if (url.includes('/api/quiz/finish')) return respostas.finish()
    return new Response(JSON.stringify({}), { status: 200 })
  }))
})

describe('Quiz', () => {
  it('mostra a tela de capa com o formulário de identificação', () => {
    render(<Quiz />)
    expect(screen.getByPlaceholderText('Seu nome')).toBeInTheDocument()
  })

  it('avança para a primeira pergunta depois de preencher o formulário e iniciar', async () => {
    render(<Quiz />)
    fireEvent.change(screen.getByPlaceholderText('Seu nome'), { target: { value: 'Maria' } })
    fireEvent.change(screen.getByPlaceholderText('(DDD) 00000-0000'), { target: { value: '11987654321' } })
    fireEvent.change(screen.getByPlaceholderText('Seu melhor e-mail'), { target: { value: 'maria@x.com' } })
    fireEvent.click(screen.getByText('Iniciar diagnóstico'))
    await waitFor(() => expect(screen.getByText(/Questão 1/)).toBeInTheDocument())
  })

  it('gera um session_token novo no início manual, sem reaproveitar o do cache', async () => {
    render(<Quiz />)
    fireEvent.change(screen.getByPlaceholderText('Seu nome'), { target: { value: 'Maria' } })
    fireEvent.change(screen.getByPlaceholderText('(DDD) 00000-0000'), { target: { value: '11987654321' } })
    fireEvent.change(screen.getByPlaceholderText('Seu melhor e-mail'), { target: { value: 'maria@x.com' } })
    fireEvent.click(screen.getByText('Iniciar diagnóstico'))
    await waitFor(() => expect(screen.getByText(/Questão 1/)).toBeInTheDocument())

    const chamada = vi.mocked(fetch).mock.calls.find(([u]) => String(u).includes('/api/quiz/start'))
    const corpo = JSON.parse((chamada![1] as RequestInit).body as string)
    expect(corpo.session_token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })

  it('usa o session_token devolvido pelo servidor ao responder', async () => {
    render(<Quiz />)
    fireEvent.change(screen.getByPlaceholderText('Seu nome'), { target: { value: 'Maria' } })
    fireEvent.change(screen.getByPlaceholderText('(DDD) 00000-0000'), { target: { value: '11987654321' } })
    fireEvent.change(screen.getByPlaceholderText('Seu melhor e-mail'), { target: { value: 'maria@x.com' } })
    fireEvent.click(screen.getByText('Iniciar diagnóstico'))
    await waitFor(() => expect(screen.getByText(/Questão 1/)).toBeInTheDocument())

    fireEvent.click(screen.getByText(/^A\)/))
    await waitFor(() => expect(screen.getByText(/Questão 2/)).toBeInTheDocument())

    const chamada = vi.mocked(fetch).mock.calls.find(([u]) => String(u).includes('/api/quiz/answer'))
    const corpo = JSON.parse((chamada![1] as RequestInit).body as string)
    expect(corpo.session_token).toBe('tok-1')
  })

  it('não avança quando /answer falha e mostra o erro', async () => {
    render(<Quiz />)
    fireEvent.change(screen.getByPlaceholderText('Seu nome'), { target: { value: 'Maria' } })
    fireEvent.change(screen.getByPlaceholderText('(DDD) 00000-0000'), { target: { value: '11987654321' } })
    fireEvent.change(screen.getByPlaceholderText('Seu melhor e-mail'), { target: { value: 'maria@x.com' } })
    fireEvent.click(screen.getByText('Iniciar diagnóstico'))
    await waitFor(() => expect(screen.getByText(/Questão 1/)).toBeInTheDocument())

    respostas.answer = () => new Response(JSON.stringify({ erro: 'x' }), { status: 422 })
    fireEvent.click(screen.getByText(/^A\)/))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByText(/Questão 1/)).toBeInTheDocument()
  })

  it('reexibe o resultado ao recarregar uma sessão já concluída', async () => {
    salvarEstado({ sessionToken: 'tok-1', nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com' })
    respostas.result = () => new Response(JSON.stringify(RESULTADO), { status: 200 })

    render(<Quiz />)
    await waitFor(() => expect(screen.getByText('Diagnóstico concluído')).toBeInTheDocument())
    expect(screen.getByText(/100% de aproveitamento/)).toBeInTheDocument()
    expect(vi.mocked(fetch).mock.calls.some(([u]) => String(u).includes('/api/quiz/start'))).toBe(false)
  })

  it('retoma na pergunta certa ao recarregar no meio do quiz, sem repedir os dados', async () => {
    salvarEstado({ sessionToken: 'tok-1', nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com' })
    respostas.start = () => new Response(
      JSON.stringify({ session_token: 'tok-1', retomando: true, respostas_salvas: [{ num: 1, escolhida: 'B' }] }),
      { status: 200 },
    )

    render(<Quiz />)
    await waitFor(() => expect(screen.getByText(/Questão 2 de 3/)).toBeInTheDocument())

    const chamada = vi.mocked(fetch).mock.calls.find(([u]) => String(u).includes('/api/quiz/start'))
    const corpo = JSON.parse((chamada![1] as RequestInit).body as string)
    expect(corpo).toMatchObject({ nome: 'Maria', email: 'maria@x.com', session_token: 'tok-1' })
  })

  it('volta para a capa com os dados preenchidos quando a retomada falha', async () => {
    salvarEstado({ sessionToken: 'tok-1', nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com' })
    respostas.start = () => new Response(JSON.stringify({ erro: 'x' }), { status: 422 })

    render(<Quiz />)
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByPlaceholderText('Seu nome')).toHaveValue('Maria')
  })
})
