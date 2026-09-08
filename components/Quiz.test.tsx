import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Quiz from './Quiz'
import { salvarEstado } from '@/lib/storage'

const RESULTADO = {
  score_geral_pct: 100,
  acertos: 4,
  total: 4,
  area_prioritaria: 'Raciocínio Lógico',
  areas: {
    'Língua Portuguesa': { acertos: 1, total: 1, pct: 100 },
    'Direito Constitucional': { acertos: 1, total: 1, pct: 100 },
    'Direito Processual Civil': { acertos: 1, total: 1, pct: 100 },
    'Raciocínio Lógico': { acertos: 1, total: 1, pct: 100 },
  },
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
    perfil: () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    answer: () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    finish: () => new Response(JSON.stringify(RESULTADO), { status: 200 }),
  }
}

beforeEach(() => {
  localStorage.clear()
  window.history.pushState({}, '', '/')
  respostas = respostaPadrao()
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/api/quiz/result')) return respostas.result()
    if (url.includes('/api/quiz/start')) return respostas.start()
    if (url.includes('/api/quiz/perfil')) return respostas.perfil()
    if (url.includes('/api/quiz/answer')) return respostas.answer()
    if (url.includes('/api/quiz/finish')) return respostas.finish()
    return new Response(JSON.stringify({}), { status: 200 })
  }))
})

// Clica no CTA da tela de abertura (hero) pra chegar na capa (formulário de
// identificação) — a abertura é a primeira tela, igual ao funil de referência.
function abrirCapa() {
  fireEvent.click(screen.getByText(/Quero descobrir meu momento/))
}

// Preenche a capa e clica em "Iniciar diagnóstico".
function iniciarDaCapa() {
  fireEvent.change(screen.getByPlaceholderText('Seu nome'), { target: { value: 'Maria Silva' } })
  fireEvent.change(screen.getByPlaceholderText('(85) 99682-6067'), { target: { value: '11987654321' } })
  fireEvent.change(screen.getByPlaceholderText('Seu melhor e-mail'), { target: { value: 'maria@x.com' } })
  fireEvent.click(screen.getByText('Iniciar diagnóstico'))
}

// Anda pelas 12 telas de perfilamento sempre escolhendo a primeira opção —
// nenhuma delas desqualifica (alvo=tj, formação=direito), então o funil
// sempre chega em "mirror" ao final.
function responderPerfilCompleto() {
  for (let i = 0; i < 9; i++) {
    fireEvent.click(screen.getAllByRole('button')[0])
  }
  // tela multi (editais): escolhe a primeira opção e confirma
  fireEvent.click(screen.getAllByRole('button')[0])
  fireEvent.click(screen.getByText('Continuar'))
  // dor, momento
  fireEvent.click(screen.getAllByRole('button')[0])
  fireEvent.click(screen.getAllByRole('button')[0])
}

// Da abertura até a primeira pergunta graduada ("Questão 1 de 4").
async function chegarAoQuiz() {
  abrirCapa()
  iniciarDaCapa()
  await waitFor(() => expect(screen.getByText(/Pergunta 1 de/)).toBeInTheDocument())
  // Toque pontual de personalização: só a 1ª pergunta abre com o nome.
  expect(screen.getByText(/Maria, qual concurso é a sua prioridade hoje\?/)).toBeInTheDocument()
  responderPerfilCompleto()
  await waitFor(() => expect(screen.getByText(/Anotei tudo, Maria\. A sua ficha ficou assim:/)).toBeInTheDocument())
  fireEvent.click(screen.getByText(/Está certo, pode seguir/))
  await waitFor(() => expect(screen.getByText(/Entendi, continuar/)).toBeInTheDocument())
  fireEvent.click(screen.getByText(/Entendi, continuar/))
  await waitFor(() => expect(screen.getAllByRole('button').length).toBeGreaterThan(0))
  fireEvent.click(screen.getAllByRole('button')[0]) // tela "dinheiro"
  await waitFor(() => expect(screen.getByText(/Quero encurtar esse caminho/)).toBeInTheDocument())
  fireEvent.click(screen.getByText(/Quero encurtar esse caminho/))
  await waitFor(() => expect(screen.getByText(/Questão 1 de 4/)).toBeInTheDocument())
}

// Responde as 4 perguntas graduadas com o gabarito real (C, C, B, A) e segue
// até a tela de resultado.
async function chegarAoResultado() {
  await chegarAoQuiz()
  const letras = ['C', 'C', 'B', 'A']
  for (const letra of letras) {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${letra} `) }))
    await waitFor(() => {})
  }
  await waitFor(() => expect(screen.getByText(/Maria, você acertou/)).toBeInTheDocument())
  fireEvent.click(screen.getByText(/Fechar meu raio-X/))
  await waitFor(() => expect(screen.getByText('Só o diagnóstico já basta')).toBeInTheDocument())
  expect(screen.getByText(/Maria, quer que eu inclua no seu resultado/)).toBeInTheDocument()
  fireEvent.click(screen.getByText('Só o diagnóstico já basta'))
  await waitFor(() => expect(screen.getByText(/o que eu enxerguei no seu caso/)).toBeInTheDocument())
}

describe('Quiz', () => {
  it('mostra a tela de abertura (hero), sem formulário, igual ao funil de referência', () => {
    render(<Quiz />)
    expect(screen.getByText(/Quero descobrir meu momento/)).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Seu nome')).not.toBeInTheDocument()
  })

  it('mostra a capa com o formulário de identificação só depois do CTA da abertura', () => {
    render(<Quiz />)
    abrirCapa()
    expect(screen.getByPlaceholderText('Seu nome')).toBeInTheDocument()
  })

  it('não mostra mensagem de erro do campo antes de sair dele (blur)', () => {
    render(<Quiz />)
    abrirCapa()
    fireEvent.change(screen.getByPlaceholderText('Seu nome'), { target: { value: 'Maria' } })
    expect(screen.queryByText('Informe nome e sobrenome.')).not.toBeInTheDocument()
  })

  it('mostra a mensagem específica de cada campo depois do blur, some quando corrige', () => {
    render(<Quiz />)
    abrirCapa()
    const campoNome = screen.getByPlaceholderText('Seu nome')
    fireEvent.change(campoNome, { target: { value: 'Maria' } })
    fireEvent.blur(campoNome)
    expect(screen.getByText('Informe nome e sobrenome.')).toBeInTheDocument()

    fireEvent.change(campoNome, { target: { value: 'Maria Silva' } })
    expect(screen.queryByText('Informe nome e sobrenome.')).not.toBeInTheDocument()
  })

  it('mostra a mensagem do WhatsApp e do e-mail depois do blur, cada uma no seu campo', () => {
    render(<Quiz />)
    abrirCapa()
    const campoWhatsapp = screen.getByPlaceholderText('(85) 99682-6067')
    const campoEmail = screen.getByPlaceholderText('Seu melhor e-mail')
    fireEvent.change(campoWhatsapp, { target: { value: '123' } })
    fireEvent.blur(campoWhatsapp)
    fireEvent.change(campoEmail, { target: { value: 'invalido' } })
    fireEvent.blur(campoEmail)
    expect(screen.getByText('WhatsApp inválido. Use o formato (85) 99682-6067.')).toBeInTheDocument()
    expect(screen.getByText('E-mail inválido.')).toBeInTheDocument()
  })

  it('exibe o WhatsApp com máscara (85) 99682-6067, mas guarda só os dígitos', async () => {
    render(<Quiz />)
    abrirCapa()
    fireEvent.change(screen.getByPlaceholderText('Seu nome'), { target: { value: 'Maria Silva' } })
    fireEvent.change(screen.getByPlaceholderText('(85) 99682-6067'), { target: { value: '85996826067' } })
    fireEvent.change(screen.getByPlaceholderText('Seu melhor e-mail'), { target: { value: 'maria@x.com' } })
    expect(screen.getByPlaceholderText('(85) 99682-6067')).toHaveValue('(85) 99682-6067')

    fireEvent.click(screen.getByText('Iniciar diagnóstico'))
    await waitFor(() => expect(screen.getByText(/Pergunta 1 de/)).toBeInTheDocument())
    const chamada = vi.mocked(fetch).mock.calls.find(([u]) => String(u).includes('/api/quiz/start'))
    const corpo = JSON.parse((chamada![1] as RequestInit).body as string)
    expect(corpo.whatsapp).toBe('85996826067')
  })

  it('avança pro perfilamento depois de preencher o formulário e iniciar', async () => {
    render(<Quiz />)
    abrirCapa()
    iniciarDaCapa()
    await waitFor(() => expect(screen.getByText(/Pergunta 1 de/)).toBeInTheDocument())
  })

  it('gera um session_token novo no início manual, sem reaproveitar o do cache', async () => {
    render(<Quiz />)
    abrirCapa()
    iniciarDaCapa()
    await waitFor(() => expect(screen.getByText(/Pergunta 1 de/)).toBeInTheDocument())

    const chamada = vi.mocked(fetch).mock.calls.find(([u]) => String(u).includes('/api/quiz/start'))
    const corpo = JSON.parse((chamada![1] as RequestInit).body as string)
    expect(corpo.session_token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })

  it('percorre perfilamento + vídeo + calculadora e chega às perguntas graduadas', async () => {
    render(<Quiz />)
    await chegarAoQuiz()
    // a resposta de perfil foi persistida (não graduada, chave/valor genéricos)
    const chamadaPerfil = vi.mocked(fetch).mock.calls.find(([u]) => String(u).includes('/api/quiz/perfil'))
    expect(chamadaPerfil).toBeTruthy()
  })

  it('usa o session_token devolvido pelo servidor ao responder uma pergunta graduada', async () => {
    render(<Quiz />)
    await chegarAoQuiz()

    fireEvent.click(screen.getByRole('button', { name: /^C / }))
    await waitFor(() => expect(screen.getByText(/Questão 2 de 4/)).toBeInTheDocument())

    const chamada = vi.mocked(fetch).mock.calls.find(([u]) => String(u).includes('/api/quiz/answer'))
    const corpo = JSON.parse((chamada![1] as RequestInit).body as string)
    expect(corpo.session_token).toBe('tok-1')
  })

  it('não avança quando /answer falha e mostra o erro', async () => {
    render(<Quiz />)
    await chegarAoQuiz()

    respostas.answer = () => new Response(JSON.stringify({ erro: 'x' }), { status: 422 })
    fireEvent.click(screen.getByRole('button', { name: /^C / }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByText(/Questão 1 de 4/)).toBeInTheDocument()
  })

  it('percorre a correção e a tela de resultado, com CTA de WhatsApp', async () => {
    render(<Quiz />)
    await chegarAoResultado()
    expect(screen.getByText(/o que eu enxerguei no seu caso/)).toBeInTheDocument()
    expect(screen.getByText(/Nível no teste/)).toBeInTheDocument()
    expect(screen.getByText(/intermediário|avançado|inicial/)).toBeInTheDocument()
    const cta = screen.getByText('Falar com o time no WhatsApp')
    expect(cta).toHaveAttribute('href', expect.stringContaining('https://wa.me/'))

    // Regressão: a chave 'leitura' precisa chegar em /api/quiz/perfil ANTES
    // de /api/quiz/finish — concluir cedo demais fazia esse /perfil morrer
    // com "sessão já concluída" (409), silenciado pelo catch de persistirPerfil.
    const chamadas = vi.mocked(fetch).mock.calls
    const idxLeitura = chamadas.findIndex(
      ([u, opts]) => String(u).includes('/api/quiz/perfil') && String((opts as RequestInit)?.body).includes('"leitura"'),
    )
    let idxFinish = -1
    chamadas.forEach(([u], i) => { if (String(u).includes('/api/quiz/finish')) idxFinish = i })
    expect(idxLeitura).toBeGreaterThanOrEqual(0)
    expect(idxFinish).toBeGreaterThanOrEqual(0)
    expect(idxLeitura).toBeLessThan(idxFinish)
  })

  it('reexibe o resultado ao recarregar uma sessão já concluída', async () => {
    salvarEstado({ sessionToken: 'tok-1', nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com' })
    respostas.result = () => new Response(JSON.stringify(RESULTADO), { status: 200 })

    render(<Quiz />)
    await waitFor(() => expect(screen.getByText(/Maria, o que eu enxerguei no seu caso/)).toBeInTheDocument())
    expect(screen.getByText('Falar com o time no WhatsApp')).toBeInTheDocument()
    expect(vi.mocked(fetch).mock.calls.some(([u]) => String(u).includes('/api/quiz/start'))).toBe(false)
  })

  it('retoma pro início do funil (tela intro) quando há sessão em cache ainda não concluída', async () => {
    salvarEstado({ sessionToken: 'tok-1', nome: 'Maria', whatsapp: '11987654321', email: 'maria@x.com' })
    respostas.start = () => new Response(
      JSON.stringify({ session_token: 'tok-1', retomando: true, respostas_salvas: [{ num: 1, escolhida: 'C' }] }),
      { status: 200 },
    )

    render(<Quiz />)
    await waitFor(() => expect(screen.getByText(/Quero descobrir meu momento/)).toBeInTheDocument())

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

  describe('fluxo com contato no final (?fluxo=final)', () => {
    it('pede só o nome na abertura; WhatsApp e e-mail só depois da leitura, com sessão criada ali', async () => {
      window.history.pushState({}, '', '/?fluxo=final')
      render(<Quiz />)

      await waitFor(() => expect(screen.getByText(/Quero descobrir meu momento/)).toBeInTheDocument())
      fireEvent.click(screen.getByText(/Quero descobrir meu momento/))

      // Só pede o nome — sem WhatsApp/e-mail nessa tela.
      expect(screen.getByText('Como podemos te chamar?')).toBeInTheDocument()
      expect(screen.queryByPlaceholderText('(85) 99682-6067')).not.toBeInTheDocument()
      fireEvent.change(screen.getByPlaceholderText('Seu nome completo'), { target: { value: 'Maria Silva' } })
      fireEvent.click(screen.getByText('Iniciar diagnóstico'))

      await waitFor(() => expect(screen.getByText(/Pergunta 1 de/)).toBeInTheDocument())
      expect(vi.mocked(fetch).mock.calls.some(([u]) => String(u).includes('/api/quiz/start'))).toBe(false)

      responderPerfilCompleto()
      await waitFor(() => expect(screen.getByText(/Está certo, pode seguir/)).toBeInTheDocument())
      fireEvent.click(screen.getByText(/Está certo, pode seguir/))
      await waitFor(() => expect(screen.getByText(/Entendi, continuar/)).toBeInTheDocument())
      fireEvent.click(screen.getByText(/Entendi, continuar/))
      await waitFor(() => expect(screen.getAllByRole('button').length).toBeGreaterThan(0))
      fireEvent.click(screen.getAllByRole('button')[0]) // tela "dinheiro"
      await waitFor(() => expect(screen.getByText(/Quero encurtar esse caminho/)).toBeInTheDocument())
      fireEvent.click(screen.getByText(/Quero encurtar esse caminho/))
      await waitFor(() => expect(screen.getByText(/Questão 1 de 4/)).toBeInTheDocument())

      const letras = ['C', 'C', 'B', 'A']
      for (const letra of letras) {
        fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${letra} `) }))
        await waitFor(() => {})
      }
      // Respostas graduadas ficam só locais até o contato ser enviado.
      expect(vi.mocked(fetch).mock.calls.some(([u]) => String(u).includes('/api/quiz/answer'))).toBe(false)

      await waitFor(() => expect(screen.getByText(/Maria, você acertou/)).toBeInTheDocument())
      fireEvent.click(screen.getByText(/Fechar meu raio-X/))
      await waitFor(() => expect(screen.getByText('Só o diagnóstico já basta')).toBeInTheDocument())
      fireEvent.click(screen.getByText('Só o diagnóstico já basta'))

      // Só agora pede WhatsApp e e-mail.
      await waitFor(() => expect(screen.getByLabelText('WhatsApp')).toBeInTheDocument())
      fireEvent.change(screen.getByLabelText('WhatsApp'), { target: { value: '11987654321' } })
      fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'maria@x.com' } })
      fireEvent.click(screen.getByText('Ver meu diagnóstico'))

      await waitFor(() => expect(screen.getByText(/Maria, o que eu enxerguei no seu caso/)).toBeInTheDocument())

      const chamadaStart = vi.mocked(fetch).mock.calls.find(([u]) => String(u).includes('/api/quiz/start'))
      expect(JSON.parse((chamadaStart![1] as RequestInit).body as string)).toMatchObject({
        nome: 'Maria Silva',
        whatsapp: '11987654321',
        email: 'maria@x.com',
      })
      expect(vi.mocked(fetch).mock.calls.filter(([u]) => String(u).includes('/api/quiz/answer'))).toHaveLength(4)
      expect(vi.mocked(fetch).mock.calls.some(([u]) => String(u).includes('/api/quiz/finish'))).toBe(true)

      // Regressão: o perfilamento inteiro (respondido em memória o funil todo)
      // precisa ser enviado pro servidor junto do contato — sem isso, a
      // sessão fechava com perfil vazio e a classificação (classe/curso/
      // ritmo) do time comercial ficava toda errada.
      const chamadasPerfil = vi.mocked(fetch).mock.calls.filter(([u]) => String(u).includes('/api/quiz/perfil'))
      expect(chamadasPerfil.length).toBeGreaterThan(0)
      expect(chamadasPerfil.some(([, opts]) => String((opts as RequestInit)?.body).includes('"leitura"'))).toBe(true)
    })
  })
})
