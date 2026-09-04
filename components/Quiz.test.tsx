import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Quiz from './Quiz'

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/api/quiz/start')) {
      return new Response(JSON.stringify({ session_token: 'tok-1', retomando: false, respostasSalvas: [] }), { status: 200 })
    }
    if (url.includes('/api/quiz/answer')) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }
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
})
